import { Subject } from "rxjs";

export interface GatewayWsEvent {
  channel: string;
  event: string;
  data: unknown;
}

export const gatewayEventBus$ = new Subject<GatewayWsEvent>();
