/**
 * GIWATER Point System Admin API Client
 *
 * Provides access to admin functionality including:
 * - Season management
 * - Point distribution & management
 * - Blacklist management
 * - Badge management
 *
 * @see docs/point-system-admin-api-guide.md
 */

import type {
  SeasonConfig,
  UpdateSeasonStatusRequest,
  PointBalance,
  PointHistoryResponse,
  PointHistoryQuery,
  LeaderboardResponse,
  LeaderboardQuery,
  MiningRate,
  TriggerDistributionRequest,
  DistributionSummary,
  ReferralStats,
  ReferralRewardItem,
  BlacklistEntry,
  AddBlacklistRequest,
  UserBadge,
  GrantBadgeRequest,
  BadgeCategory,
  BadgeDefinition,
  BadgeDefinitionListResponse,
  CreateSeasonBadgeDefinitionRequest,
  CreateCustomBadgeDefinitionRequest,
  UpdateBadgeDefinitionRequest,
  AssignCustomBadgeRequest,
  AssignCustomBadgeResponse,
  BadgeAssignedUsersResponse,
  SuccessResponse,
  AdminTokenInfo,
  TokenListResponse,
  CreateTokenRequest,
  UpdateTokenRequest,
  AdminPoolInfo,
  AdminPoolDetailInfo,
  PoolListResponse,
  AdminPoolTimeBucketsResponse,
  AdminExchangeTimeBucketsResponse,
  UpdatePoolGradeRequest,
  UpdatePoolListedRequest,
  DashboardStats,
  SyncStatus,
  BackfillStatus,
  RebuildStatus,
  RebuildResponse,
  SyncTriggerResponse,
  SyncResetResponse,
  CacheKeyInfo,
  CacheKeysResponse,
  CacheDeleteResponse,
  BlockchainEventListResponse,
  BlockchainEventQuery,
  AdminBannerInfo,
  BannerListResponse,
  CreateBannerRequest,
  UpdateBannerRequest,
  BannerPage,
  ReferralOverview,
  ReferrerListResponse,
  ReferrerDetail,
  ReferralListQuery,
  UpdateKolTierRequest,
  UpdateKolTierResponse,
  ProvisionReferrerRequest,
  ProvisionReferrerResponse,
  BasePointConfig,
  UpdateBasePointConfigRequest,
  DailyProtocolStatsResponse,
  BasePointConfigHistoryResponse,
  CreateSeasonRequest,
  UpdateSeasonRequest,
  UpdateSeasonWeightsRequest,
  AdminFaucetInfo,
  FaucetListResponse,
  RegisterFaucetRequest,
} from "@/types/admin";
import {
  apiFetch,
  apiUpload,
  buildQuery,
  type ApiClientConfig,
} from "@/lib/apiClient";
import { BROKER_ADMIN_PROXY_BASE, CONFIG_ADMIN_PROXY_BASE } from "@/lib/config";
import type {
  AdminLockStatsDto,
  AdminLockEventsDto,
  AdminLockByEpochDto,
  AdminVoteStatsDto,
  AdminVoteEventsDto,
  AdminVoteDistributionDto,
  AdminVoteByEpochDto,
} from "@giwater/shared";

// ============================================================================
// Configuration
// ============================================================================

// Admin API is intentionally server-only. Client-side code calls `/api/admin/*`
// which proxies to the real admin origin using a non-public env var.
// Use same-origin relative requests so the Next.js route handler can proxy
// without exposing the upstream admin origin to the browser.
const BASE_URL = "";

/**
 * Get the configured admin API URL
 */
export function getAdminApiUrl(): string {
  return BASE_URL;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Custom error class for Admin API errors
 */
export class AdminApiClientError extends Error {
  public statusCode?: number;
  public errorCode?: string;
  public endpoint?: string;

  constructor(
    message: string,
    statusCode?: number,
    errorCode?: string,
    endpoint?: string
  ) {
    super(message);
    this.name = "AdminApiClientError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.endpoint = endpoint;
  }
}

// ============================================================================
// API Client Class
// ============================================================================

/**
 * Admin API Client
 *
 * Example usage:
 * ```typescript
 * import { adminApi } from '@/lib/adminApi';
 *
 * // Get all seasons
 * const seasons = await adminApi.getSeasons();
 *
 * // Get leaderboard
 * const leaderboard = await adminApi.getLeaderboard({ limit: 10 });
 * ```
 */
class AdminApi {
  private config: ApiClientConfig;
  private authToken?: string;

  constructor(baseUrl: string = BASE_URL) {
    this.config = {
      baseUrl,
      createError: (message, statusCode, errorCode, endpoint) =>
        new AdminApiClientError(message, statusCode, errorCode, endpoint),
      isOwnError: (error) => error instanceof AdminApiClientError,
      networkErrorLabel: "admin API",
      getHeaders: () =>
        this.authToken
          ? { Authorization: `Bearer ${this.authToken}` }
          : undefined,
    };
  }

  /**
   * Set authentication token for API requests
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }

  /**
   * Clear authentication token
   */
  clearAuthToken() {
    this.authToken = undefined;
  }

  private adminProxyPath(endpoint: string): string {
    // All AdminApi endpoints in this client are absolute paths starting with `/`.
    //
    // Client calls must go to the Next.js proxy route: `/api/admin/*`.
    // The upstream admin service already has its own `/admin/*` namespace for
    // privileged endpoints. To avoid double-prefixing (`/api/admin/admin/...`),
    // strip a leading `/admin` from the endpoint before proxying.
    const normalized = endpoint.startsWith("/admin/")
      ? endpoint.replace(/^\/admin/, "")
      : endpoint;
    return `/api/admin${normalized}`;
  }

  private fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return apiFetch<T>(this.config, this.adminProxyPath(endpoint), options);
  }

  private brokerAdminFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const brokerConfig: ApiClientConfig = {
      ...this.config,
      baseUrl: BROKER_ADMIN_PROXY_BASE,
      networkErrorLabel: "broker admin",
    };
    return apiFetch<T>(brokerConfig, endpoint, options);
  }

  private configAdminFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const configAdminConfig: ApiClientConfig = {
      ...this.config,
      baseUrl: CONFIG_ADMIN_PROXY_BASE,
      networkErrorLabel: "config admin",
    };
    return apiFetch<T>(configAdminConfig, endpoint, options);
  }

  private uploadFile<T>(endpoint: string, file: File): Promise<T> {
    return apiUpload<T>(this.config, this.adminProxyPath(endpoint), file);
  }

  // ==========================================================================
  // Season Management API
  // ==========================================================================

  /**
   * Get all seasons
   */
  async getSeasons(): Promise<SeasonConfig[]> {
    return this.fetch<SeasonConfig[]>("/season");
  }

  /**
   * Get current active season
   */
  async getCurrentSeason(): Promise<SeasonConfig> {
    return this.fetch<SeasonConfig>("/season/current");
  }

  /**
   * Get season by ID
   */
  async getSeasonById(id: number): Promise<SeasonConfig> {
    return this.fetch<SeasonConfig>(`/season/${id}`);
  }

  /**
   * Create a new season (Admin only)
   */
  async createSeason(data: CreateSeasonRequest): Promise<SeasonConfig> {
    return this.fetch<SeasonConfig>("/admin/season", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Update season weights (Admin only)
   */
  async updateSeasonWeights(
    id: number,
    data: UpdateSeasonWeightsRequest
  ): Promise<SeasonConfig> {
    return this.fetch<SeasonConfig>(`/admin/season/${id}/weights`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /**
   * Update season status (Admin only)
   */
  async updateSeasonStatus(
    id: number,
    data: UpdateSeasonStatusRequest
  ): Promise<SeasonConfig> {
    return this.fetch<SeasonConfig>(`/admin/season/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /**
   * Update a season (Admin only)
   */
  async updateSeason(
    id: number,
    data: UpdateSeasonRequest
  ): Promise<SeasonConfig> {
    return this.fetch<SeasonConfig>(`/admin/season/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a season (Admin only)
   * @param force - cascade-delete all related records (point_balances, etc.)
   */
  async deleteSeason(id: number, force = false): Promise<{ success: boolean }> {
    const query = force ? '?force=true' : '';
    return this.fetch<{ success: boolean }>(`/admin/season/${id}${query}`, {
      method: "DELETE",
    });
  }

  // ==========================================================================
  // Point Management API
  // ==========================================================================

  /**
   * Trigger point distribution manually (Admin only)
   */
  async triggerDistribution(
    data?: TriggerDistributionRequest
  ): Promise<DistributionSummary> {
    return this.fetch<DistributionSummary>(
      "/admin/point/distribution/trigger",
      {
        method: "POST",
        body: JSON.stringify(data || {}),
      }
    );
  }

  /**
   * Get user point balance
   */
  async getPointBalance(
    address: string,
    seasonId?: number
  ): Promise<PointBalance> {
    return this.fetch<PointBalance>(
      `/point/balance/${address}${buildQuery({ seasonId })}`
    );
  }

  /**
   * Get user point history
   */
  async getPointHistory(
    address: string,
    query?: PointHistoryQuery
  ): Promise<PointHistoryResponse> {
    const qs = buildQuery({
      seasonId: query?.seasonId,
      sector: query?.sector,
      limit: query?.limit,
      offset: query?.offset,
    });
    return this.fetch<PointHistoryResponse>(`/point/history/${address}${qs}`);
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(query?: LeaderboardQuery): Promise<LeaderboardResponse> {
    const qs = buildQuery({
      seasonId: query?.seasonId,
      limit: query?.limit,
      offset: query?.offset,
    });
    return this.fetch<LeaderboardResponse>(`/point/leaderboard${qs}`);
  }

  /**
   * Get mining rate for a specific pool
   */
  async getMiningRate(poolAddress: string): Promise<MiningRate> {
    return this.fetch<MiningRate>(`/point/mining-rate/${poolAddress}`);
  }

  /**
   * Get all pool mining rates
   */
  async getMiningRates(): Promise<MiningRate[]> {
    return this.fetch<MiningRate[]>("/point/mining-rates");
  }

  // ==========================================================================
  // Referral API
  // ==========================================================================

  /**
   * Get user referral statistics
   */
  async getReferralStats(address: string): Promise<ReferralStats> {
    return this.fetch<ReferralStats>(`/referral/stats/${address}`);
  }

  /**
   * Get referral rewards history
   */
  async getReferralRewards(
    address: string,
    query?: { limit?: number; offset?: number }
  ): Promise<ReferralRewardItem[]> {
    const qs = buildQuery({ limit: query?.limit, offset: query?.offset });
    return this.fetch<ReferralRewardItem[]>(
      `/referral/rewards/${address}${qs}`
    );
  }

  // ==========================================================================
  // Blacklist API
  // ==========================================================================

  /**
   * Get blacklist entries (Admin only)
   */
  async getBlacklist(seasonId?: number): Promise<BlacklistEntry[]> {
    return this.fetch<BlacklistEntry[]>(
      `/admin/blacklist${buildQuery({ seasonId })}`
    );
  }

  /**
   * Add user to blacklist (Admin only)
   */
  async addToBlacklist(data: AddBlacklistRequest): Promise<BlacklistEntry> {
    return this.fetch<BlacklistEntry>("/admin/blacklist", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Remove user from blacklist (Admin only)
   */
  async removeFromBlacklist(
    address: string,
    seasonId: number
  ): Promise<SuccessResponse> {
    return this.fetch<SuccessResponse>(
      `/admin/blacklist/${address}${buildQuery({ seasonId })}`,
      { method: "DELETE" }
    );
  }

  // ==========================================================================
  // Badge API
  // ==========================================================================

  /**
   * Get user badges (Admin only)
   */
  async getUserBadges(address: string): Promise<UserBadge[]> {
    return this.fetch<UserBadge[]>(`/admin/badge/user/${address}`);
  }

  /**
   * Grant badge to user (Admin only) — legacy
   */
  async grantBadge(data: GrantBadgeRequest): Promise<UserBadge> {
    return this.fetch<UserBadge>("/admin/badge", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ==========================================================================
  // Badge Definition API
  // ==========================================================================

  async getBadgeDefinitions(
    category?: BadgeCategory,
  ): Promise<BadgeDefinitionListResponse> {
    const params = category ? `?category=${category}` : "";
    return this.fetch<BadgeDefinitionListResponse>(
      `/admin/badge-definition${params}`,
    );
  }

  async getBadgeDefinition(
    id: number,
  ): Promise<BadgeDefinition> {
    return this.fetch<BadgeDefinition>(`/admin/badge-definition/${id}`);
  }

  async createSeasonBadgeDefinition(
    data: CreateSeasonBadgeDefinitionRequest,
  ): Promise<BadgeDefinition> {
    return this.fetch<BadgeDefinition>("/admin/badge-definition/season", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async createCustomBadgeDefinition(
    data: CreateCustomBadgeDefinitionRequest,
  ): Promise<BadgeDefinition> {
    return this.fetch<BadgeDefinition>("/admin/badge-definition/custom", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateBadgeDefinition(
    id: number,
    data: UpdateBadgeDefinitionRequest,
  ): Promise<BadgeDefinition> {
    return this.fetch<BadgeDefinition>(`/admin/badge-definition/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteBadgeDefinition(id: number): Promise<void> {
    await this.fetch(`/admin/badge-definition/${id}`, {
      method: "DELETE",
    });
  }

  async uploadBadgeImage(
    id: number,
    file: File,
  ): Promise<BadgeDefinition> {
    return this.uploadFile<BadgeDefinition>(
      `/admin/badge-definition/${id}/image`,
      file,
    );
  }

  async deleteBadgeImage(id: number): Promise<BadgeDefinition> {
    return this.fetch<BadgeDefinition>(
      `/admin/badge-definition/${id}/image`,
      { method: "DELETE" },
    );
  }

  // ==========================================================================
  // Badge Assignment API
  // ==========================================================================

  async assignCustomBadge(
    data: AssignCustomBadgeRequest,
  ): Promise<AssignCustomBadgeResponse> {
    return this.fetch<AssignCustomBadgeResponse>("/admin/badge/assign", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async revokeUserBadge(userBadgeId: number): Promise<void> {
    await this.fetch(`/admin/badge/${userBadgeId}`, {
      method: "DELETE",
    });
  }

  async getAssignedUsers(
    definitionId: number,
    limit = 50,
    offset = 0,
  ): Promise<BadgeAssignedUsersResponse> {
    return this.fetch<BadgeAssignedUsersResponse>(
      `/admin/badge/definition/${definitionId}/users?limit=${limit}&offset=${offset}`,
    );
  }

  // ==========================================================================
  // Token Admin API
  // ==========================================================================

  /**
   * Get all tokens (Admin only)
   */
  async getTokens(): Promise<TokenListResponse> {
    return this.fetch<TokenListResponse>("/admin/token");
  }

  /**
   * Get single token by address (Admin only)
   */
  async getToken(address: string): Promise<AdminTokenInfo> {
    return this.fetch<AdminTokenInfo>(`/admin/token/${address}`);
  }

  /**
   * Create a new token (Admin only)
   */
  async createToken(data: CreateTokenRequest): Promise<AdminTokenInfo> {
    return this.fetch<AdminTokenInfo>("/admin/token", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Update existing token (Admin only)
   */
  async updateToken(
    address: string,
    data: UpdateTokenRequest
  ): Promise<AdminTokenInfo> {
    return this.fetch<AdminTokenInfo>(`/admin/token/${address}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete token (Admin only)
   */
  async deleteToken(address: string): Promise<SuccessResponse> {
    return this.fetch<SuccessResponse>(`/admin/token/${address}`, {
      method: "DELETE",
    });
  }

  /**
   * Upload token icon (Admin only). Uses multipart/form-data.
   */
  async uploadTokenIcon(address: string, file: File): Promise<AdminTokenInfo> {
    return this.uploadFile<AdminTokenInfo>(
      `/admin/token/${address}/icon`,
      file,
    );
  }

  /**
   * Delete token icon (Admin only)
   */
  async deleteTokenIcon(address: string): Promise<AdminTokenInfo> {
    return this.fetch<AdminTokenInfo>(`/admin/token/${address}/icon`, {
      method: "DELETE",
    });
  }

  /**
   * Upload token sticker (Admin only). Uses multipart/form-data.
   */
  async uploadTokenSticker(
    address: string,
    file: File
  ): Promise<AdminTokenInfo> {
    return this.uploadFile<AdminTokenInfo>(
      `/admin/token/${address}/sticker`,
      file,
    );
  }

  /**
   * Delete token sticker (Admin only)
   */
  async deleteTokenSticker(address: string): Promise<AdminTokenInfo> {
    return this.fetch<AdminTokenInfo>(`/admin/token/${address}/sticker`, {
      method: "DELETE",
    });
  }

  // ==========================================================================
  // Dashboard Stats API
  // ==========================================================================

  /**
   * Get dashboard aggregate statistics (Admin only)
   * Returns totalDistributed, activeBadges count, and totalUsers
   * @param seasonId - Optional season ID (defaults to current season)
   * @see docs/dashboard-stats-api.md
   */
  async getDashboardStats(seasonId?: number): Promise<DashboardStats> {
    return this.fetch<DashboardStats>(
      `/admin/dashboard/stats${buildQuery({ seasonId })}`
    );
  }

  /**
   * Get daily protocol stats for dashboard charts (Admin only)
   * @param days - Number of days to fetch (default: 30)
   */
  async getDashboardChartData(
    days?: number
  ): Promise<DailyProtocolStatsResponse> {
    return this.fetch<DailyProtocolStatsResponse>(
      `/admin/dashboard/chart-data${buildQuery({ days })}`
    );
  }

  // ==========================================================================
  // Pool Admin API
  // ==========================================================================

  /**
   * Get all pools (Admin only)
   * Returns all pools including non-whitelisted ones
   * @see docs/pool-whitelist-api.md
   */
  async getPools(): Promise<PoolListResponse> {
    const response = await this.fetch<PoolListResponse>("/admin/pool");
    // `/admin/pools` UI loads via this call (upstream: GET `/admin/pool`, proxied as `/api/admin/pool`).
    if (process.env.NODE_ENV === "development") {
      console.log("[admin/pools] getPools() → PoolListResponse", response);
    }
    return response;
  }

  /**
   * Get single pool by address with stats (Admin only)
   * @param address - Pool contract address
   */
  async getPool(address: string): Promise<AdminPoolDetailInfo> {
    return this.fetch<AdminPoolDetailInfo>(`/admin/pool/${address}`);
  }

  async getPoolTimeBuckets(
    address: string,
    params: { resolution: string; limit?: number },
  ): Promise<AdminPoolTimeBucketsResponse> {
    const response = await this.fetch<AdminPoolTimeBucketsResponse>(
      `/admin/pool/${address}/time-buckets${buildQuery({
        resolution: params.resolution,
        limit: params.limit ?? 300,
      })}`,
    );
    if (process.env.NODE_ENV === "development") {
      console.log(
        "[admin/pools] getPoolTimeBuckets() → AdminPoolTimeBucketsResponse",
        { address, ...params },
        response,
      );
    }
    return response;
  }

  async getExchangeTimeBuckets(
    protocolId: string,
    params: { resolution: string; limit?: number },
  ): Promise<AdminExchangeTimeBucketsResponse> {
    return this.fetch<AdminExchangeTimeBucketsResponse>(
      `/admin/exchange/${encodeURIComponent(protocolId)}/time-buckets${buildQuery({
        resolution: params.resolution,
        limit: params.limit ?? 90,
      })}`,
    );
  }

  /**
   * Force refresh pool stats from on-chain (Admin only)
   * @param address - Pool contract address
   */
  async refreshPoolStats(address: string): Promise<AdminPoolDetailInfo> {
    return this.fetch<AdminPoolDetailInfo>(`/admin/pool/${address}/refresh-stats`, {
      method: 'POST',
    });
  }

  /**
   * Update pool voting enabled status (Admin only)
   * @param address - Pool contract address
   * @param isVotingEnabled - New voting enabled status
   */
  async updatePoolVoting(
    address: string,
    isVotingEnabled: boolean
  ): Promise<AdminPoolInfo> {
    return this.fetch<AdminPoolInfo>(`/admin/pool/${address}/voting`, {
      method: "PUT",
      body: JSON.stringify({ isVotingEnabled }),
    });
  }

  /**
   * Update pool grade (Admin only - manual override)
   * @param address - Pool contract address
   * @param data - Grade update request (grade: 1|2|3, isManualOverride?: boolean)
   */
  async updatePoolGrade(
    address: string,
    data: UpdatePoolGradeRequest
  ): Promise<AdminPoolInfo> {
    return this.fetch<AdminPoolInfo>(`/admin/pool/${address}/grade`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /**
   * List/unlist pool for public catalog (`spot_pairs.listed`).
   * Broker Swagger: `POST /spot-pairs/by-address/:address/listing` (not under `/admin`).
   * Proxied via `/api/admin/spot-pairs/...` → broker root.
   */
  async updatePoolListed(
    address: string,
    data: UpdatePoolListedRequest,
  ): Promise<void> {
    const enc = encodeURIComponent(address);
    await this.fetch<unknown>(`/spot-pairs/by-address/${enc}/listing`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ==========================================================================
  // Indexer Admin API
  // ==========================================================================

  /**
   * Get event sync status (Admin only)
   * Returns current blockchain sync progress
   * @see docs/indexer-admin-api-guide.md
   */
  async getSyncStatus(): Promise<SyncStatus> {
    return this.fetch<SyncStatus>("/admin/indexer/sync/status");
  }

  /**
   * Get backfill queue status (Admin only)
   * Returns pending backfill jobs
   * @see docs/indexer-admin-api-guide.md
   */
  async getBackfillStatus(): Promise<BackfillStatus> {
    return this.fetch<BackfillStatus>("/admin/indexer/backfill/status");
  }

  /**
   * Get rebuild operation status (Admin only)
   * Check if a rebuild is currently running
   * @see docs/indexer-admin-api-guide.md
   */
  async getRebuildStatus(): Promise<RebuildStatus> {
    return this.fetch<RebuildStatus>("/admin/indexer/rebuild/status");
  }

  /**
   * Rebuild LP positions (Admin only)
   * Processes MINT/BURN/IncreaseLiquidity/DecreaseLiquidity events
   * @param batchSize - Batch processing size (default: 1000)
   * @see docs/indexer-admin-api-guide.md
   */
  async rebuildLpPositions(batchSize?: number): Promise<RebuildResponse> {
    return this.fetch<RebuildResponse>(
      `/admin/indexer/rebuild/lp-positions${buildQuery({ batchSize })}`,
      { method: "POST" }
    );
  }

  /**
   * Rebuild Lock positions (Admin only)
   * Processes VE Deposit/Withdraw/Merge/Split events
   * @param batchSize - Batch processing size (default: 1000)
   * @see docs/indexer-admin-api-guide.md
   */
  async rebuildLockPositions(batchSize?: number): Promise<RebuildResponse> {
    return this.fetch<RebuildResponse>(
      `/admin/indexer/rebuild/lock-positions${buildQuery({ batchSize })}`,
      { method: "POST" }
    );
  }

  /**
   * Rebuild Vote positions (Admin only)
   * Processes Voted/Abstained events
   * @param batchSize - Batch processing size (default: 1000)
   * @see docs/indexer-admin-api-guide.md
   */
  async rebuildVotePositions(batchSize?: number): Promise<RebuildResponse> {
    return this.fetch<RebuildResponse>(
      `/admin/indexer/rebuild/vote-positions${buildQuery({ batchSize })}`,
      { method: "POST" }
    );
  }

  /**
   * Rebuild all state tables (Admin only)
   * Rebuilds LP, Lock, and Vote positions
   * @see docs/indexer-admin-api-guide.md
   */
  async rebuildAll(): Promise<RebuildResponse> {
    return this.fetch<RebuildResponse>("/admin/indexer/rebuild/all", {
      method: "POST",
    });
  }

  /**
   * Trigger event sync manually (Admin only)
   * Runs sync immediately regardless of scheduler
   * @see docs/indexer-admin-api-guide.md
   */
  async triggerSync(): Promise<SyncTriggerResponse> {
    return this.fetch<SyncTriggerResponse>("/admin/indexer/sync/trigger", {
      method: "POST",
    });
  }

  /**
   * Reset sync to specific block (Admin only)
   * Sync will restart from the specified block
   * @param fromBlock - Block number to reset to
   * @see docs/indexer-admin-api-guide.md
   */
  async resetSync(fromBlock: number): Promise<SyncResetResponse> {
    return this.fetch<SyncResetResponse>(
      `/admin/indexer/sync/reset${buildQuery({ fromBlock })}`,
      { method: "POST" }
    );
  }

  // ==========================================================================
  // Cache Admin API
  // ==========================================================================

  /**
   * Get all cache keys (Admin only)
   * @param pattern - Optional glob pattern to filter keys (e.g. "stats:*")
   */
  async getCacheKeys(pattern?: string): Promise<CacheKeysResponse> {
    return this.fetch<CacheKeysResponse>(
      `/admin/cache/keys${buildQuery({ pattern })}`
    );
  }

  /**
   * Get cache key info with value (Admin only)
   * @param key - Cache key name
   */
  async getCacheKeyInfo(key: string): Promise<CacheKeyInfo> {
    return this.fetch<CacheKeyInfo>(
      `/admin/cache/keys/${encodeURIComponent(key)}`
    );
  }

  /**
   * Delete a specific cache key (Admin only)
   * @param key - Cache key to delete
   */
  async deleteCacheKey(key: string): Promise<CacheDeleteResponse> {
    return this.fetch<CacheDeleteResponse>(
      `/admin/cache/keys/${encodeURIComponent(key)}`,
      { method: "DELETE" }
    );
  }

  /**
   * Delete cache keys by pattern (Admin only)
   * @param pattern - Glob pattern to match keys for deletion
   */
  async deleteCacheKeysByPattern(
    pattern: string
  ): Promise<CacheDeleteResponse> {
    return this.fetch<CacheDeleteResponse>(
      `/admin/cache/keys${buildQuery({ pattern })}`,
      { method: "DELETE" }
    );
  }

  // ==========================================================================
  // Database Admin API
  // ==========================================================================

  async getDatabaseTables(): Promise<
    { name: string; rowCount: number }[]
  > {
    return this.fetch<{ name: string; rowCount: number }[]>(
      "/admin/database/tables"
    );
  }

  async executeDatabaseQuery(sql: string): Promise<{
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTimeMs: number;
  }> {
    return this.fetch("/admin/database/query", {
      method: "POST",
      body: JSON.stringify({ sql }),
    });
  }

  // ==========================================================================
  // Event Admin API
  // ==========================================================================

  /**
   * Get blockchain events with filtering and pagination (Admin only)
   */
  async getEvents(
    query?: BlockchainEventQuery
  ): Promise<BlockchainEventListResponse> {
    const qs = buildQuery({
      category: query?.category,
      eventType: query?.eventType,
      limit: query?.limit,
      offset: query?.offset,
    });
    return this.fetch<BlockchainEventListResponse>(`/admin/events${qs}`);
  }

  // ==========================================================================
  // Banner Admin API
  // ==========================================================================

  /**
   * Get all banners (Admin only)
   */
  async getBanners(page?: BannerPage): Promise<BannerListResponse> {
    const query = page ? `?page=${page}` : "";
    return this.fetch<BannerListResponse>(`/admin/banner${query}`);
  }

  /**
   * Get banner by ID (Admin only)
   */
  async getBanner(id: number): Promise<AdminBannerInfo> {
    return this.fetch<AdminBannerInfo>(`/admin/banner/${id}`);
  }

  /**
   * Create a new banner (Admin only)
   */
  async createBanner(data: CreateBannerRequest): Promise<AdminBannerInfo> {
    return this.fetch<AdminBannerInfo>("/admin/banner", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Update a banner (Admin only)
   */
  async updateBanner(
    id: number,
    data: UpdateBannerRequest
  ): Promise<AdminBannerInfo> {
    return this.fetch<AdminBannerInfo>(`/admin/banner/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a banner (Admin only)
   */
  async deleteBanner(id: number): Promise<{ message: string }> {
    return this.fetch<{ message: string }>(`/admin/banner/${id}`, {
      method: "DELETE",
    });
  }

  /**
   * Upload PC banner image (Admin only).
   */
  async uploadBannerPcImage(
    id: number,
    file: File
  ): Promise<AdminBannerInfo> {
    return this.uploadFile<AdminBannerInfo>(
      `/admin/banner/${id}/image/pc`,
      file,
    );
  }

  /**
   * Upload mobile banner image (Admin only, LOCK/VOTE pages).
   */
  async uploadBannerMobileImage(
    id: number,
    file: File
  ): Promise<AdminBannerInfo> {
    return this.uploadFile<AdminBannerInfo>(
      `/admin/banner/${id}/image/mobile`,
      file,
    );
  }

  /**
   * Delete PC banner image (Admin only)
   */
  async deleteBannerPcImage(id: number): Promise<AdminBannerInfo> {
    return this.fetch<AdminBannerInfo>(`/admin/banner/${id}/image/pc`, {
      method: "DELETE",
    });
  }

  /**
   * Delete mobile banner image (Admin only)
   */
  async deleteBannerMobileImage(id: number): Promise<AdminBannerInfo> {
    return this.fetch<AdminBannerInfo>(`/admin/banner/${id}/image/mobile`, {
      method: "DELETE",
    });
  }

  // ==========================================================================
  // Referral Admin API
  // ==========================================================================

  /**
   * Get referral system overview statistics (Admin only)
   */
  async getReferralOverview(): Promise<ReferralOverview> {
    return this.configAdminFetch<ReferralOverview>("/admin/referral/overview");
  }

  /**
   * Get paginated list of referrers with stats (Admin only)
   */
  async getReferrerList(
    query?: ReferralListQuery
  ): Promise<ReferrerListResponse> {
    const qs = buildQuery({
      limit: query?.limit,
      offset: query?.offset,
      search: query?.search,
      tierFilter: query?.tierFilter,
    });
    return this.configAdminFetch<ReferrerListResponse>(`/admin/referral/list${qs}`);
  }

  /**
   * Get detailed referral info for a specific address (Admin only)
   */
  async getReferrerDetail(address: string): Promise<ReferrerDetail> {
    return this.configAdminFetch<ReferrerDetail>(`/admin/referral/detail/${address}`);
  }

  /**
   * Update KOL tier for a referrer (Admin only)
   */
  async updateKolTier(
    address: string,
    data: UpdateKolTierRequest
  ): Promise<UpdateKolTierResponse> {
    return this.configAdminFetch<UpdateKolTierResponse>(
      `/admin/referral/tier/${address}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Provision a new referrer with tier and referral code (Admin only)
   */
  async provisionReferrer(
    data: ProvisionReferrerRequest
  ): Promise<ProvisionReferrerResponse> {
    return this.configAdminFetch<ProvisionReferrerResponse>(
      `/admin/referral/provision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
  }

  // ==========================================================================
  // Base Point Config API
  // ==========================================================================

  /**
   * Get the currently active base point config (Admin only)
   */
  async getBasePointConfigCurrent(): Promise<BasePointConfig | null> {
    return this.fetch<BasePointConfig | null>(
      "/admin/base-point-config/current"
    );
  }

  /**
   * Get base point config history (Admin only)
   */
  async getBasePointConfigHistory(
    limit?: number,
    offset?: number
  ): Promise<BasePointConfigHistoryResponse> {
    return this.fetch<BasePointConfigHistoryResponse>(
      `/admin/base-point-config/history${buildQuery({ limit, offset })}`
    );
  }

  /**
   * Update base point config (Admin only)
   */
  async updateBasePointConfig(
    data: UpdateBasePointConfigRequest
  ): Promise<BasePointConfig> {
    return this.fetch<BasePointConfig>("/admin/base-point-config", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ==========================================================================
  // Faucet Admin API
  // ==========================================================================

  /**
   * Get all registered faucets (Admin only)
   */
  async getFaucets(): Promise<FaucetListResponse> {
    return this.fetch<FaucetListResponse>("/admin/faucet");
  }

  /**
   * Register a new faucet (Admin only)
   */
  async registerFaucet(data: RegisterFaucetRequest): Promise<AdminFaucetInfo> {
    return this.fetch<AdminFaucetInfo>("/admin/faucet", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a faucet by address (Admin only)
   */
  async deleteFaucet(address: string): Promise<{ message: string }> {
    return this.fetch<{ message: string }>(
      `/admin/faucet/${encodeURIComponent(address)}`,
      { method: "DELETE" },
    );
  }

  async getLockStats(pool?: string): Promise<AdminLockStatsDto> {
    return this.fetch<AdminLockStatsDto>(
      `/admin/lock/stats${buildQuery({ pool })}`,
    );
  }

  async getLockEvents(pool?: string, limit = 20, offset = 0): Promise<AdminLockEventsDto> {
    return this.fetch<AdminLockEventsDto>(
      `/admin/lock/events${buildQuery({ pool, limit, offset })}`,
    );
  }

  async getLockByEpoch(pool?: string, epochs = 8): Promise<AdminLockByEpochDto> {
    return this.fetch<AdminLockByEpochDto>(
      `/admin/lock/by-epoch${buildQuery({ pool, epochs })}`,
    );
  }

  async getVoteStats(pool?: string): Promise<AdminVoteStatsDto> {
    return this.fetch<AdminVoteStatsDto>(
      `/admin/vote/stats${buildQuery({ pool })}`,
    );
  }

  async getVoteEvents(pool?: string, limit = 20, offset = 0): Promise<AdminVoteEventsDto> {
    return this.fetch<AdminVoteEventsDto>(
      `/admin/vote/events${buildQuery({ pool, limit, offset })}`,
    );
  }

  async getVoteDistribution(epoch?: number): Promise<AdminVoteDistributionDto> {
    return this.fetch<AdminVoteDistributionDto>(
      `/admin/vote/distribution${buildQuery({ epoch })}`,
    );
  }

  async getVoteByEpoch(pool?: string, epochs = 8): Promise<AdminVoteByEpochDto> {
    return this.fetch<AdminVoteByEpochDto>(
      `/admin/vote/by-epoch${buildQuery({ pool, epochs })}`,
    );
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Default admin API instance
 *
 * Use this singleton for most cases:
 * ```typescript
 * import { adminApi } from '@/lib/adminApi';
 *
 * const seasons = await adminApi.getSeasons();
 * ```
 */
export const adminApi = new AdminApi();

// ============================================================================
// Re-export Types
// ============================================================================

export type {
  SeasonConfig,
  UpdateSeasonStatusRequest,
  PointBalance,
  PointHistoryResponse,
  PointHistoryQuery,
  LeaderboardResponse,
  LeaderboardQuery,
  MiningRate,
  TriggerDistributionRequest,
  DistributionSummary,
  ReferralStats,
  ReferralRewardItem,
  BlacklistEntry,
  AddBlacklistRequest,
  UserBadge,
  GrantBadgeRequest,
  SuccessResponse,
  AdminApiError,
  AdminTokenInfo,
  TokenListResponse,
  CreateTokenRequest,
  UpdateTokenRequest,
  AdminPoolInfo,
  PoolListResponse,
  UpdatePoolGradeRequest,
  DashboardStats,
  SyncStatus,
  BackfillStatus,
  BackfillJob,
  RebuildStatus,
  RebuildResult,
  FullRebuildResult,
  RebuildResponse,
  SyncTriggerResponse,
  SyncResetResponse,
  CacheKeyInfo,
  CacheKeysResponse,
  CacheDeleteResponse,
  BlockchainEventListResponse,
  BlockchainEventQuery,
  BlockchainEventItem,
  EventCategory,
  EventTypeValue,
  AdminBannerInfo,
  BannerListResponse,
  CreateBannerRequest,
  UpdateBannerRequest,
  BannerPage,
  BannerStatus,
  BannerClickTarget,
  ReferralOverview,
  ReferrerListItem,
  ReferrerListResponse,
  ReferrerDetail,
  ReferralTier,
  ReferralListQuery,
  UpdateKolTierRequest,
  UpdateKolTierResponse,
  BasePointConfig,
  BasePointConfigStatus,
  UpdateBasePointConfigRequest,
  BasePointConfigHistoryResponse,
  DailyProtocolStatsItem,
  DailyProtocolStatsResponse,
} from "@/types/admin";
