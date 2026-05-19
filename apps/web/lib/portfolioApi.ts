/**
 * GiwaTer Portfolio API Client
 *
 * Provides access to user portfolio data including:
 * - Overview (assets, pending rewards)
 * - Liquidity positions
 * - Lock positions
 * - Vote positions
 * - Point positions
 * - Transaction history
 * - Claim rewards
 *
 * @see docs/portfolio-api-guide.md
 */

import type {
  PortfolioOverview,
  LiquidityPositionsResponse,
  LockPositionsResponse,
  VotePositionsResponse,
  PointPositionsResponse,
  PointEarningsQuery,
  ClaimPointEarningResponse,
  TransactionsResponse,
  TransactionQuery,
  ClaimRequest,
  ClaimResponse,
  ClaimPositionPointsRequest,
  ClaimPositionPointsResponse,
  ClaimableRewardsResponse,
  TPointLockPosition,
  TPointLocksResponse,
  TPointLockPokeResponse,
  TPointVotingPower,
  TPointVotePosition,
  TPointVotesResponse,
  LpStakeIntent,
  LpStakeIntentsResponse,
  VoteIncentive,
  AddVoteIncentiveRequest,
  PoolEpochIncentivesResponse,
  VoteIncentivesResponse,
} from "@/types/portfolio";
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

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Custom error class for Portfolio API errors
 */
export class PortfolioApiClientError extends Error {
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
    this.name = "PortfolioApiClientError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.endpoint = endpoint;
  }
}

// ============================================================================
// API Client Class
// ============================================================================

/**
 * Portfolio API Client
 *
 * Example usage:
 * ```typescript
 * import { portfolioApi } from '@/lib/portfolioApi';
 *
 * // Get portfolio overview
 * const overview = await portfolioApi.getOverview('0x1234...');
 *
 * // Get liquidity positions
 * const positions = await portfolioApi.getLiquidityPositions('0x1234...');
 * ```
 */
class PortfolioApi {
  private config: ApiClientConfig;

  constructor(baseUrl: string = BASE_URL) {
    this.config = {
      baseUrl,
      createError: (message, statusCode, errorCode, endpoint) =>
        new PortfolioApiClientError(message, statusCode, errorCode, endpoint),
      isOwnError: (error) => error instanceof PortfolioApiClientError,
      networkErrorLabel: "portfolio API",
    };
  }

  private fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return apiFetch<T>(this.config, endpoint, options);
  }

  // ==========================================================================
  // Portfolio Overview
  // ==========================================================================

  /**
   * Get portfolio overview for a wallet address
   *
   * @param walletAddress - Wallet address (0x...)
   * @returns Portfolio overview including assets and pending rewards
   */
  async getOverview(walletAddress: string): Promise<PortfolioOverview> {
    return this.fetch<PortfolioOverview>(
      `/portfolio/${walletAddress}/overview`,
    );
  }

  // ==========================================================================
  // Liquidity Positions
  // ==========================================================================

  /**
   * Get liquidity positions for a wallet address
   *
   * @param walletAddress - Wallet address (0x...)
   * @param limit - Items per page (default: 50, max: 100)
   * @param offset - Pagination offset (default: 0)
   * @returns Paginated list of liquidity positions
   */
  async getLiquidityPositions(
    walletAddress: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<LiquidityPositionsResponse> {
    return this.fetch<LiquidityPositionsResponse>(
      `/portfolio/${walletAddress}/positions/liquidity${buildQuery({ limit, offset })}`,
    );
  }

  // ==========================================================================
  // Lock Positions
  // ==========================================================================

  /**
   * Get lock positions for a wallet address
   *
   * @param walletAddress - Wallet address (0x...)
   * @param limit - Items per page (default: 50, max: 100)
   * @param offset - Pagination offset (default: 0)
   * @returns Paginated list of lock positions with summary
   */
  async getLockPositions(
    walletAddress: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<LockPositionsResponse> {
    return this.fetch<LockPositionsResponse>(
      `/portfolio/${walletAddress}/positions/locks${buildQuery({ limit, offset })}`,
    );
  }

  // ==========================================================================
  // Vote Positions
  // ==========================================================================

  /**
   * Get vote positions for a wallet address
   *
   * @param walletAddress - Wallet address (0x...)
   * @param epoch - Specific epoch (optional, defaults to current)
   * @param limit - Items per page (default: 50, max: 100)
   * @param offset - Pagination offset (default: 0)
   * @returns Paginated list of vote positions with summary
   */
  async getVotePositions(
    walletAddress: string,
    epoch?: number,
    limit: number = 50,
    offset: number = 0,
  ): Promise<VotePositionsResponse> {
    return this.fetch<VotePositionsResponse>(
      `/portfolio/${walletAddress}/positions/votes${buildQuery({ limit, offset, epoch })}`,
    );
  }

  // ==========================================================================
  // Point Positions
  // ==========================================================================

  /**
   * Get point positions for a wallet address.
   *
   * Accepts either legacy positional args (wallet, limit, offset) or the new
   * options object with an optional `category` filter. The options form is
   * preferred; the positional form is kept for backwards compatibility.
   */
  async getPointPositions(
    walletAddress: string,
    optsOrLimit: PointEarningsQuery | number = 50,
    offset: number = 0,
  ): Promise<PointPositionsResponse> {
    const opts: PointEarningsQuery =
      typeof optsOrLimit === "number"
        ? { limit: optsOrLimit, offset }
        : optsOrLimit;

    return this.fetch<PointPositionsResponse>(
      `/portfolio/${walletAddress}/positions/points${buildQuery({
        limit: opts.limit ?? 50,
        offset: opts.offset ?? 0,
        category: opts.category,
      })}`,
    );
  }

  /**
   * Claim a single point earning row.
   *
   * @param walletAddress - Wallet address (0x...)
   * @param earningId - PointHistory row id
   */
  async claimPointEarning(
    walletAddress: string,
    earningId: string | number,
  ): Promise<ClaimPointEarningResponse> {
    return this.fetch<ClaimPointEarningResponse>(
      `/portfolio/${walletAddress}/positions/points/${earningId}/claim`,
      { method: "POST" },
    );
  }

  // ==========================================================================
  // Transaction History
  // ==========================================================================

  /**
   * Get transaction history for a wallet address
   *
   * @param walletAddress - Wallet address (0x...)
   * @param query - Query parameters (type, limit, offset)
   * @returns Paginated list of transactions
   */
  async getTransactions(
    walletAddress: string,
    query?: TransactionQuery,
  ): Promise<TransactionsResponse> {
    const qs = buildQuery({
      limit: query?.limit,
      offset: query?.offset,
      type: query?.type,
    });
    return this.fetch<TransactionsResponse>(
      `/portfolio/${walletAddress}/transactions${qs}`,
    );
  }

  // ==========================================================================
  // Claimable Rewards
  // ==========================================================================

  /**
   * Get claimable rewards breakdown for a wallet address
   *
   * @param walletAddress - Wallet address (0x...)
   * @returns Claimable rewards breakdown (bribes, fees, rebase, total)
   */
  async getClaimableRewards(
    walletAddress: string,
  ): Promise<ClaimableRewardsResponse> {
    return this.fetch<ClaimableRewardsResponse>(
      `/portfolio/${walletAddress}/claimable-rewards`,
    );
  }

  // ==========================================================================
  // Claim Rewards
  // ==========================================================================

  /**
   * Prepare claim transactions for rewards
   *
   * @param walletAddress - Wallet address (0x...)
   * @param request - Claim request (type and optional position IDs)
   * @returns Transaction data for claiming rewards
   */
  async claimRewards(
    walletAddress: string,
    request: ClaimRequest,
  ): Promise<ClaimResponse> {
    return this.fetch<ClaimResponse>(`/portfolio/${walletAddress}/claim`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  /**
   * Claim LP points accrued by a single staked position. Used by the
   * portfolio liquidity tab's per-row "Claim" button. Pre-TGE this is an
   * off-chain bookkeeping update; post-TGE it triggers an on-chain TER mint.
   */
  async claimPositionPoints(
    walletAddress: string,
    request: ClaimPositionPointsRequest,
  ): Promise<ClaimPositionPointsResponse> {
    return this.fetch<ClaimPositionPointsResponse>(
      `/portfolio/${walletAddress}/claim-points/position`,
      {
        method: "POST",
        body: JSON.stringify(request),
      },
    );
  }

  // ==========================================================================
  // Transaction Notification
  // ==========================================================================

  /**
   * Notify backend about a new transaction for immediate indexing.
   *
   * @param txHash - Transaction hash (0x...)
   * @returns Processing result
   */
  async notifyTransaction(
    txHash: string,
  ): Promise<{ processed: number; skipped: number; errors: number }> {
    return this.fetch<{ processed: number; skipped: number; errors: number }>(
      "/portfolio/notify-transaction",
      {
        method: "POST",
        body: JSON.stringify({ txHash }),
      },
    );
  }

  // ==========================================================================
  // tPOINT Lock (Pre-TGE offchain)
  // ==========================================================================

  async createTPointLock(
    walletAddress: string,
    amount: string,
    durationDays: number,
    signature: string,
    message: string,
  ): Promise<TPointLockPosition> {
    return this.fetch<TPointLockPosition>("/tpoint-lock/lock", {
      method: "POST",
      body: JSON.stringify({
        walletAddress,
        amount,
        durationDays,
        signature,
        message,
      }),
    });
  }

  async getTPointLocks(walletAddress: string): Promise<TPointLocksResponse> {
    return this.fetch<TPointLocksResponse>(
      `/tpoint-lock/locks/${walletAddress}`,
    );
  }

  async getTPointLockById(id: number): Promise<TPointLockPosition> {
    return this.fetch<TPointLockPosition>(`/tpoint-lock/lock/${id}`);
  }

  async increaseTPointLock(
    id: number,
    walletAddress: string,
    amount: string,
    signature: string,
    message: string,
  ): Promise<TPointLockPosition> {
    return this.fetch<TPointLockPosition>(`/tpoint-lock/lock/${id}/increase`, {
      method: "POST",
      body: JSON.stringify({
        walletAddress,
        amount,
        signature,
        message,
      }),
    });
  }

  async extendTPointLock(
    id: number,
    walletAddress: string,
    newDurationDays: number,
    autoMax: boolean,
    signature: string,
    message: string,
  ): Promise<TPointLockPosition> {
    return this.fetch<TPointLockPosition>(`/tpoint-lock/lock/${id}/extend`, {
      method: "POST",
      body: JSON.stringify({
        walletAddress,
        newDurationDays,
        autoMax,
        signature,
        message,
      }),
    });
  }

  async disableAutoMaxTPointLock(
    id: number,
    walletAddress: string,
    signature: string,
    message: string,
  ): Promise<TPointLockPosition> {
    return this.fetch<TPointLockPosition>(
      `/tpoint-lock/lock/${id}/disable-auto-max`,
      {
        method: "POST",
        body: JSON.stringify({ walletAddress, signature, message }),
      },
    );
  }

  async unlockTPoint(
    id: number,
    walletAddress: string,
    signature: string,
    message: string,
  ): Promise<void> {
    await this.fetch(`/tpoint-lock/lock/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ walletAddress, signature, message }),
    });
  }

  async mergeTPointLocks(
    walletAddress: string,
    baseLockId: number,
    sourceLockIds: number[],
    signature: string,
    message: string,
  ): Promise<TPointLockPosition> {
    return this.fetch<TPointLockPosition>("/tpoint-lock/merge", {
      method: "POST",
      body: JSON.stringify({
        walletAddress,
        baseLockId,
        sourceLockIds,
        signature,
        message,
      }),
    });
  }

  async pokeTPointLock(
    id: number,
    walletAddress: string,
    signature: string,
    message: string,
  ): Promise<TPointLockPokeResponse> {
    return this.fetch<TPointLockPokeResponse>(
      `/tpoint-lock/lock/${id}/poke`,
      {
        method: "POST",
        body: JSON.stringify({ walletAddress, signature, message }),
      },
    );
  }

  async getTPointVotingPower(
    walletAddress: string,
  ): Promise<TPointVotingPower> {
    return this.fetch<TPointVotingPower>(
      `/tpoint-lock/voting-power/${walletAddress}`,
    );
  }

  async tpointVote(
    walletAddress: string,
    lockId: number,
    poolAddress: string,
    percentage: number,
    signature: string,
    message: string,
  ): Promise<TPointVotePosition> {
    return this.fetch<TPointVotePosition>("/tpoint-lock/vote", {
      method: "POST",
      body: JSON.stringify({
        walletAddress,
        lockId,
        poolAddress,
        percentage,
        signature,
        message,
      }),
    });
  }

  async getTPointVotes(
    walletAddress: string,
    epoch?: number,
  ): Promise<TPointVotesResponse> {
    return this.fetch<TPointVotesResponse>(
      `/tpoint-lock/votes/${walletAddress}${buildQuery({ epoch })}`,
    );
  }

  async resetTPointVotes(
    walletAddress: string,
    lockId: number,
    signature: string,
    message: string,
  ): Promise<void> {
    await this.fetch("/tpoint-lock/vote/reset", {
      method: "POST",
      body: JSON.stringify({ walletAddress, lockId, signature, message }),
    });
  }

  // ==========================================================================
  // LP Stake Intent (Pre-TGE offchain staking)
  // ==========================================================================

  /**
   * Create or update an LP staking intent for a (wallet, pool, tokenId)
   * triple. `stakedAmount` is an absolute value (wei for basic, liquidity
   * units for CL); "0" clears the intent. Pass `tokenId` for CL positions;
   * omit (or pass "") for basic pools. The signature must be produced by
   * `walletAddress` over `message`, and the message must reference the
   * pool, the tokenId (if any), and the stakedAmount.
   */
  async setLpStakeIntent(
    walletAddress: string,
    poolAddress: string,
    stakedAmount: string,
    signature: string,
    message: string,
    tokenId?: string,
  ): Promise<LpStakeIntent> {
    return this.fetch<LpStakeIntent>("/lp-stake-intent", {
      method: "POST",
      body: JSON.stringify({
        walletAddress,
        poolAddress,
        tokenId: tokenId ?? "",
        stakedAmount,
        signature,
        message,
      }),
    });
  }

  async getLpStakeIntents(
    walletAddress: string,
  ): Promise<LpStakeIntentsResponse> {
    return this.fetch<LpStakeIntentsResponse>(
      `/lp-stake-intent/${walletAddress}`,
    );
  }

  async clearLpStakeIntent(
    walletAddress: string,
    poolAddress: string,
    tokenId?: string,
  ): Promise<void> {
    const suffix = tokenId ? `/${tokenId}` : "";
    await this.fetch(
      `/lp-stake-intent/${walletAddress}/${poolAddress}${suffix}`,
      {
        method: "DELETE",
      },
    );
  }

  // ==========================================================================
  // Vote Incentive (Pre-TGE offchain)
  // ==========================================================================

  /**
   * Register a vote incentive. The signature must be produced by
   * `walletAddress` over `message`; the signed message must include the
   * pool, token, amount, and epoch so it can't be replayed.
   */
  async addVoteIncentive(
    request: AddVoteIncentiveRequest,
  ): Promise<VoteIncentive> {
    return this.fetch<VoteIncentive>("/vote-incentive", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getVoteIncentivesByWallet(
    walletAddress: string,
  ): Promise<VoteIncentivesResponse> {
    return this.fetch<VoteIncentivesResponse>(
      `/vote-incentive/wallet/${walletAddress}`,
    );
  }

  async getVoteIncentivesByPool(
    poolAddress: string,
    epoch?: number,
  ): Promise<PoolEpochIncentivesResponse> {
    const query = epoch !== undefined ? `?epoch=${epoch}` : "";
    return this.fetch<PoolEpochIncentivesResponse>(
      `/vote-incentive/pool/${poolAddress}${query}`,
    );
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Default portfolio API instance
 *
 * Use this singleton for most cases:
 * ```typescript
 * import { portfolioApi } from '@/lib/portfolioApi';
 *
 * const overview = await portfolioApi.getOverview('0x1234...');
 * ```
 */
export const portfolioApi = new PortfolioApi();

// ============================================================================
// Re-export Types
// ============================================================================

export type {
  PortfolioOverview,
  LiquidityPositionsResponse,
  LiquidityPosition,
  LockPositionsResponse,
  LockPosition,
  VotePositionsResponse,
  VotePosition,
  PointPositionsResponse,
  PointEarning,
  TransactionsResponse,
  PortfolioTransaction,
  TransactionType,
  TransactionQuery,
  ClaimRequest,
  ClaimResponse,
  ClaimPositionPointsRequest,
  ClaimPositionPointsResponse,
  ClaimableReward,
  ClaimableRewardsResponse,
  PortfolioApiError,
  TPointLockPosition,
  TPointLocksResponse,
  TPointLockPokeResponse,
  TPointVotingPower,
  TPointVotePosition,
  TPointVotesResponse,
} from "@/types/portfolio";
