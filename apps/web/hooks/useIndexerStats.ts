/**
 * React Hooks for GiwaTer Indexer API
 *
 * These hooks use @tanstack/react-query for data fetching, caching, and
 * automatic refetching.
 *
 * @see docs/client-api-guide.md
 */

import { useQuery } from "@tanstack/react-query";
import {
  indexerApi,
  type GlobalStats,
  type PoolStats,
  type PoolsStatsResponse,
  type PoolStatsQuery,
  type TokenPrice,
  type TokenPricesResponse,
} from "@/lib/indexerApi";

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Query key factory for indexer API queries
 *
 * Use these keys for cache invalidation:
 * ```typescript
 * import { queryClient } from '@/context/Providers';
 * import { indexerQueryKeys } from '@/hooks/useIndexerStats';
 *
 * // Invalidate all pool stats
 * queryClient.invalidateQueries({ queryKey: indexerQueryKeys.pools.all });
 *
 * // Invalidate specific pool
 * queryClient.invalidateQueries({
 *   queryKey: indexerQueryKeys.pools.detail(poolAddress)
 * });
 * ```
 */
const BASE_KEY = ["indexer"] as const;
const POOLS_KEY = [...BASE_KEY, "pools"] as const;
const TOKENS_KEY = [...BASE_KEY, "tokens"] as const;

export const indexerQueryKeys = {
  all: BASE_KEY,
  globalStats: () => [...BASE_KEY, "globalStats"] as const,
  pools: {
    all: POOLS_KEY,
    list: (query?: PoolStatsQuery) =>
      [...POOLS_KEY, "list", query ?? {}] as const,
    detail: (poolAddress: string) =>
      [...POOLS_KEY, "detail", poolAddress] as const,
  },
  tokens: {
    all: TOKENS_KEY,
    prices: () => [...TOKENS_KEY, "prices"] as const,
    price: (tokenAddress: string) =>
      [...TOKENS_KEY, "price", tokenAddress] as const,
  },
};

// ============================================================================
// Stale Time Configuration
// ============================================================================

/**
 * Default stale time for indexer data (1 minute)
 * Matches the indexer's update interval
 */
const DEFAULT_STALE_TIME = 60 * 1000;

// ============================================================================
// Global Stats Hook
// ============================================================================

export interface UseGlobalStatsOptions {
  /** Enable/disable the query */
  enabled?: boolean;
  /** Custom stale time in ms (default: 60000) */
  staleTime?: number;
  /** Refetch interval in ms */
  refetchInterval?: number;
}

/**
 * Hook to get global protocol statistics
 *
 * @param options - Query options
 * @returns Query result with global stats
 *
 * @example
 * ```tsx
 * function GlobalStatsCard() {
 *   const { data, isLoading, error } = useGlobalStats();
 *
 *   if (isLoading) return <Skeleton />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <p>TVL: ${parseFloat(data.totalTVL).toLocaleString()}</p>
 *       <p>24h Volume: ${parseFloat(data.totalVolume24h).toLocaleString()}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useGlobalStats(options: UseGlobalStatsOptions = {}) {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    refetchInterval,
  } = options;

  return useQuery<GlobalStats, Error>({
    queryKey: indexerQueryKeys.globalStats(),
    queryFn: () => indexerApi.getGlobalStats(),
    staleTime,
    refetchInterval,
    enabled,
  });
}

// ============================================================================
// Pool Stats Hooks
// ============================================================================

export interface UseAllPoolsStatsOptions extends PoolStatsQuery {
  /** Enable/disable the query */
  enabled?: boolean;
  /** Custom stale time in ms (default: 60000) */
  staleTime?: number;
  /** Refetch interval in ms */
  refetchInterval?: number;
}

/**
 * Hook to get statistics for all pools
 *
 * @param options - Query and fetch options
 * @returns Query result with paginated pool stats
 *
 * @example
 * ```tsx
 * function PoolsTable() {
 *   const { data, isLoading } = useAllPoolsStats({
 *     sortBy: 'tvl',
 *     sortOrder: 'desc',
 *     limit: 20,
 *   });
 *
 *   return (
 *     <table>
 *       {data?.pools.map(pool => (
 *         <tr key={pool.poolAddress}>
 *           <td>{pool.token0Symbol}/{pool.token1Symbol}</td>
 *           <td>${parseFloat(pool.tvl).toLocaleString()}</td>
 *         </tr>
 *       ))}
 *     </table>
 *   );
 * }
 * ```
 */
export function useAllPoolsStats(options: UseAllPoolsStatsOptions = {}) {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    refetchInterval,
    limit,
    offset,
    sortBy,
    sortOrder,
  } = options;

  const query: PoolStatsQuery = { limit, offset, sortBy, sortOrder };

  return useQuery<PoolsStatsResponse, Error>({
    queryKey: indexerQueryKeys.pools.list(query),
    queryFn: () => indexerApi.getAllPoolsStats(query),
    staleTime,
    refetchInterval,
    enabled,
  });
}

export interface UsePoolStatsOptions {
  /** Enable/disable the query */
  enabled?: boolean;
  /** Custom stale time in ms (default: 60000) */
  staleTime?: number;
  /** Refetch interval in ms */
  refetchInterval?: number;
}

/**
 * Hook to get statistics for a specific pool
 *
 * @param poolAddress - Pool contract address
 * @param options - Query options
 * @returns Query result with pool stats
 *
 * @example
 * ```tsx
 * function PoolDetail({ poolAddress }) {
 *   const { data: stats, isLoading, error } = usePoolStatsFromIndexer(poolAddress);
 *
 *   if (isLoading) return <Skeleton />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <h2>{stats.token0Symbol}/{stats.token1Symbol}</h2>
 *       <p>TVL: ${parseFloat(stats.tvl).toLocaleString()}</p>
 *       <p>24h Volume: ${parseFloat(stats.volume24h).toLocaleString()}</p>
 *       <p>APR: {stats.apr7d}%</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePoolStatsFromIndexer(
  poolAddress: string | undefined,
  options: UsePoolStatsOptions = {},
) {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    refetchInterval,
  } = options;

  return useQuery<PoolStats, Error>({
    queryKey: indexerQueryKeys.pools.detail(poolAddress ?? ""),
    queryFn: () => indexerApi.getPoolStats(poolAddress!),
    staleTime,
    refetchInterval,
    enabled: enabled && !!poolAddress,
  });
}

// ============================================================================
// Token Price Hooks
// ============================================================================

export interface UseTokenPricesOptions {
  /** Enable/disable the query */
  enabled?: boolean;
  /** Custom stale time in ms (default: 60000) */
  staleTime?: number;
  /** Refetch interval in ms */
  refetchInterval?: number;
}

/**
 * Hook to get USD prices for all tracked tokens
 *
 * @param options - Query options
 * @returns Query result with token prices
 *
 * @example
 * ```tsx
 * function TokenPrices() {
 *   const { data, isLoading } = useAllTokenPrices();
 *
 *   return (
 *     <ul>
 *       {data?.tokens.map(token => (
 *         <li key={token.address}>
 *           {token.symbol}: ${token.priceUSD}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useAllTokenPrices(options: UseTokenPricesOptions = {}) {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    refetchInterval,
  } = options;

  return useQuery<TokenPricesResponse, Error>({
    queryKey: indexerQueryKeys.tokens.prices(),
    queryFn: () => indexerApi.getAllTokenPrices(),
    staleTime,
    refetchInterval,
    enabled,
  });
}

/**
 * Hook to get USD price for a specific token
 *
 * @param tokenAddress - Token contract address
 * @param options - Query options
 * @returns Query result with token price
 *
 * @example
 * ```tsx
 * function TokenPrice({ tokenAddress }) {
 *   const { data: price, isLoading } = useTokenPriceFromIndexer(tokenAddress);
 *
 *   if (isLoading) return <Skeleton />;
 *
 *   return <span>${price?.priceUSD}</span>;
 * }
 * ```
 */
export function useTokenPriceFromIndexer(
  tokenAddress: string | undefined,
  options: UseTokenPricesOptions = {},
) {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME,
    refetchInterval,
  } = options;

  return useQuery<TokenPrice, Error>({
    queryKey: indexerQueryKeys.tokens.price(tokenAddress ?? ""),
    queryFn: () => indexerApi.getTokenPrice(tokenAddress!),
    staleTime,
    refetchInterval,
    enabled: enabled && !!tokenAddress,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format USD value for display
 * Handles string input from API
 */
export function formatUSD(value: string | undefined | null): string {
  if (!value) return "-";

  const num = parseFloat(value);
  if (isNaN(num) || num === 0) return "-";

  if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(2)}B`;
  }

  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  }

  if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(2)}K`;
  }

  if (num < 0.01 && num > 0) {
    return "<$0.01";
  }

  return `$${num.toFixed(2)}`;
}

/**
 * Format APR value for display
 * Handles string input from API (value is already in percentage, e.g., "10.95" = 10.95%)
 */
export function formatAPR(value: string | undefined | null): string {
  if (!value) return "-";

  const num = parseFloat(value);
  if (isNaN(num)) return "-";
  if (num === 0) return "0%";

  if (num >= 10_000) {
    return `${(num / 1_000).toFixed(1)}K%`;
  }

  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K%`;
  }

  if (num >= 100) {
    return `${num.toFixed(0)}%`;
  }

  if (num >= 10) {
    return `${num.toFixed(1)}%`;
  }

  return `${num.toFixed(2)}%`;
}

/**
 * Format large numbers with commas
 */
export function formatNumber(
  value: string | number | undefined | null,
): string {
  if (value === undefined || value === null) return "-";

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";

  return num.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

/**
 * Format transaction count
 */
export function formatTxCount(count: number | undefined | null): string {
  if (count === undefined || count === null) return "-";

  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }

  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }

  return count.toString();
}
