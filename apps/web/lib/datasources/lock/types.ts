import type { Address } from "@/lib/datasources/types";

/**
 * Raw lock data read from `VotingEscrow`. Amount may come back negative
 * from `int128`; callers should apply `abs`. Presentation concerns (period
 * formatting, voting weight percent) live in hooks, not here.
 */
export interface RawLock {
  tokenId: bigint;
  amount: bigint;
  endTimestamp: bigint;
  isPermanent: boolean;
  votingPower: bigint;
}

/**
 * Read-only interface for veNFT / lock queries against `VotingEscrow`.
 * `getUserLocks` should return an empty array when the wallet has no locks.
 */
export interface LockDataSource {
  getNFTCount(walletAddress: Address): Promise<number>;
  getUserLocks(walletAddress: Address): Promise<RawLock[]>;
  getLockData(tokenId: bigint): Promise<RawLock | null>;
}
