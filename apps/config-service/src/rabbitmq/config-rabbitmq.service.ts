import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import type { BrokerGatewayRpcRequestDto } from '@giwater/shared';
import type { ConfigServiceConfig } from '../config/configuration.js';
import { ConfigRpcInvokeService } from '../gateway-rpc/config-rpc-invoke.service.js';

@Injectable()
export class ConfigRabbitmqService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ConfigRabbitmqService.name);
  private connection?: ReturnType<typeof amqp.connect>;
  private consumerChannel?: ChannelWrapper;

  constructor(
    private readonly configService: ConfigService,
    private readonly rpcInvoke: ConfigRpcInvokeService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const { url, rpcQueue } = this.configService.getOrThrow<ConfigServiceConfig['rabbitmq']>('rabbitmq');

    this.connection = amqp.connect([url], { reconnectTimeInSeconds: 5 });

    this.connection.on('connect', () =>
      this.logger.log('RabbitMQ connection established'),
    );
    this.connection.on('disconnect', (err) =>
      this.logger.warn(`RabbitMQ disconnected: ${(err as { err?: { message?: string } })?.err?.message ?? err}`),
    );

    this.consumerChannel = this.connection.createChannel({
      json: false,
      setup: async (channel: Channel) => {
        await channel.assertQueue(rpcQueue, { durable: true });
        await channel.prefetch(10);
        await channel.consume(
          rpcQueue,
          (msg) => {
            void this.handleRpcMessage(channel, msg);
          },
          { noAck: false },
        );
        this.logger.log(`Consuming RPC queue: ${rpcQueue}`);
      },
    });

    await this.consumerChannel.waitForConnect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumerChannel?.close();
    await this.connection?.close();
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
      const response = await this.rpcInvoke.handleRpcEnvelope(envelope);
      channel.sendToQueue(
        replyTo,
        Buffer.from(JSON.stringify(response)),
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
