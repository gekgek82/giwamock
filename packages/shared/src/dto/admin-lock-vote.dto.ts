export interface PairLockStatDto {
  pool: string;
  label: string;
  totalLockedAmount: string;
}

export interface AdminLockStatsDto {
  pool: string | null;
  totalLockedAmount: string;
  activeLockCount: number;
  avgRemainingDays: number;
  pairStats: PairLockStatDto[];
}

export interface AdminLockEventDto {
  id: string;
  tokenId: string;
  owner: string;
  eventType: string;
  depositType: string | null;
  value: string;
  lockEnd: string | null;
  transactionHash: string;
  blockTimestamp: string;
}

export interface AdminLockEventsDto {
  events: AdminLockEventDto[];
  total: number;
}

export interface EpochLockBucketDto {
  epochNumber: number;
  epochTimestamp: string;
  totalLockedAmount: string;
}

export interface AdminLockByEpochDto {
  epochs: EpochLockBucketDto[];
}

export interface PairVoteStatDto {
  pool: string;
  label: string;
  voteWeightBps: number;
  voterCount: number;
}

export interface AdminVoteStatsDto {
  pool: string | null;
  voteWeightBps: number;
  uniqueVoterCount: number;
  currentEpoch: number;
  pairStats: PairVoteStatDto[];
}

export interface AdminVoteEventDto {
  id: string;
  tokenId: string;
  pool: string;
  owner: string;
  eventType: string;
  weight: string;
  totalWeight: string;
  epochTimestamp: string | null;
  transactionHash: string;
  blockTimestamp: string;
}

export interface AdminVoteEventsDto {
  events: AdminVoteEventDto[];
  total: number;
}

export interface VoteDistributionBucketDto {
  pool: string;
  label: string;
  totalWeight: string;
  weightBps: number;
}

export interface AdminVoteDistributionDto {
  epoch: number;
  buckets: VoteDistributionBucketDto[];
}

export interface EpochVoteBucketDto {
  epochNumber: number;
  epochTimestamp: string;
  totalWeight: string;
}

export interface AdminVoteByEpochDto {
  epochs: EpochVoteBucketDto[];
}
