/**
 * Gateway ↔ broker RabbitMQ RPC envelope (same logical shape as HTTP for async fan-out).
 */

export interface BrokerGatewayHttpLikeRequest {
  method: string;
  /** Path without host, e.g. `/spot-tokens/by-address/0x...` or `spot-tokens/...` (broker normalizes). */
  path: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
}

/** Body sent on `broker.rpc` queue (gateway → broker). */
export interface BrokerGatewayRpcRequestDto {
  action: 'ping' | 'apiInvoke';
  /** Required when `action === 'apiInvoke'`. */
  request?: BrokerGatewayHttpLikeRequest;
}

/** JSON returned on AMQP `replyTo` (broker → gateway). */
export interface BrokerGatewayRpcResponseDto {
  ok: boolean;
  statusCode: number;
  /** Serialized HTTP-like body when `ok`. */
  body?: unknown;
  error?: string;
}
