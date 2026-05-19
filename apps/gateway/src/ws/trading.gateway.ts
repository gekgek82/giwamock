import { Logger, OnModuleDestroy } from '@nestjs/common';
import type {
  BrokerGatewayHttpLikeRequest,
  BrokerGatewayRpcResponseDto,
  BrokerGatewayWsEmitV1,
} from '@giwater/shared';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { merge, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { GatewayEventsService } from '../events/gateway-events.service';
import { GatewayRabbitmqService } from '../rabbitmq/gateway-rabbitmq.service';
import { WsClientChannelsService } from './subscription/ws-client-channels.service';

const wsOrigin =
  process.env.DEV_MODE === 'true'
    ? '*'
    : /^https?:\/\/([a-z0-9-]+\.)?giwater\.finance(:\d+)?$/;

@WebSocketGateway({
  cors: { origin: wsOrigin },
  transports: ['websocket', 'polling'],
  perMessageDeflate: {
    threshold: 512,
  },
})
export class TradingGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  private readonly logger = new Logger(TradingGateway.name);
  private sub?: Subscription;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly gatewayEvents: GatewayEventsService,
    private readonly rabbit: GatewayRabbitmqService,
    private readonly clientChannels: WsClientChannelsService,
  ) {}

  afterInit(): void {
    type Routed =
      | { kind: 'legacy'; payload: unknown }
      | { kind: 'channel'; emit: BrokerGatewayWsEmitV1 };

    this.sub = merge(
      this.gatewayEvents.brokerNotifications.pipe(
        map((payload): Routed => ({ kind: 'legacy', payload })),
      ),
      this.gatewayEvents.channelWsEmits.pipe(
        map((emit): Routed => ({ kind: 'channel', emit })),
      ),
    ).subscribe((msg) => {
      if (msg.kind === 'legacy') {
        this.server.emit('notify', msg.payload);
        return;
      }
      this.server.to(msg.emit.channel).emit(msg.emit.event, msg.emit.data);
    });
    this.logger.log('Socket.IO gateway ready (namespace /)');
  }

  onModuleDestroy(): void {
    this.sub?.unsubscribe();
  }

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected ${client.id}`);
  }

  /**
   * Subscribe to broker fan-out channels (Socket.IO rooms). Body: `{ channels: string[] }`
   * or a bare `string[]`. Channel format: `pair:0x…40 hex…`, `token:0x…`, or `spot-tokens:leaderboards`.
   */
  @SubscribeMessage('channels.subscribe')
  handleChannelsSubscribe(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): { event: string; data: unknown } {
    const raw = this.clientChannels.parseChannelList(body);
    const channels = this.clientChannels.subscribe(client, raw);
    return {
      event: 'channels.subscribed',
      data: { clientId: client.id, channels },
    };
  }

  @SubscribeMessage('channels.unsubscribe')
  handleChannelsUnsubscribe(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): { event: string; data: unknown } {
    const raw = this.clientChannels.parseChannelList(body);
    const channels = this.clientChannels.unsubscribe(client, raw);
    return {
      event: 'channels.unsubscribed',
      data: { clientId: client.id, channels },
    };
  }

  @SubscribeMessage('ping')
  handlePing(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
  ): { event: string; data: unknown } {
    return {
      event: 'pong',
      data: { ts: new Date().toISOString(), echo: data ?? null, id: client.id },
    };
  }

  /**
   * Same logical contract as `POST /api/v1/broker/invoke`: HTTP-shaped broker RPC over AMQP.
   * Message body: `{ method, path, query?, body? }` (`BrokerGatewayHttpLikeRequest`).
   */
  @SubscribeMessage('broker.invoke')
  async handleBrokerInvoke(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<{ event: string; data: unknown }> {
    const body = (
      typeof data === 'object' && data !== null ? data : {}
    ) as Partial<BrokerGatewayHttpLikeRequest>;
    if (!body.method?.trim() || !body.path?.trim()) {
      return {
        event: 'broker.invoke.error',
        data: {
          error: '`method` and `path` are required',
          clientId: client.id,
        },
      };
    }
    try {
      const raw = (await this.rabbit.rpcToBroker({
        action: 'apiInvoke',
        request: {
          method: body.method,
          path: body.path,
          query: body.query ?? {},
          body: body.body ?? null,
        },
      })) as BrokerGatewayRpcResponseDto;
      return {
        event: 'broker.invoke.result',
        data: { clientId: client.id, result: raw },
      };
    } catch (e) {
      return {
        event: 'broker.invoke.error',
        data: {
          clientId: client.id,
          error: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }
}
