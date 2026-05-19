/**
 * Indexer (Public) API DTO Types
 *
 * Types for the public-facing indexer API endpoints.
 */

// ============================================================================
// Global Stats
// ============================================================================

export interface GlobalStats {
  totalTVL: string;
  totalVolume24h: string;
  totalVolume7d: string;
  totalFees24h: string;
  totalFees7d: string;
  poolCount: number;
  updatedAt: string;
}

// ============================================================================
// Pool Stats
// ============================================================================

export interface PoolStats {
  poolAddress: string;
  token0Address: string;
  token1Address: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  token0Name?: string;
  token1Name?: string;
  isStable: boolean;
  poolType: string;
  tickSpacing?: number | null;
  tvl: string;
  reserve0: string;
  reserve1: string;
  reserve0Usd: string;
  reserve1Usd: string;
  volume24h: string;
  volume7d: string;
  fees24h: string;
  fees7d: string;
  feesTotal: string;
  txCount24h: number;
  apr24h: string;
  apr7d: string;
  feeBps?: number;
  feePercent?: string;
  gaugeAddress?: string | null;
  hasGauge?: boolean;
  isGaugeAlive?: boolean;
  emissionApr?: string | null;
  annualEmissionUsd?: string | null;
  grade: number;
  updatedAt: string;
}

export interface PoolsStatsResponse {
  pools: PoolStats[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface PoolStatsQuery {
  limit?: number;
  offset?: number;
  sortBy?: 'tvl' | 'volume24h' | 'fees24h' | 'apr';
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Token Price
// ============================================================================

export interface TokenPrice {
  address: string;
  symbol: string;
  priceUSD: string;
  updatedAt: string;
}

export interface TokenPricesResponse {
  tokens: TokenPrice[];
}

// ============================================================================
// Error
// ============================================================================

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// ============================================================================
// Health
// ============================================================================

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
}

// ============================================================================
// Contract Addresses
// ============================================================================

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  iconUrl: string | null;
  isWhitelisted?: boolean;
  isVerified?: boolean;
  stickerUrl?: string | null;
}

export interface ContractAddresses {
  chainId: number;
  contracts: {
    terToken: string;
    votingEscrow: string;
    voter: string;
    minter: string;
    rewardsDistributor: string;
    poolFactory: string;
    clPoolFactory: string;
    factoryRegistry: string;
    gaugeFactory: string;
    clGaugeFactory: string;
    votingRewardsFactory: string;
    terGovernor: string;
    epochGovernor: string;
    router: string;
    swapRouter: string;
    nftPositionManager: string;
    veArtProxy: string;
    permit2?: string;
    universalRouter?: string;
    /** Multi-asset test faucet; zero address until deployed. */
    multiTokenFaucet: string;
    /** Pool discovery registry (`PoolRegistered`). */
    poolRewardRegistry: string;
  };
  tokens: TokenInfo[];
  popularTokens: TokenInfo[];
  updatedAt: string;
}

// ============================================================================
// Token Search
// ============================================================================

export interface TokenSearchResponse {
  tokens: TokenInfo[];
  total: number;
}

export interface RegisterTokenResponse {
  success: boolean;
  token?: TokenInfo;
  error?: string;
}

// ============================================================================
// Vote / Epoch
// ============================================================================

export interface EpochInfo {
  epochNumber: number;
  startsAt: string;
  endsAt: string;
  endsInSeconds: number;
  endsInDays: number;
  votingWindowStart: string;
  votingWindowEnd: string;
  isVotingOpen: boolean;
  totalVotingPower: string;
  totalFees: string;
  totalIncentives: string;
  totalRewards: string;
}

export interface VotePoolTokenInfo {
  address: string;
  symbol: string;
  decimals: number;
}

export interface VotePoolInfo {
  poolAddress: string;
  token0: VotePoolTokenInfo;
  token1: VotePoolTokenInfo;
  isStable: boolean;
  poolType: string;
  tickSpacing?: number | null;
  feePercent: string;
  tvl: string;
  gaugeAddress: string;
  voteWeight: string;
  voteShare: string;
  fees7d: string;
  incentives: string;
  totalRewards: string;
  vAPR: string;
  emissionApr: string;
}

export interface VotePoolsQuery {
  sortBy?: 'rewards' | 'votes' | 'fees' | 'tvl';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface VotePoolsResponse {
  pools: VotePoolInfo[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

// ============================================================================
// Liquidity Distribution
// ============================================================================

export interface LiquidityBar {
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  price: number;
}

export interface LiquidityDistributionResponse {
  currentTick: number;
  currentPrice: number;
  tickSpacing: number;
  bars: LiquidityBar[];
}
