/**
 * Admin API Type Definitions
 *
 * API types are re-exported from @giwater/shared (single source of truth).
 * Client-only types are defined below.
 */

// Re-export shared admin DTO types
export type {
  AdminRole,
  SeasonPhase,
  SeasonStatus,
  RewardType,
  Sector,
  SeasonWeight,
  SeasonConfig,
  CreateSeasonRequest,
  UpdateSeasonRequest,
  UpdateSeasonWeightsRequest,
  UpdateSeasonStatusRequest,
  SeasonParticipation,
  PointSourceType,
  PointStatus,
  PointBalance,
  PointHistoryItem,
  PointHistoryResponse,
  PointHistoryQuery,
  LeaderboardEntry,
  LeaderboardResponse,
  LeaderboardQuery,
  MiningRate,
  TriggerDistributionRequest,
  SectorBreakdown,
  LayerBreakdown,
  DistributionSummary,
  RefereeInfo,
  ReferralStats,
  ReferralRewardItem,
  BlacklistReason,
  BlacklistEntry,
  AddBlacklistRequest,
  BadgeType,
  BadgeCategory,
  BadgeDefinition,
  UserBadge,
  GrantBadgeRequest,
  CreateSeasonBadgeDefinitionRequest,
  CreateCustomBadgeDefinitionRequest,
  UpdateBadgeDefinitionRequest,
  AssignCustomBadgeRequest,
  AssignCustomBadgeResponse,
  BadgeDefinitionListResponse,
  BadgeAssignedUsersResponse,
  ReferralOverview,
  ReferralTier,
  ReferrerListItem,
  ReferrerListResponse,
  ReferrerDetail,
  UpdateKolTierRequest,
  UpdateKolTierResponse,
  ReferralListQuery,
  ProvisionReferrerRequest,
  ProvisionReferrerResponse,
  AdminApiError,
  DashboardStats,
  AdminTokenInfo,
  TokenListResponse,
  CreateTokenRequest,
  UpdateTokenRequest,
  AdminPoolInfo,
  PoolListResponse,
  AdminPoolStats,
  AdminPoolDetailInfo,
  AdminPoolTimeBucketDto,
  AdminPoolTimeBucketsResponse,
  AdminExchangeTimeBucketDto,
  AdminExchangeTimeBucketsResponse,
  UpdatePoolVotingRequest,
  UpdatePoolListedRequest,
  UpdatePoolGradeRequest,
  SyncStatus,
  BackfillJob,
  BackfillStatus,
  RebuildStatus,
  RebuildResult,
  FullRebuildResult,
  RebuildResponse,
  SyncTriggerResponse,
  SyncResetResponse,
  CacheKeyInfo,
  CacheKeyListItem,
  CacheKeysResponse,
  CacheDeleteResponse,
  EventCategory,
  EventTypeValue,
  BlockchainEventItem,
  BlockchainEventListResponse,
  BlockchainEventQuery,
  AdminBannerInfo,
  BannerListResponse,
  CreateBannerRequest,
  UpdateBannerRequest,
  BasePointConfigStatus,
  BasePointConfig,
  UpdateBasePointConfigRequest,
  BasePointConfigHistoryResponse,
  DailyProtocolStatsItem,
  DailyProtocolStatsResponse,
  AdminFaucetInfo,
  FaucetListResponse,
  RegisterFaucetRequest,
} from '@giwater/shared';

// Re-export shared common types that were previously in this file
export type { SuccessResponse } from '@giwater/shared';

// Re-export banner enum types used by admin types
export type { BannerStatus, BannerPage, BannerClickTarget } from '@giwater/shared';

// ============================================================================
// Client-Only Types (not shared with backend)
// ============================================================================

import type { AdminRole } from '@giwater/shared';

/**
 * Admin authentication context (client-side only)
 */
export interface AdminAuthContext {
  isAuthenticated: boolean;
  role: AdminRole | null;
  token?: string;
  login: (token: string) => Promise<void>;
  logout: () => void;
}
