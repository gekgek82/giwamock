/**
 * Portfolio API DTO Types
 *
 * Types for the portfolio API endpoints.
 */

import type { PaginationInfo } from './common';

// ============================================================================
// Common Types
// ============================================================================

export interface BaseTokenInfo {
  address: string;
  symbol: string;
  decimals: number;
}

// ============================================================================
// Portfolio Overview
// ============================================================================

export interface FeeBreakdown {
  poolAddress: string;
  token0Amount: string;
  token0Symbol: string;
  token1Amount: string;
  token1Symbol: string;
  usdValue: string;
}

export interface PortfolioOverview {
  assetsByPool: {
    activePools: number;
    totalDepositUsd: string;
    avgNetApr: string;
  };
  pendingRewards: {
    totalUnclaimedUsd: string;
    fee: {
      totalUsd: string;
      breakdown: FeeBreakdown[];
    };
    terPoint: {
      amount: string;
      totalEarned?: string;
      totalClaimed?: string;
      onChainBalance?: string;
      usdValue: string | null;
    };
    vote: {
      amount: string;
      symbol: string;
    };
  };
  updatedAt: string;
}

// ============================================================================
// Liquidity Position
// ============================================================================

export interface PriceRange {
  min: string;
  max: string;
  currentPrice: string;
  inRange: boolean;
}

export interface LiquidityPosition {
  id: string;
  poolAddress: string;
  token0: BaseTokenInfo;
  token1: BaseTokenInfo;
  strategy: 'Basic' | 'Concentrated';
  volatility: 'Stable' | 'Volatile';
  volatilityValue: number;
  poolType: 'BASIC' | 'CL';
  tickSpacing: number | null;
  priceRange: PriceRange | null;
  feePercent: string;
  deposited: {
    token0Amount: string;
    token1Amount: string;
    usdValue: string;
  };
  poolInventory: {
    token0Amount: string;
    token1Amount: string;
    token0Symbol: string;
    token1Symbol: string;
  };
  stake: {
    status: 'ready' | 'working' | 'off';
    apr: string;
    isStaked: boolean;
    token0Amount: string;
    token1Amount: string;
    usdValue: string;
  };
  rewards: {
    terPoint: string;
    swapFees: {
      token0Amount: string;
      token1Amount: string;
      usdValue: string;
    };
  };
  lpTokenBalance: string;
  poolShare: string;
  tokenId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LiquidityPositionsResponse {
  positions: LiquidityPosition[];
  pagination: PaginationInfo;
}

// ============================================================================
// Lock Position
// ============================================================================

export interface LockPosition {
  id: string;
  tokenId: string;
  lockedAmount: string;
  lockedSymbol: string;
  votingPower: string;
  lockDuration: {
    weeks: number;
    startDate: string;
    endDate: string;
  };
  isExpired: boolean;
  canWithdraw: boolean;
  rewards: {
    claimable: string;
    claimed: string;
  };
  createdAt: string;
}

export interface LockPositionsResponse {
  positions: LockPosition[];
  summary: {
    totalLocked: string;
    totalVotingPower: string;
    totalLocks: number;
  };
  pagination: PaginationInfo;
}

// ============================================================================
// Vote Position
// ============================================================================

export interface VoteRewardTokenBreakdown {
  symbol: string;
  amount: string;
  usdValue: string;
}

export interface VotePosition {
  id: string;
  lockTokenId: string;
  poolAddress: string;
  poolName: string;
  /** Pool's token0/token1 descriptors, used by the Vote tab to render a TokenPairIcon. */
  token0: BaseTokenInfo;
  token1: BaseTokenInfo;
  /** Strategy / volatility / tick-spacing are derived from the Pool entity so the row can show "Concentrated Volatile 200" style labels. */
  strategy: 'Basic' | 'Concentrated';
  volatility: 'Stable' | 'Volatile';
  volatilityValue: number;
  poolType: 'BASIC' | 'CL';
  tickSpacing: number | null;
  /** Annualized % APR for this pool (reuses the emission APR from PoolStats). */
  estimatedApr: string;
  /** Human-formatted locked amount of the Lock that produced this vote (e.g. "7.12345"). */
  lockedAmount: string;
  lockedSymbol: string;
  votingPower: string;
  percentage: string;
  epoch: number;
  estimatedRewards: {
    swapFee: {
      token0: VoteRewardTokenBreakdown;
      token1: VoteRewardTokenBreakdown;
      usdValue: string;
    };
    incentive: {
      tokens: VoteRewardTokenBreakdown[];
      usdValue: string;
    };
    totalUsd: string;
  };
  votedAt: string;
}

export interface VotePositionsResponse {
  positions: VotePosition[];
  summary: {
    totalVotingPower: string;
    usedVotingPower: string;
    availableVotingPower: string;
    currentEpoch: number;
    epochEndsAt: string;
  };
  pagination: PaginationInfo;
}

// ============================================================================
// Point Position
// ============================================================================

export type PointEarningType = 'LP' | 'TRADING' | 'REFERRAL' | 'EMISSION';

export type PointEarningCategory = 'EVENT' | 'LIQUIDITY_STAKING' | 'SWAP';

export type PointEarningStatus = 'PENDING' | 'READY_TO_CLAIM' | 'CLAIMED';

export interface PointEarning {
  id: string;
  type: PointEarningType;
  category: PointEarningCategory;
  /** Server-composed display label: event_type (if set) else sector-derived. */
  typeLabel: string;
  /** Raw event_type column value, null for system-earned rows. */
  eventType: string | null;
  amount: string;
  status: PointEarningStatus;
  earnedAt: string;
  claimedAt: string | null;
  claimTxHash: string | null;
  sourcePoolAddress?: string;
  sourcePoolName?: string;
}

export interface PointEarningsQuery {
  category?: PointEarningCategory;
  limit?: number;
  offset?: number;
}

export interface ClaimPointEarningResponse {
  txHash: string;
}

export interface PointPositionsResponse {
  summary: {
    totalPoints: string;
    claimablePoints: string;
    claimedPoints: string;
    onChainBalance: string;
    lockedPoints: string;
    availablePoints: string;
    vePoints: string;
    /** Count of unclaimed earnings (pending + ready-to-claim). Drives tab badge. */
    lockCount: number;
    pendingCount: number;
    readyToClaimCount: number;
  };
  earnings: PointEarning[];
  pagination: PaginationInfo;
}

// ============================================================================
// Transaction
// ============================================================================

export type TransactionType =
  | 'SWAP'
  | 'ADD_LIQUIDITY'
  | 'REMOVE_LIQUIDITY'
  | 'CLAIM'
  | 'LIQUIDITY_STAKE'
  | 'LIQUIDITY_UNSTAKE'
  | 'LOCK'
  | 'UNLOCK'
  | 'RECEIVED_VOTE_POWER';

export interface TransactionToken {
  symbol: string;
  amount: string;
  direction: 'in' | 'out';
}

export interface PortfolioTransaction {
  id: string;
  txHash: string;
  type: TransactionType;
  timestamp: string;
  usdValue: string | null;
  tokens: TransactionToken[];
  poolAddress?: string;
  poolName?: string;
  lpTokensReceived?: string;
  claimType?: string;
  lockDuration?: { weeks: number };
  votingPowerReceived?: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber: number;
}

export interface TransactionsResponse {
  transactions: PortfolioTransaction[];
  pagination: PaginationInfo & {
    totalPages: number;
  };
}

export interface TransactionQuery {
  type?: TransactionType;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Claim
// ============================================================================

export type ClaimType = 'all' | 'fees' | 'points' | 'vote' | 'bribes';

export interface ClaimRequest {
  claimType: ClaimType;
  positions?: string[];
}

export interface ClaimTransaction {
  to: string;
  data: string;
  value: string;
  description: string;
}

export interface ClaimResponse {
  transactions: ClaimTransaction[];
  estimatedGas: string;
  rewards: {
    fees?: {
      totalUsd: string;
      tokens: { symbol: string; amount: string }[];
    };
    bribes?: {
      totalUsd: string;
      tokens: { symbol: string; amount: string }[];
    };
    points?: {
      amount: string;
      txHash?: string;
    };
    rebase?: {
      amount: string;
      amountUsd: string;
    };
  };
  claimId?: number;
  contractEnabled?: boolean;
}

/** Per-position LP point claim — portfolio liquidity tab "Claim" button. */
export interface ClaimPositionPointsRequest {
  /** LP pool address (0x...). Lowercased server-side. */
  poolAddress: string;
  /** NFT tokenId for CL positions; omit/empty string for basic pools. */
  tokenId?: string;
}

export interface ClaimPositionPointsResponse {
  /** Claimed points (decimal string). */
  amount: string;
  /** DB row id of the PointClaim record. */
  claimId: number;
  /** On-chain mint transaction hash. Present only when `onChain` is true. */
  txHash?: string;
  /**
   * True if the claim was settled on-chain via TerPoint mint (post-TGE).
   * False when it was an off-chain bookkeeping-only claim (pre-TGE).
   */
  onChain: boolean;
}

// ============================================================================
// tPOINT Lock (Pre-TGE offchain)
// ============================================================================

export interface TPointLockPosition {
  id: number;
  userAddress: string;
  amount: string;
  lockedSymbol: string;
  votingPower: string;
  lockDays: number;
  lockStart: string;
  lockEnd: string;
  isActive: boolean;
  /** True when the user has opted into automatic renewal to the max lock duration. */
  autoMax: boolean;
  createdAt: string;
}

export interface TPointLocksResponse {
  locks: TPointLockPosition[];
  summary: {
    totalLocked: string;
    totalVotingPower: string;
    totalLocks: number;
  };
}

export interface TPointVotingPower {
  walletAddress: string;
  totalVotingPower: string;
  activeLocks: number;
}

export interface TPointVotePosition {
  id: number;
  tpointLockId: number;
  poolAddress: string;
  votingPower: string;
  percentage: string;
  epoch: number;
  votedAt: string;
}

export interface TPointVotesResponse {
  votes: TPointVotePosition[];
  summary: {
    totalVotingPower: string;
    usedVotingPower: string;
    currentEpoch: number;
  };
}

export interface MergeTPointLocksRequest {
  walletAddress: string;
  baseLockId: number;
  sourceLockIds: number[];
  signature: string;
  message: string;
}

export interface ExtendTPointLockRequest {
  walletAddress: string;
  /** New total lock duration in days from now. Must exceed the current remaining days. */
  newDurationDays: number;
  /** Whether the lock should be pinned to MAX_LOCK_DAYS via automatic renewal. */
  autoMax: boolean;
  signature: string;
  message: string;
}

export interface PokeTPointLockRequest {
  walletAddress: string;
  signature: string;
  message: string;
}

export interface DisableAutoMaxTPointLockRequest {
  walletAddress: string;
  signature: string;
  message: string;
}

export interface TPointLockPokeResponse {
  lock: TPointLockPosition;
  previousVotingPower: string;
  newVotingPower: string;
  /** Number of current-epoch votes whose allocated voting power was re-snapshot. */
  affectedVotes: number;
  currentEpoch: number;
}

// ============================================================================
// LP Stake Intent (Pre-TGE offchain)
// ============================================================================

export interface LpStakeIntent {
  id: number;
  walletAddress: string;
  poolAddress: string;
  /**
   * NFT tokenId for CL positions; empty string for basic pools. A user can
   * own multiple CL NFTs in the same pool at different tick ranges, so the
   * intent is keyed per-NFT.
   */
  tokenId: string;
  /**
   * Absolute staked amount — wei for basic pools, liquidity units for CL.
   * Decoupled from the user's current balance so partial withdraws don't
   * distort the recorded stake. See CLAUDE.md "Pre-TGE Phase".
   */
  stakedAmount: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SetLpStakeIntentRequest {
  walletAddress: string;
  poolAddress: string;
  /** NFT tokenId for CL positions. Omit or send '' for basic pools. */
  tokenId?: string;
  /** Absolute amount to treat as staked (wei or liquidity units). "0" clears. */
  stakedAmount: string;
  /** personal_sign signature over `message` produced by `walletAddress`. */
  signature: string;
  /** The plaintext message signed by the wallet. */
  message: string;
}

export interface LpStakeIntentsResponse {
  intents: LpStakeIntent[];
}

// ============================================================================
// Vote Incentive (Pre-TGE offchain)
// ============================================================================

export interface VoteIncentive {
  id: number;
  walletAddress: string;
  poolAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  /** Absolute wei amount registered. Append-only — incentives are non-refundable. */
  amount: string;
  amountUsd: string;
  epoch: number;
  createdAt: string;
}

export interface AddVoteIncentiveRequest {
  walletAddress: string;
  poolAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string;
  amountUsd?: string;
  epoch: number;
  signature: string;
  message: string;
}

export interface VoteIncentivesResponse {
  incentives: VoteIncentive[];
}

export interface PoolEpochIncentivesResponse {
  poolAddress: string;
  epoch: number;
  incentives: VoteIncentive[];
  totalAmountUsd: string;
}

// ============================================================================
// Claimable Rewards
// ============================================================================

export interface ClaimableReward {
  poolAddress: string;
  poolName: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  amountUsd: string;
}

export interface ClaimableRewardsResponse {
  bribes: ClaimableReward[];
  fees: ClaimableReward[];
  rebase: { amount: string; amountUsd: string };
  totalUsd: string;
}

// ============================================================================
// Error
// ============================================================================

export interface PortfolioApiError {
  error: string;
  message: string;
  statusCode: number;
}
