import {
  BROKER_GATEWAY_WS_EMIT_SCHEMA,
  type BrokerGatewayWsEmitV1,
} from '@giwater/shared';

export function wsEmit(
  channel: string,
  event: string,
  data: unknown,
): BrokerGatewayWsEmitV1 {
  return {
    schema: BROKER_GATEWAY_WS_EMIT_SCHEMA,
    channel,
    event,
    data,
  };
}
