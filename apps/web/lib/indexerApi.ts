/**
 * GiwaTer Indexer API Client
 *
 * Provides access to indexed blockchain data including:
 * - Global protocol statistics
 * - Pool statistics (TVL, volume, fees, APR)
 * - Token prices
 *
 * @see docs/client-api-guide.md
 */

import type {
  GlobalStats,
  PoolStats,
  PoolsStatsResponse,
  PoolStatsQuery,
  TokenPrice,
  TokenPricesResponse,
  HealthResponse,
  ContractAddresses,
  TokenSearchResponse,
  RegisterTokenResponse,
  EpochInfo,
  VotePoolsQuery,
  VotePoolsResponse,
  LiquidityDistributionResponse,
} from "@/types/indexer";
import type { ActiveBanner } from "@/types/banner";
import {
  apiFetch,
  buildQuery,
  type ApiClientConfig,
} from "@/lib/apiClient";

// ============================================================================
// Configuration
// ============================================================================

import { INDEXER_API_URL } from "@/lib/config";

const BASE_URL = INDEXER_API_URL;

/**
 * Indexer endpoints are now served by the gateway proxy (`/api/gateway/*`),
 * which is always reachable in this app. Always true.
 */
export function isIndexerConfigured(): boolean {
  return true;
}

/**
 * Get the configured indexer API URL
 */
export function getIndexerApiUrl(): string {
  return BASE_URL;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Custom error class for Indexer API errors
 */
export class IndexerApiError extends Error {
  public statusCode?: number;
  public errorCode?: string;
  public endpoint?: string;

  constructor(
    message: string,
    statusCode?: number,
    errorCode?: string,
    endpoint?: string,
  ) {
    super(message);
    this.name = "IndexerApiError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.endpoint = endpoint;
  }
}

// ============================================================================
// API Client Class
// ============================================================================

/**
 * Indexer API Client
 *
 * Example usage:
 * ```typescript
 * import { indexerApi } from '@/lib/indexerApi';
 *
 * // Get global stats
 * const stats = await indexerApi.getGlobalStats();
 *
 * // Get pool stats with sorting
 * const pools = await indexerApi.getAllPoolsStats({
 *   sortBy: 'tvl',
 *   sortOrder: 'desc',
 *   limit: 10,
 * });
 * ```
 */
class IndexerApi {
  private config: ApiClientConfig;

  constructor(baseUrl: string = BASE_URL) {
    this.config = {
      baseUrl,
      createError: (message, statusCode, errorCode, endpoint) =>
        new IndexerApiError(message, statusCode, errorCode, endpoint),
      isOwnError: (error) => error instanceof IndexerApiError,
      networkErrorLabel: "indexer",
    };
  }

  private fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return apiFetch<T>(this.config, endpoint, options);
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  /**
   * Check server health
   */
  async checkHealth(): Promise<HealthResponse> {
    return this.fetch<HealthResponse>("/health");
  }

  // ==========================================================================
  // Global Stats API
  // ==========================================================================

  /**
   * Get protocol-wide aggregate statistics
   *
   * @returns Global stats including total TVL, volume, fees, and pool count
   */
  async getGlobalStats(): Promise<GlobalStats> {
    return this.fetch<GlobalStats>("/stats");
  }

  // ==========================================================================
  // Pool Stats API
  // ==========================================================================

  /**
   * Get statistics for all pools
   *
   * @param query - Optional query parameters for sorting and pagination
   * @returns Paginated list of pool statistics
   *
   * @example
   * ```typescript
   * // Get top 10 pools by TVL
   * const { pools } = await indexerApi.getAllPoolsStats({
   *   sortBy: 'tvl',
   *   sortOrder: 'desc',
   *   limit: 10,
   * });
   * ```
   */
  async getAllPoolsStats(query?: PoolStatsQuery): Promise<PoolsStatsResponse> {
    const qs = buildQuery({
      limit: query?.limit,
      offset: query?.offset,
      sortBy: query?.sortBy,
      sortOrder: query?.sortOrder,
    });
    return this.fetch<PoolsStatsResponse>(`/pools/stats${qs}`);
  }

  /**
   * Get statistics for a specific pool
   *
   * @param poolAddress - Pool contract address (0x...)
   * @returns Pool statistics including TVL, volume, fees, and APR
   * @throws IndexerApiError with statusCode 404 if pool not found
   */
  async getPoolStats(poolAddress: string): Promise<PoolStats> {
    return this.fetch<PoolStats>(`/pools/${poolAddress}/stats`);
  }

  // ==========================================================================
  // Token Price API
  // ==========================================================================

  /**
   * Get USD prices for all tracked tokens
   *
   * @returns List of token prices
   */
  async getAllTokenPrices(): Promise<TokenPricesResponse> {
    return this.fetch<TokenPricesResponse>("/tokens/prices");
  }

  /**
   * Get USD price for a specific token
   *
   * @param tokenAddress - Token contract address (0x...)
   * @returns Token price information
   * @throws IndexerApiError with statusCode 404 if token not found
   */
  async getTokenPrice(tokenAddress: string): Promise<TokenPrice> {
    return this.fetch<TokenPrice>(`/tokens/${tokenAddress}/price`);
  }

  // ==========================================================================
  // Contract Addresses API
  // ==========================================================================

  /**
   * Get all contract addresses for the current chain
   *
   * @returns Contract addresses including core contracts and registered tokens
   *
   * @example
   * ```typescript
   * const addresses = await indexerApi.getContractAddresses();
   * console.log(addresses.contracts.router); // Router address
   * console.log(addresses.tokens); // List of registered tokens
   * ```
   */
  async getContractAddresses(): Promise<ContractAddresses> {
    return this.fetch<ContractAddresses>("/contracts");
  }

  // ==========================================================================
  // Token Search & Registration API
  // ==========================================================================

  /**
   * Search tokens by symbol, name, or address
   *
   * @param query - Search query string
   * @returns Matching tokens
   */
  async searchTokens(query: string): Promise<TokenSearchResponse> {
    return this.fetch<TokenSearchResponse>(
      `/tokens/search${buildQuery({ q: query })}`,
    );
  }

  /**
   * Register a new ERC20 token by address
   *
   * @param address - Token contract address (0x...)
   * @returns Registration result with token info on success
   */
  async registerToken(address: string): Promise<RegisterTokenResponse> {
    return this.fetch<RegisterTokenResponse>("/tokens/register", {
      method: "POST",
      body: JSON.stringify({ address }),
    });
  }

  // ==========================================================================
  // Vote API
  // ==========================================================================

  /**
   * Get current voting epoch information
   */
  async getVoteEpoch(): Promise<EpochInfo> {
    return this.fetch<EpochInfo>("/vote/epoch/current");
  }

  /**
   * Get pools available for voting with stats
   */
  async getVotePools(query?: VotePoolsQuery): Promise<VotePoolsResponse> {
    const qs = buildQuery({
      limit: query?.limit,
      offset: query?.offset,
      sortBy: query?.sortBy,
      search: query?.search,
    });
    return this.fetch<VotePoolsResponse>(`/vote/pools${qs}`);
  }

  // ==========================================================================
  // Banner API
  // ==========================================================================

  /**
   * Get active banners for a page
   */
  async getActiveBanners(page: string): Promise<ActiveBanner[]> {
    return this.fetch<ActiveBanner[]>(`/banners/${page}`);
  }

  /**
   * Record a banner impression
   */
  async recordBannerImpression(id: number): Promise<void> {
    try {
      await this.fetch<{ success: boolean }>(`/banners/${id}/impression`, {
        method: "POST",
      });
    } catch {
      // Fire-and-forget: don't throw on failure
    }
  }

  /**
   * Record a banner click
   */
  async recordBannerClick(id: number): Promise<void> {
    try {
      await this.fetch<{ success: boolean }>(`/banners/${id}/click`, {
        method: "POST",
      });
    } catch {
      // Fire-and-forget: don't throw on failure
    }
  }

  // ==========================================================================
  // Liquidity Distribution API
  // ==========================================================================

  /**
   * Get liquidity distribution for a CL pool
   *
   * @param poolAddress - CL Pool contract address (0x...)
   * @returns Liquidity distribution bars for rendering depth chart
   */
  async getLiquidityDistribution(
    poolAddress: string,
  ): Promise<LiquidityDistributionResponse> {
    return this.fetch<LiquidityDistributionResponse>(
      `/pools/${poolAddress}/liquidity-distribution`,
    );
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Default indexer API instance
 *
 * Use this singleton for most cases:
 * ```typescript
 * import { indexerApi } from '@/lib/indexerApi';
 *
 * const stats = await indexerApi.getGlobalStats();
 * ```
 */
export const indexerApi = new IndexerApi();

// ============================================================================
// Re-export Types
// ============================================================================

export type {
  GlobalStats,
  PoolStats,
  PoolsStatsResponse,
  PoolStatsQuery,
  TokenPrice,
  TokenPricesResponse,
  ApiError,
  HealthResponse,
  ContractAddresses,
  TokenInfo,
  TokenSearchResponse,
  RegisterTokenResponse,
  EpochInfo,
  VotePoolInfo,
  VotePoolsQuery,
  VotePoolsResponse,
  LiquidityBar,
  LiquidityDistributionResponse,
} from "@/types/indexer";
