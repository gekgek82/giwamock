/**
 * Broker → gateway (RabbitMQ topic exchange) payload for targeted Socket.IO emits.
 * One message = one `{ channel, event, data }` fan-out to clients joined on `channel`.
 */
export const BROKER_GATEWAY_WS_EMIT_SCHEMA = 'broker.gateway.ws.emit/v1' as const;

export interface BrokerGatewayWsEmitV1 {
  schema: typeof BROKER_GATEWAY_WS_EMIT_SCHEMA;
  /** Socket.IO room name (e.g. `pair:0x…`, `token:0x…`). */
  channel: string;
  /** Socket.IO event name delivered to clients in that room (e.g. `onchain.Swap`). */
  event: string;
  data: unknown;
}

export function isBrokerGatewayWsEmitV1(
  v: unknown,
): v is BrokerGatewayWsEmitV1 {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    o.schema === BROKER_GATEWAY_WS_EMIT_SCHEMA &&
    typeof o.channel === 'string' &&
    o.channel.length > 0 &&
    typeof o.event === 'string' &&
    o.event.length > 0 &&
    'data' in o
  );
}
