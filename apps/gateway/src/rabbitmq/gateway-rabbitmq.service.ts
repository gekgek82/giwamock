import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import { randomUUID } from 'node:crypto';
import type { GatewayConfig } from '../config/configuration';
import { GatewayEventsService } from '../events/gateway-events.service';
import {
  GatewayHttpCacheInvalidationService,
  GatewayHttpCacheUpsertService,
} from '../http-cache';

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

@Injectable()
export class GatewayRabbitmqService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(GatewayRabbitmqService.name);
  private connection?: ReturnType<typeof amqp.connect>;
  private rpcChannel?: ChannelWrapper;
  private notifyChannel?: ChannelWrapper;
  private replyQueueName?: string;
  private readonly pending = new Map<string, Pending>();

  constructor(
    private readonly configService: ConfigService,
    private readonly gatewayEvents: GatewayEventsService,
    private readonly httpCacheInvalidation: GatewayHttpCacheInvalidationService,
    private readonly httpCacheUpsert: GatewayHttpCacheUpsertService,
  ) {}

  private get cfg(): GatewayConfig['rabbitmq'] {
    return this.configService.getOrThrow<GatewayConfig['rabbitmq']>('rabbitmq');
  }

  async onApplicationBootstrap(): Promise<void> {
    const { url, gatewayExchange, notificationBindingKey, brokerRpcQueue } =
      this.cfg;

    this.connection = amqp.connect([url], { reconnectTimeInSeconds: 5 });
    this.connection.on('connect', () =>
      this.logger.log('RabbitMQ connection established'),
    );

    this.rpcChannel = this.connection.createChannel({
      json: false,
      setup: async (channel: Channel) => {
        const { queue } = await channel.assertQueue('', {
          exclusive: true,
          autoDelete: true,
        });
        this.replyQueueName = queue;
        await channel.consume(
          queue,
          (msg) => this.handleRpcReply(channel, msg),
          { noAck: false },
        );
        this.logger.log(`RPC reply queue: ${queue} → ${brokerRpcQueue}`);
      },
    });

    this.notifyChannel = this.connection.createChannel({
      json: false,
      setup: async (channel: Channel) => {
        await channel.assertExchange(gatewayExchange, 'topic', {
          durable: true,
        });
        const { queue } = await channel.assertQueue('', {
          exclusive: false,
          durable: false,
          autoDelete: true,
        });
        await channel.bindQueue(queue, gatewayExchange, notificationBindingKey);
        await channel.consume(
          queue,
          (msg) => {
            void this.handleBrokerNotify(channel, msg);
          },
          { noAck: false },
        );
        this.logger.log(
          `Notify queue ${queue} bound to ${gatewayExchange} (${notificationBindingKey})`,
        );
      },
    });

    await this.rpcChannel.waitForConnect();
    await this.notifyChannel.waitForConnect();
  }

  async onModuleDestroy(): Promise<void> {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('Gateway shutting down'));
    }
    this.pending.clear();
    await this.rpcChannel?.close();
    await this.notifyChannel?.close();
    await this.connection?.close();
  }

  /**
   * Send JSON-RPC style message to broker queue; broker must reply on replyTo.
   */
  async rpcToBroker(body: Record<string, unknown>): Promise<unknown> {
    const ch = this.rpcChannel;
    const replyTo = this.replyQueueName;
    if (!ch || !replyTo) {
      throw new Error('RabbitMQ RPC channel not ready');
    }

    const correlationId = randomUUID();
    const { brokerRpcQueue, rpcTimeoutMs } = this.cfg;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(correlationId);
        reject(new Error(`Broker RPC timeout after ${rpcTimeoutMs}ms`));
      }, rpcTimeoutMs);

      this.pending.set(correlationId, { resolve, reject, timer });

      void ch
        .sendToQueue(
          brokerRpcQueue,
          Buffer.from(JSON.stringify(body)),
          {
            correlationId,
            replyTo,
            persistent: true,
            contentType: 'application/json',
          },
        )
        .then((sent) => {
          if (!sent) {
            clearTimeout(timer);
            this.pending.delete(correlationId);
            reject(new Error('Failed to send RPC (channel backpressure?)'));
          }
        })
        .catch((err: Error) => {
          clearTimeout(timer);
          this.pending.delete(correlationId);
          reject(err);
        });
    });
  }

  async rpcToConfigService(body: Record<string, unknown>): Promise<unknown> {
    const ch = this.rpcChannel;
    const replyTo = this.replyQueueName;
    if (!ch || !replyTo) {
      throw new Error('RabbitMQ RPC channel not ready');
    }

    const correlationId = randomUUID();
    const { configServiceRpcQueue, rpcTimeoutMs } = this.cfg;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(correlationId);
        reject(new Error(`Config-service RPC timeout after ${rpcTimeoutMs}ms`));
      }, rpcTimeoutMs);

      this.pending.set(correlationId, { resolve, reject, timer });

      void ch
        .sendToQueue(
          configServiceRpcQueue,
          Buffer.from(JSON.stringify(body)),
          {
            correlationId,
            replyTo,
            persistent: true,
            contentType: 'application/json',
          },
        )
        .then((sent) => {
          if (!sent) {
            clearTimeout(timer);
            this.pending.delete(correlationId);
            reject(new Error('Failed to send RPC to config-service (channel backpressure?)'));
          }
        })
        .catch((err: Error) => {
          clearTimeout(timer);
          this.pending.delete(correlationId);
          reject(err);
        });
    });
  }

  private handleRpcReply(channel: Channel, msg: ConsumeMessage | null): void {
    if (!msg) return;
    const id = msg.properties.correlationId as string | undefined;
    const pending = id ? this.pending.get(id) : undefined;
    if (!pending) {
      channel.ack(msg);
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(id!);
    try {
      const text = msg.content.toString();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        /* plain text */
      }
      pending.resolve(parsed);
    } catch (e) {
      pending.reject(e instanceof Error ? e : new Error(String(e)));
    }
    channel.ack(msg);
  }

  private async handleBrokerNotify(
    channel: Channel,
    msg: ConsumeMessage | null,
  ): Promise<void> {
    if (!msg) return;
    try {
      const text = msg.content.toString();
      let payload: unknown = text;
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        /* keep string */
      }
      const handledUpsert =
        await this.httpCacheUpsert.applyBrokerPayload(payload);
      if (!handledUpsert) {
        const invalidateOnly =
          await this.httpCacheInvalidation.applyBrokerPayload(payload);
        if (!invalidateOnly) {
          this.gatewayEvents.emitBrokerNotification(payload);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Notify parse error: ${err instanceof Error ? err.message : err}`,
      );
    }
    channel.ack(msg);
  }
}
