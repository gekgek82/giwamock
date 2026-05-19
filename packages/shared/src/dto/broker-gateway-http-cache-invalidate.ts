/**
 * Broker → gateway (RabbitMQ topic exchange): drop matching HTTP GET cache keys.
 *
 * Gateway stores keys as `METHOD:req.originalUrl` (e.g. `GET:/swap-routes?from=…`).
 * Each `keyPrefix` is matched with a trailing wildcard against the Redis key namespace.
 */
export const BROKER_GATEWAY_HTTP_CACHE_INVALIDATE_SCHEMA =
  'broker.gateway.http-cache-invalidate/v1' as const;

export interface BrokerGatewayHttpCacheInvalidateV1 {
  schema: typeof BROKER_GATEWAY_HTTP_CACHE_INVALIDATE_SCHEMA;
  /** Prefixes of internal cache keys, e.g. `GET:/indexed-events`, `GET:/spot-pairs/by-address/0x…`. */
  keyPrefixes: string[];
}

export function isBrokerGatewayHttpCacheInvalidateV1(
  v: unknown,
): v is BrokerGatewayHttpCacheInvalidateV1 {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (o.schema !== BROKER_GATEWAY_HTTP_CACHE_INVALIDATE_SCHEMA) return false;
  if (!Array.isArray(o.keyPrefixes)) return false;
  return o.keyPrefixes.every((p) => typeof p === 'string' && p.length > 0);
}
