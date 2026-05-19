import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import type { BrokerGatewayRpcRequestDto } from '@giwater/shared';
import type { BrokerConfig } from '../config/configuration';
import { IndexerAggregationService } from '../aggregation/indexer-aggregation.service';
import { GatewayRpcInvokeService } from '../gateway-rpc/gateway-rpc-invoke.service';
import { BrokerGatewayHttpCachePublishService } from '../emitter/broker-gateway-http-cache-publish.service';
import { BrokerGatewayWsFanoutService } from '../emitter/broker-gateway-ws-fanout.service';
import { IndexerEventsService } from '../indexer-events/indexer-events.service';
import { RetryableAggregationError } from '../aggregation/retryable-aggregation.error';

/**
 * RabbitMQ ingress (indexer + gateway RPC).
 *
 * **Gateway parity + fan-out:** broker HTTP and gateway `apiInvoke` share one
 * contract—see `apps/broker/prompts/gateway-rpc-fanout.md` (checklist + optional
 * `publishToGateway` fan-out for async pushes to all gateway replicas).
 */
@Injectable()
export class RabbitmqService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitmqService.name);
  private connection?: ReturnType<typeof amqp.connect>;
  private publishChannel?: ChannelWrapper;
  private consumerChannel?: ChannelWrapper;

  constructor(
    private readonly configService: ConfigService,
    private readonly indexerEvents: IndexerEventsService,
    private readonly indexerAggregation: IndexerAggregationService,
    private readonly gatewayRpcInvoke: GatewayRpcInvokeService,
    @Inject(forwardRef(() => BrokerGatewayWsFanoutService))
    private readonly brokerGatewayWsFanout: BrokerGatewayWsFanoutService,
    @Inject(forwardRef(() => BrokerGatewayHttpCachePublishService))
    private readonly brokerGatewayHttpCachePublish: BrokerGatewayHttpCachePublishService,
  ) {}

  private get rabbit(): BrokerConfig['rabbitmq'] {
    return this.configService.getOrThrow<BrokerConfig['rabbitmq']>('rabbitmq');
  }

  async onApplicationBootstrap(): Promise<void> {
    const { url, gatewayExchange, indexerQueue, rpcQueue } = this.rabbit;

    this.connection = amqp.connect([url], {
      reconnectTimeInSeconds: 5,
    });

    this.connection.on('connect', () =>
      this.logger.log('RabbitMQ connection established'),
    );
    this.connection.on('disconnect', (err) =>
      this.logger.warn(`RabbitMQ disconnected: ${err?.err?.message ?? err}`),
    );

    this.publishChannel = this.connection.createChannel({
      json: true,
      setup: async (channel: Channel) => {
        await channel.assertExchange(gatewayExchange, 'topic', {
          durable: true,
        });
      },
    });

    this.consumerChannel = this.connection.createChannel({
      json: false,
      setup: async (channel: Channel) => {
        await channel.assertExchange(gatewayExchange, 'topic', {
          durable: true,
        });
        await channel.assertQueue(indexerQueue, { durable: true });
        await channel.assertQueue(rpcQueue, { durable: true });
        // Keep indexer event aggregation order deterministic.
        // With higher prefetch, messages from the same tx/block can race
        // (e.g. LiquidityAdded before PoolCreated graph upsert).
        await channel.prefetch(1);

        await channel.consume(
          indexerQueue,
          (msg) => {
            void this.handleIndexerMessage(channel, msg);
          },
          { noAck: false },
        );

        await channel.consume(
          rpcQueue,
          (msg) => {
            void this.handleRpcMessage(channel, msg);
          },
          { noAck: false },
        );

        this.logger.log(
          `Consuming queues: ${indexerQueue} (indexer), ${rpcQueue} (RPC)`,
        );
      },
    });

    await this.publishChannel.waitForConnect();
    await this.consumerChannel.waitForConnect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.publishChannel?.close();
    await this.consumerChannel?.close();
    await this.connection?.close();
  }

  /**
   * Publish a JSON payload to the gateway topic exchange.
   */
  async publishToGateway(
    routingKey: string,
    payload: unknown,
  ): Promise<boolean> {
    if (!this.publishChannel) {
      this.logger.error('Publish channel not ready');
      return false;
    }
    const { gatewayExchange } = this.rabbit;
    return this.publishChannel.publish(
      gatewayExchange,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true, contentType: 'application/json' },
    );
  }

  private summarizeIndexerPayloadForLog(parsed: unknown): string {
    if (typeof parsed !== 'object' || parsed === null) {
      return typeof parsed === 'string'
        ? `string(len=${parsed.length})`
        : String(parsed);
    }
    const p = parsed as Record<string, unknown>;
    const id = typeof p.id === 'string' ? p.id : '(no id)';
    const type = typeof p.type === 'string' ? p.type : '(no type)';
    return `id=${id} type=${type}`;
  }

  private async handleIndexerMessage(
    channel: Channel,
    msg: ConsumeMessage | null,
  ): Promise<void> {
    if (!msg) return;
    const { gatewayIndexerRoutingKey } = this.rabbit;
    try {
      const body = msg.content.toString();
      let parsed: unknown = body;
      try {
        parsed = JSON.parse(body) as unknown;
      } catch {
        /* raw string payload */
      }

      this.logger.log(
        `RabbitMQ message from indexer queue (${msg.content.length} bytes): ${this.summarizeIndexerPayloadForLog(parsed)}`,
      );

      // First-class ingestion hook (OHLCV builders, persistence, etc.).
      await this.indexerEvents.onIndexerEvent(parsed);
      await this.runPostPersistAggregationEntry(parsed);

      await this.brokerGatewayWsFanout.fanOutFromIndexerPayload(parsed);
      await this.brokerGatewayHttpCachePublish.publishAfterIndexerFanout(
        parsed,
      );

      const forwarded = {
        source: 'indexer',
        receivedAt: new Date().toISOString(),
        payload: parsed,
      };
      const sent = await this.publishToGateway(
        gatewayIndexerRoutingKey,
        forwarded,
      );
      if (!sent) {
        this.logger.warn('publishToGateway returned false; requeue');
        channel.nack(msg, false, true);
        return;
      }
      channel.ack(msg);
    } catch (err) {
      this.logger.error(
        `Indexer message handling failed: ${err instanceof Error ? err.message : err}`,
      );
      const isRetryable = err instanceof RetryableAggregationError;
      const shouldRequeue = isRetryable && !msg.fields.redelivered;
      channel.nack(msg, false, shouldRequeue);
    }
  }

  /**
   * Runs the broker aggregation entrypoint after successful `indexed_events` persistence.
   * Keep this call after `onIndexerEvent()` so all downstream jobs can rely on broker DB records.
   */
  private async runPostPersistAggregationEntry(payload: unknown): Promise<void> {
    const { swapPool } = await this.indexerAggregation.aggregatePayload(payload);
    if (swapPool) {
      const blockTs = this.extractBlockTs(payload);
      try {
        await this.brokerGatewayWsFanout.fanOutPairOhlcvFromPool(swapPool, blockTs);
      } catch (err) {
        this.logger.warn(
          `pair OHLCV fanout failed pool=${swapPool}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  private extractBlockTs(payload: unknown): number {
    if (typeof payload !== 'object' || payload === null) return Math.floor(Date.now() / 1000);
    const p = payload as Record<string, unknown>;
    const raw = p.blockTimestamp;
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.floor(raw);
    if (typeof raw === 'string') {
      const n = Number(raw);
      if (Number.isFinite(n)) return Math.floor(n > 1e12 ? n / 1000 : n);
    }
    return Math.floor(Date.now() / 1000);
  }

  private async handleRpcMessage(
    channel: Channel,
    msg: ConsumeMessage | null,
  ): Promise<void> {
    if (!msg) return;
    const { replyTo, correlationId } = msg.properties;
    if (!replyTo) {
      this.logger.warn('RPC message missing replyTo; dropping');
      channel.ack(msg);
      return;
    }
    try {
      const bodyText = msg.content.toString();
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(bodyText) as Record<string, unknown>;
      } catch {
        body = { raw: bodyText };
      }
      const action = typeof body.action === 'string' ? body.action : 'ping';
      const envelope: BrokerGatewayRpcRequestDto = {
        action: action === 'apiInvoke' ? 'apiInvoke' : 'ping',
        request:
          body.request !== undefined && typeof body.request === 'object'
            ? (body.request as BrokerGatewayRpcRequestDto['request'])
            : undefined,
      };
      const response = await this.gatewayRpcInvoke.handleRpcEnvelope(envelope);
      /** Keep legacy `{ action: 'ping', ... }` shape for existing gateway `GET .../ping`. */
      const replyPayload =
        action === 'ping' && response.ok && response.body !== undefined
          ? response.body
          : response;

      channel.sendToQueue(
        replyTo,
        Buffer.from(JSON.stringify(replyPayload)),
        { correlationId, persistent: true },
      );
      channel.ack(msg);
    } catch (err) {
      this.logger.error(
        `RPC handling failed: ${err instanceof Error ? err.message : err}`,
      );
      channel.nack(msg, false, true);
    }
  }
}
