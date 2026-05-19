import {
  BROKER_GATEWAY_HTTP_CACHE_INVALIDATE_SCHEMA,
  type BrokerGatewayHttpCacheInvalidateV1,
  type CLLiquidityAddedIndexerBrokerPayload,
  type CLPoolCreatedIndexerBrokerPayload,
  type IndexerBrokerQueuePayload,
  type LiquidityAddedIndexerBrokerPayload,
  type PoolCreatedIndexerBrokerPayload,
  type SwapIndexerBrokerPayload,
} from '@giwater/shared';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function addrKey(a: string): string {
  return a.trim().toLowerCase();
}

/** Internal gateway HTTP cache key prefix: `METHOD:path…` (matches `req.originalUrl`). */
function get(pathFromSlash: string): string {
  return `GET:${pathFromSlash}`;
}

function broadListPrefixes(): string[] {
  return [
    get('/indexed-events'),
    get('/swap-routes'),
    get('/spot-tokens/leaderboard'),
    get('/spot-tokens/recently-created'),
    get('/spot-pairs/leaderboard'),
    get('/spot-pairs/recently-created'),
  ];
}

function tokenByAddressPrefixes(addr: string): string[] {
  return [get(`/spot-tokens/by-address/${addrKey(addr)}`)];
}

function pairByPoolPrefixes(pool: string): string[] {
  const p = addrKey(pool);
  return [
    get(`/spot-pairs/by-address/${p}`),
    get(`/spot-pairs/by-address/${p}/cl-dynamic-fee`),
  ];
}

/**
 * Maps an indexer queue JSON body to HTTP cache key prefixes for the gateway edge cache.
 */
export function routeIndexerPayloadToHttpCacheInvalidate(
  parsed: unknown,
): BrokerGatewayHttpCacheInvalidateV1 | null {
  if (!isRecord(parsed)) return null;
  const type = parsed.type;
  if (typeof type !== 'string') return null;

  const prefixes = new Set<string>();
  const add = (xs: string[]) => {
    for (const x of xs) prefixes.add(x);
  };

  switch (type as IndexerBrokerQueuePayload['type']) {
    case 'setup':
      return null;
    case 'PoolCreated': {
      const b = parsed as unknown as PoolCreatedIndexerBrokerPayload;
      add(broadListPrefixes());
      add(pairByPoolPrefixes(b.pool));
      add(tokenByAddressPrefixes(b.token0));
      add(tokenByAddressPrefixes(b.token1));
      break;
    }
    case 'CLPoolCreated': {
      const b = parsed as unknown as CLPoolCreatedIndexerBrokerPayload;
      add(broadListPrefixes());
      add(pairByPoolPrefixes(b.pool));
      add(tokenByAddressPrefixes(b.token0));
      add(tokenByAddressPrefixes(b.token1));
      break;
    }
    case 'LiquidityAdded': {
      const b = parsed as unknown as LiquidityAddedIndexerBrokerPayload;
      add(broadListPrefixes());
      add(tokenByAddressPrefixes(b.token0));
      add(tokenByAddressPrefixes(b.token1));
      break;
    }
    case 'CLLiquidityAdded': {
      const b = parsed as unknown as CLLiquidityAddedIndexerBrokerPayload;
      add(broadListPrefixes());
      add(tokenByAddressPrefixes(b.token0));
      add(tokenByAddressPrefixes(b.token1));
      break;
    }
    case 'Swap': {
      const b = parsed as unknown as SwapIndexerBrokerPayload;
      add(broadListPrefixes());
      add(tokenByAddressPrefixes(b.tokenIn));
      add(tokenByAddressPrefixes(b.tokenOut));
      break;
    }
    default:
      add(broadListPrefixes());
      break;
  }

  const keyPrefixes = [...prefixes];
  if (keyPrefixes.length === 0) return null;
  return {
    schema: BROKER_GATEWAY_HTTP_CACHE_INVALIDATE_SCHEMA,
    keyPrefixes,
  };
}
