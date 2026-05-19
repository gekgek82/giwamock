import type { BrokerGatewayWsEmitV1 } from './broker-gateway-ws-emit';
import { isBrokerGatewayWsEmitV1 } from './broker-gateway-ws-emit';

/**
 * Broker → gateway: replace specific HTTP GET cache entries (no broker round-trip on next read).
 *
 * `entries[].key` must match the gateway Redis internal key: `` `${method}:${req.originalUrl}` ``.
 */
export const BROKER_GATEWAY_HTTP_CACHE_UPSERT_SCHEMA =
  'broker.gateway.http-cache-upsert/v1' as const;

export interface BrokerGatewayHttpCacheUpsertEntryV1 {
  key: string;
  body: unknown;
}

export interface BrokerGatewayHttpCacheUpsertV1 {
  schema: typeof BROKER_GATEWAY_HTTP_CACHE_UPSERT_SCHEMA;
  entries: BrokerGatewayHttpCacheUpsertEntryV1[];
  /** When set, gateway applies this Socket.IO emit after writing Redis. */
  wsEmit?: BrokerGatewayWsEmitV1;
}

export function isBrokerGatewayHttpCacheUpsertV1(
  v: unknown,
): v is BrokerGatewayHttpCacheUpsertV1 {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (o.schema !== BROKER_GATEWAY_HTTP_CACHE_UPSERT_SCHEMA) return false;
  if (!Array.isArray(o.entries) || o.entries.length === 0) return false;
  for (const e of o.entries) {
    if (typeof e !== 'object' || e === null) return false;
    const row = e as Record<string, unknown>;
    if (typeof row.key !== 'string' || row.key.length === 0) return false;
    if (!('body' in row)) return false;
  }
  if (o.wsEmit !== undefined && !isBrokerGatewayWsEmitV1(o.wsEmit)) {
    return false;
  }
  return true;
}
