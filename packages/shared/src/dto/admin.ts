/**
 * Admin API DTO Types
 *
 * Types for the admin-facing API endpoints.
 * Client-only types (e.g., AdminAuthContext) remain in apps/web/types/admin.ts.
 */

import type { BannerStatus, BannerPage, BannerClickTarget } from '../types/banner';

// ============================================================================
// Auth Types
// ============================================================================

export type AdminRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';

// ============================================================================
// Season Types
// ============================================================================

export type SeasonPhase = 'P0' | 'P0.5' | 'S1' | 'S2' | 'S3';
export type SeasonStatus = 'pending' | 'active' | 'completed';
export type RewardType = 'FIXED' | 'DISTRIBUTION';
export type Sector = 'LP' | 'TRADE' | 'REFERRAL' | 'EMISSION';

export interface SeasonWeight {
  sector: Sector;
  weight: string;
}

export interface SeasonConfig {
  id: number;
  seasonNumber: string;
  name: string;
  phase: SeasonPhase;
  sortOrder: number;
  startDate?: string | null;
  endDate?: string | null;
  activatedAt?: string | null;
  completedAt?: string | null;
  dailyCap: string;
  baseLayerRatio: string;
  rewardType: RewardType;
  rewardConfig?: Record<string, unknown> | null;
  description?: string | null;
  status: SeasonStatus;
  weights: SeasonWeight[];
}

export interface CreateSeasonRequest {
  seasonNumber?: string;
  name: string;
  phase?: SeasonPhase;
  sortOrder?: number;
  startDate?: string;
  endDate?: string;
  dailyCap?: string;
  baseLayerRatio?: number;
  rewardType: RewardType;
  rewardConfig?: Record<string, unknown>;
  description?: string;
  weights?: { sector: string; weight: number }[];
}

export interface UpdateSeasonRequest {
  name?: string;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
  rewardType?: RewardType;
  rewardConfig?: Record<string, unknown> | null;
  weights?: { sector: string; weight: number }[];
}

export interface UpdateSeasonWeightsRequest {
  weights: { sector: string; weight: number }[];
}

export interface UpdateSeasonStatusRequest {
  status: SeasonStatus;
}

export interface SeasonParticipation {
  id: number;
  userAddress: string;
  seasonId: number;
  seasonName: string;
  seasonPhase: string;
  participationType: string;
  rewardAmount: string;
  metadata?: Record<string, unknown> | null;
  participatedAt: string;
}

// ============================================================================
// Point Types
// ============================================================================

export type PointSourceType =
  | 'DAILY_DISTRIBUTION'
  | 'BASE_DISTRIBUTION'
  | 'SEASON_DISTRIBUTION'
  | 'REFERRAL_REWARD'
  | 'BADGE_BONUS'
  | 'MANUAL_ADJUSTMENT';

export type PointStatus = 'ACTIVE' | 'FORFEITED';

export interface PointBalance {
  address: string;
  seasonId: number;
  seasonName: string;
  totalPoints: string;
  claimedPoints: string;
  claimablePoints: string;
  onChainBalance: string;
  lockedInVoting: string;
  availableBalance: string;
  breakdown: {
    lp: string;
    trading: string;
    referral: string;
    emission: string;
  };
  rank?: number;
  percentile?: number;
  updatedAt: string;
}

export interface PointHistoryItem {
  id: number;
  sector: Sector;
  amount: string;
  sourceType: PointSourceType;
  sourceId?: string;
  status: PointStatus;
  createdAt: string;
}

export interface PointHistoryResponse {
  items: PointHistoryItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface PointHistoryQuery {
  seasonId?: number;
  sector?: Sector;
  limit?: number;
  offset?: number;
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  totalPoints: string;
  lpPoints?: string;
  tradingPoints?: string;
  referralPoints?: string;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  season: {
    id: number;
    name: string;
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface LeaderboardQuery {
  seasonId?: number;
  limit?: number;
  offset?: number;
}

export interface MiningRate {
  poolAddress: string;
  poolName: string;
  tokenPair: string;
  pairTier: number;
  tierMultiplier: string;
  baseRate: string;
  unit: string;
  tvl: string;
  seasonAllocation: string;
}

export interface TriggerDistributionRequest {
  date?: string;
}

export interface SectorBreakdown {
  sector: Sector;
  totalPoints: string;
  userCount: number;
}

export interface LayerBreakdown {
  baseLayerTotal: string;
  baseLayerLp: string;
  baseLayerTrade: string;
  seasonLayerTotal: string;
  seasonLayerLp: string;
  seasonLayerTrade: string;
}

export interface DistributionSummary {
  date: string;
  seasonId: number;
  totalDistributed: string;
  userCount: number;
  sectorBreakdown: SectorBreakdown[];
  layerBreakdown: LayerBreakdown;
}

// ============================================================================
// Referral Types
// ============================================================================

export interface RefereeInfo {
  address: string;
  joinedAt: string;
  isActive: boolean;
  pointsContributed: string;
}

export interface ReferralStats {
  address: string;
  code: string;
  totalReferees: number;
  activeReferees: number;
  lpPointsEarned: string;
  tradingPointsEarned: string;
  totalPointsEarned: string;
  capApplied: boolean;
  capRatio: number;
  referees: RefereeInfo[];
}

export interface ReferralRewardItem {
  id: number;
  refereeAddress: string;
  recipientAddress: string;
  rewardType: 'LP' | 'TRADING' | 'REFERRAL';
  basePoints: string;
  rewardRate: string;
  rewardPoints: string;
  capApplied: boolean;
  date: string;
}

// ============================================================================
// Blacklist Types
// ============================================================================

export type BlacklistReason =
  | 'FLASH_LOAN_ABUSE'
  | 'SYBIL_ATTACK'
  | 'SELF_REFERRAL'
  | 'WASH_TRADING'
  | 'MANUAL_BAN';

export interface BlacklistEntry {
  id: number;
  userAddress: string;
  seasonId: number;
  reason: BlacklistReason;
  description?: string;
  forfeitedPoints: string;
  evidence?: Record<string, unknown>;
  blacklistedAt: string;
  removedAt?: string;
  isActive: boolean;
}

export interface AddBlacklistRequest {
  userAddress: string;
  seasonId: number;
  reason: BlacklistReason;
  description?: string;
}

// ============================================================================
// Badge Types
// ============================================================================

export type BadgeType =
  | 'EARLY_BIRD'
  | 'KOL_PARTNER'
  | 'WHALE'
  | 'OG'
  | 'KOL_TIER1'
  | 'KOL_TIER2'
  | 'GENESIS_DIAMOND'
  | 'GENESIS_PLATINUM'
  | 'GENESIS_GOLD'
  | 'GENESIS_SILVER'
  | 'GENESIS_BRONZE'
  | 'PARTNER'
  | 'SEASON'
  | 'CUSTOM';

export type BadgeCategory = 'SEASON' | 'CUSTOM';

export interface BadgeDefinition {
  id: number;
  category: BadgeCategory;
  name: string;
  level: number | null;
  boostPercent: string;
  targetPercentile: string | null;
  imageUrl: string | null;
  seasonId: number | null;
  isPreSeason: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Populated in list queries */
  assignedCount?: number;
}

export interface CreateSeasonBadgeDefinitionRequest {
  name: string;
  level: number;
  boostPercent: number;
  targetPercentile: number;
  seasonId?: number;
  isPreSeason?: boolean;
}

export interface CreateCustomBadgeDefinitionRequest {
  name: string;
  boostPercent: number;
}

export interface UpdateBadgeDefinitionRequest {
  name?: string;
  level?: number;
  boostPercent?: number;
  targetPercentile?: number;
  isActive?: boolean;
}

export interface AssignCustomBadgeRequest {
  badgeDefinitionId: number;
  addresses: string[];
  expiresAt?: string;
}

export interface AssignCustomBadgeResponse {
  assigned: number;
  failed: string[];
}

export interface BadgeDefinitionListResponse {
  definitions: BadgeDefinition[];
  total: number;
}

export interface BadgeAssignedUsersResponse {
  users: UserBadge[];
  total: number;
}

export interface UserBadge {
  id: number;
  userAddress: string;
  badgeType: BadgeType;
  badgeDefinitionId: number | null;
  badgeDefinition?: BadgeDefinition;
  boostPercent: string;
  seasonId: number | null;
  metadata?: Record<string, unknown>;
  grantedAt: string;
  expiresAt?: string;
  isActive: boolean;
}

export interface GrantBadgeRequest {
  userAddress: string;
  badgeType: BadgeType;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
}

// ============================================================================
// Referral Admin Types
// ============================================================================

export interface ReferralOverview {
  totalReferrers: number;
  totalReferees: number;
  totalRewardsDistributed: string;
  kolTier1Count: number;
  kolTier2Count: number;
  generalCount: number;
  rates: {
    general: number;
    kolTier1: number;
    kolTier2: number;
  };
}

export type ReferralTier = 'GENERAL' | 'KOL_TIER1' | 'KOL_TIER2';

export interface ReferrerListItem {
  address: string;
  referralCode: string;
  tier: ReferralTier;
  referralRate: number;
  totalReferees: number;
  activeReferees: number;
  totalRewardsEarned: string;
  createdAt: string;
  /** When the current tier badge was granted (null for GENERAL users with no badge history) */
  tierAppliedAt: string | null;
}

export interface ReferrerListResponse {
  items: ReferrerListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReferrerDetail {
  address: string;
  referralCode: string;
  tier: ReferralTier;
  referralRate: number;
  badge: {
    badgeType: string;
    isActive: boolean;
    grantedAt: string;
    expiresAt: string | null;
    metadata: Record<string, unknown> | null;
  } | null;
  totalReferees: number;
  activeReferees: number;
  invalidReferees: number;
  totalRewardsEarned: string;
  referees: {
    address: string;
    isValid: boolean;
    invalidationReason: string | null;
    fundingSource: string | null;
    createdAt: string;
    rewardsGenerated: string;
  }[];
  recentRewards: {
    refereeAddress: string;
    recipientAddress: string;
    rewardType: string;
    basePoints: string;
    rewardRate: string;
    rewardPoints: string;
    date: string;
  }[];
}

export interface UpdateKolTierRequest {
  badgeType: 'KOL_TIER1' | 'KOL_TIER2' | 'NONE';
}

export interface UpdateKolTierResponse {
  success: boolean;
  tier: string;
  rate: number;
}

export interface ReferralListQuery {
  limit?: number;
  offset?: number;
  search?: string;
  tierFilter?: 'ALL' | ReferralTier;
}

export interface ProvisionReferrerRequest {
  address: string;
  badgeType: 'KOL_TIER1' | 'KOL_TIER2' | 'NONE';
}

export interface ProvisionReferrerResponse {
  success: boolean;
  referralCode: string;
  tier: string;
  rate: number;
}

// ============================================================================
// API Error
// ============================================================================

export interface AdminApiError {
  statusCode: number;
  error: string;
  message: string;
  timestamp: string;
}

// ============================================================================
// Dashboard Stats Types
// ============================================================================

export interface DashboardStats {
  totalTvl: string;
  cumulativeVolume: string;
  cumulativeFees: string;
  totalDistributed: string;
  totalProtocolBribes: string;
  // Kept for backward compatibility
  totalUsers?: number;
  activeBadges?: number;
  calculatedAt: string;
}

// ============================================================================
// Daily Protocol Stats Types (Chart Data)
// ============================================================================

export interface DailyProtocolStatsItem {
  date: string; // 'YYYY-MM-DD'
  tvlUsd: string | null;
  volumeUsd: string;
  feesUsd: string;
}

export interface DailyProtocolStatsResponse {
  items: DailyProtocolStatsItem[];
  period: {
    from: string;
    to: string;
  };
}

// ============================================================================
// Token Admin Types
// ============================================================================

export interface AdminTokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: string;
  iconUrl: string | null;
  isPopular: boolean;
  isWhitelisted: boolean;
  isVerified: boolean;
  stickerUrl: string | null;
  updatedAt: string;
}

export interface TokenListResponse {
  tokens: AdminTokenInfo[];
  total: number;
}

export interface CreateTokenRequest {
  address: string;
  symbol: string;
  name: string;
}

export interface UpdateTokenRequest {
  symbol?: string;
  name?: string;
  isPopular?: boolean;
  isWhitelisted?: boolean;
  isVerified?: boolean;
}

// ============================================================================
// Pool Admin Types
// ============================================================================

export interface AdminPoolInfo {
  address: string;
  /** On-chain `token0` / `token1` (spot_pairs.token0 / token1). */
  token0Address: string;
  token1Address: string;
  /** Symbols/names/decimals for the asset at each **on-chain slot** (derived from spot_pairs base/quote + metadata). */
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  token0Name: string | null;
  token1Name: string | null;

  /** spot_pairs.base / quote — canonical BASE·QUOTE orientation (addresses always emitted, possibly empty strings). */
  baseAddress: string;
  quoteAddress: string;
  baseSymbol: string;
  quoteSymbol: string;
  baseName: string | null;
  quoteName: string | null;
  /** spot_pairs.bDecimal / qDecimal */
  bDecimal: number;
  qDecimal: number;

  /** spot_pairs.symbol */
  spotPairSymbol: string;
  /** spot_pairs.type (`stable` | `volatile` for basic pools). */
  spotPairType: string;
  listed: boolean;
  exchange: string;
  feeSource: string;
  dynamicFee: boolean;
  /** spot_pairs.listingDate (unix seconds). */
  listingDate: number;

  /** spot_pairs.totalSwapFeesUsd — lifetime swap fees (USD) when the fee token is priced. */
  totalSwapFeesUsd: number;
  /** spot_pairs.daySwapFeesUsd — UTC-day cumulative; resets with the pair day window. */
  daySwapFeesUsd: number;

  poolType: string;
  isStable: boolean;
  feeRate: number | null;
  tickSpacing: number | null;
  isVotingEnabled: boolean;
  /** True when both token0 and token1 are whitelisted on Voter (permissionless gauge creation allowed). */
  gaugeWhitelisted: boolean;
  grade: number;
  isGradeManualOverride: boolean;
  factoryAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PoolListResponse {
  pools: AdminPoolInfo[];
  total: number;
}

export interface AdminPoolStats {
  tvlUsd: string;
  reserve0: string;
  reserve1: string;
  reserve0Usd: string;
  reserve1Usd: string;
  volume24hUsd: string;
  volume7dUsd: string;
  fees24hUsd: string;
  fees7dUsd: string;
  feesTotalUsd: string;
  txCount24h: number;
  apr24h: string;
  apr7d: string;
  feeBps: number | null;
  feePercent: string | null;
  gaugeAddress: string | null;
  hasGauge: boolean;
  isGaugeAlive: boolean;
  emissionApr: string | null;
  annualEmissionUsd: string | null;
  rewardRate: string | null;
  periodFinish: number | null;
  updatedAt: string;
}

export interface AdminPoolDetailInfo extends AdminPoolInfo {
  pointTier: number;
  stats: AdminPoolStats | null;
}

export interface AdminPoolTimeBucketDto {
  pair: string;
  resolution: string;
  bucketIndex: number;
  bucketStartTs: number;
  bucketEndTs: number;
  base: string;
  quote: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  average: number;
  difference: number;
  differencePercentage: number;
  baseVolumeUSD: number;
  quoteVolumeUSD: number;
  baseLiquidityUSD: number;
  quoteLiquidityUSD: number;
  count: number;
}

export interface AdminPoolTimeBucketsResponse {
  pair: string;
  resolution: string;
  items: AdminPoolTimeBucketDto[];
}

export interface AdminExchangeTimeBucketDto {
  protocolId: string;
  resolution: string;
  timestamp: number;
  networkName: string;
  totalVolume: number;
  totalFeesUsd: number;
  tvl: number;
  totalGlobalTrades: number;
  totalGlobalPairs: number;
  totalGlobalTraders: number;
}

export interface AdminExchangeTimeBucketsResponse {
  protocolId: string;
  resolution: string;
  items: AdminExchangeTimeBucketDto[];
}

export interface UpdatePoolVotingRequest {
  isVotingEnabled: boolean;
}

export interface UpdatePoolListedRequest {
  listed: boolean;
}

export interface UpdatePoolGradeRequest {
  grade: 1 | 2 | 3;
  isManualOverride?: boolean;
}

// ============================================================================
// Indexer Admin Types
// ============================================================================

export interface SyncStatus {
  lastBlock: number;
  currentBlock: number;
  isSynced: boolean;
  blocksRemaining: number;
}

export interface BackfillJob {
  poolAddress: string;
  fromBlock: number;
}

export interface BackfillStatus {
  size: number;
  isProcessing: boolean;
  jobs: BackfillJob[];
}

export interface RebuildStatus {
  isRunning: boolean;
}

export interface RebuildResult {
  processed: number;
  successful: number;
  failed: number;
  duration: number;
}

export interface FullRebuildResult {
  lp: RebuildResult;
  lock: RebuildResult;
  vote: RebuildResult;
}

export interface RebuildResponse {
  success: boolean;
  message: string;
  result?: RebuildResult | FullRebuildResult;
}

export interface SyncTriggerResponse {
  success: boolean;
  message: string;
}

export interface SyncResetResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// Cache Admin Types
// ============================================================================

export interface CacheKeyInfo {
  key: string;
  value: string | null;
  ttl: number;
  type: string;
}

export interface CacheKeyListItem {
  key: string;
  valuePreview: string | null;
  ttl: number;
}

export interface CacheKeysResponse {
  keys: string[];
  items: CacheKeyListItem[];
  count: number;
}

export interface CacheDeleteResponse {
  deletedCount: number;
}

// ============================================================================
// Blockchain Event Types
// ============================================================================

export type EventCategory =
  | 'POOL'
  | 'CL_POOL'
  | 'GAUGE'
  | 'CL_GAUGE'
  | 'VE'
  | 'VOTER'
  | 'NFT_POSITION'
  | 'MINTER'
  | 'REWARD'
  | 'REWARDS_DISTRIBUTOR'
  | 'FACTORY';

export type EventTypeValue =
  | 'MINT'
  | 'BURN'
  | 'SWAP'
  | 'SYNC'
  | 'FEES'
  | 'CLAIM'
  | 'INITIALIZE'
  | 'COLLECT'
  | 'FLASH'
  | 'SET_FEE_PROTOCOL'
  | 'COLLECT_PROTOCOL'
  | 'INCREASE_OBSERVATION_CARDINALITY'
  | 'INCREASE_LIQUIDITY'
  | 'DECREASE_LIQUIDITY'
  | 'NFT_COLLECT'
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'NOTIFY_REWARD'
  | 'CLAIM_REWARDS'
  | 'CLAIM_FEES'
  | 'SUPPLY'
  | 'MERGE'
  | 'SPLIT'
  | 'LOCK_PERMANENT'
  | 'UNLOCK_PERMANENT'
  | 'DELEGATE_CHANGED'
  | 'GAUGE_CREATED'
  | 'GAUGE_KILLED'
  | 'GAUGE_REVIVED'
  | 'VOTED'
  | 'ABSTAINED'
  | 'DISTRIBUTE_REWARD'
  | 'WHITELIST_TOKEN'
  | 'WHITELIST_NFT'
  | 'MINTER_MINT'
  | 'NUDGE'
  | 'CHECKPOINT_TOKEN'
  | 'CLAIMED'
  | 'POOL_CREATED'
  | 'TICK_SPACING_ENABLED'
  | 'SWAP_FEE_MODULE_CHANGED'
  | 'UNSTAKED_FEE_MODULE_CHANGED'
  | 'DEFAULT_UNSTAKED_FEE_CHANGED';

export interface BlockchainEventItem {
  id: string;
  txHash: string;
  logIndex: number;
  blockNumber: string;
  blockTimestamp: string;
  category: EventCategory;
  eventType: string;
  poolType: string | null;
  contractAddress: string;
  poolAddress: string | null;
  userAddress: string | null;
  amount0: string | null;
  amount1: string | null;
  amountUsd: string | null;
  createdAt: string;
}

export interface BlockchainEventListResponse {
  events: BlockchainEventItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface BlockchainEventQuery {
  category?: EventCategory;
  eventType?: EventTypeValue;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Banner Admin Types
// ============================================================================

export interface AdminBannerInfo {
  id: number;
  title: string;
  page: BannerPage;
  linkUrl: string | null;
  clickTarget: BannerClickTarget;
  imagePcUrl: string | null;
  imageMobileUrl: string | null;
  status: BannerStatus;
  startAt: string | null;
  endAt: string | null;
  impressions: number;
  clicks: number;
  ctr: string;
  createdAt: string;
  updatedAt: string;
}

export interface BannerListResponse {
  banners: AdminBannerInfo[];
  total: number;
}

export interface CreateBannerRequest {
  title: string;
  page: BannerPage;
  linkUrl?: string;
  clickTarget?: BannerClickTarget;
  startAt?: string;
  endAt?: string;
}

export interface UpdateBannerRequest {
  title?: string;
  linkUrl?: string;
  clickTarget?: BannerClickTarget;
  startAt?: string;
  endAt?: string;
}

// ============================================================================
// Base Point Config Types
// ============================================================================

export type BasePointConfigStatus = 'ACTIVE' | 'EXPIRED';

export interface BasePointConfig {
  id: number;
  lpWeight: string;
  tradeWeight: string;
  status: BasePointConfigStatus;
  createdBy: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateBasePointConfigRequest {
  lpWeight: number;
  tradeWeight: number;
  createdBy?: string;
  memo?: string;
}

export interface BasePointConfigHistoryResponse {
  items: BasePointConfig[];
  total: number;
}

// ============================================================================
// Faucet Registry Types
// ============================================================================

export interface AdminFaucetInfo {
  faucetAddress: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  createdAt: string;
}

export interface FaucetListResponse {
  faucets: AdminFaucetInfo[];
  total: number;
}

export interface RegisterFaucetRequest {
  faucetAddress: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
}

// ============================================================================
// Watched Wallet Types
// ============================================================================

export interface AdminWatchedWalletDto {
  id: string;
  address: string;
  label: string;
  createdAt: string;
}

// ============================================================================
// Referral User-Facing Types
// ============================================================================

export interface ReferralCodeResponse {
  address: string;
  code: string;
}

export interface ReferralClaimRequest {
  refereeAddress: string;
  referralCode: string;
}

export interface ReferralClaimResponse {
  success: boolean;
  alreadyClaimed: boolean;
  referrerAddress?: string;
}
