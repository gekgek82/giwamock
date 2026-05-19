import { Injectable } from '@nestjs/common';
import type { BrokerGatewayWsEmitV1 } from '@giwater/shared';
import { isBrokerGatewayWsEmitV1 } from '@giwater/shared';
import { Observable, Subject } from 'rxjs';

/**
 * Bridges RabbitMQ broker notifications into the Socket.IO layer.
 * Structured `BrokerGatewayWsEmitV1` messages are routed to room subscribers;
 * all other payloads are treated as legacy global `notify` broadcasts.
 */
@Injectable()
export class GatewayEventsService {
  private readonly notify$ = new Subject<unknown>();
  private readonly channelWs$ = new Subject<BrokerGatewayWsEmitV1>();

  get brokerNotifications(): Observable<unknown> {
    return this.notify$.asObservable();
  }

  get channelWsEmits(): Observable<BrokerGatewayWsEmitV1> {
    return this.channelWs$.asObservable();
  }

  emitBrokerNotification(payload: unknown): void {
    if (isBrokerGatewayWsEmitV1(payload)) {
      this.channelWs$.next(payload);
      return;
    }
    this.notify$.next(payload);
  }
}
