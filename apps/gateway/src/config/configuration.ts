export interface GatewayConfig {
  port: number;
  redis: {
    url: string;
    keyPrefix: string;
    /**
     * Fresh window (seconds): response is treated as fresh (HIT).
     * After this, the same Redis entry may still be served until it expires (STALE), if staleExtraTtlSec > 0.
     */
    defaultTtlSec: number;
    /** Extra seconds after the fresh window where the entry may still be served as stale before Redis deletes it. */
    staleExtraTtlSec: number;
    /** Path prefixes of `req.originalUrl` to skip caching (e.g. Swagger, gateway liveness). */
    excludeOriginalUrlPrefixes: string[];
  };
  rabbitmq: {
    url: string;
    brokerRpcQueue: string;
    configServiceRpcQueue: string;
    gatewayExchange: string;
    /** AMQP routing pattern for binding the per-instance notification queue (e.g. #). */
    notificationBindingKey: string;
    rpcTimeoutMs: number;
  };
}

function parseExcludePrefixes(raw: string | undefined): string[] {
  if (raw?.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ['/api/health', '/api/docs'];
}

export default (): GatewayConfig => ({
  port: parseInt(process.env.PORT ?? '3046', 10),
  redis: {
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'gateway:http:',
    defaultTtlSec: parseInt(process.env.REDIS_HTTP_CACHE_TTL_SEC ?? '3', 10),
    staleExtraTtlSec: parseInt(
      process.env.REDIS_HTTP_CACHE_STALE_EXTRA_TTL_SEC ?? '60',
      10,
    ),
    excludeOriginalUrlPrefixes: parseExcludePrefixes(
      process.env.REDIS_HTTP_CACHE_EXCLUDE_URL_PREFIXES,
    ),
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
    brokerRpcQueue:
      process.env.RABBITMQ_BROKER_RPC_QUEUE ?? 'broker.rpc',
    configServiceRpcQueue:
      process.env.CONFIG_SERVICE_RPC_QUEUE ?? 'config-service.rpc',
    gatewayExchange:
      process.env.RABBITMQ_GATEWAY_EXCHANGE ?? 'giwater.gateway',
    notificationBindingKey:
      process.env.RABBITMQ_GATEWAY_BINDING_KEY ?? '#',
    rpcTimeoutMs: parseInt(process.env.RABBITMQ_RPC_TIMEOUT_MS ?? '15000', 10),
  },
});
