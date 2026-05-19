import type { Address } from "@/lib/datasources/types";

export interface GaugeInfo {
  gaugeAddress: Address | null;
  hasGauge: boolean;
  isAlive: boolean;
}

export interface GaugeData {
  rewardRate: bigint;
  totalSupply: bigint;
  periodFinish: bigint;
  rewardToken: Address;
}

export interface PoolWeight {
  weight: bigint;
  totalWeight: bigint;
}

/**
 * Read-only interface for Voter / Gauge queries. Pre-TGE, a pool having
 * no gauge is the normal state — implementations should return
 * `hasGauge: false` rather than throwing.
 */
export interface VoteDataSource {
  getGauge(poolAddress: Address): Promise<GaugeInfo>;
  getGaugeData(gaugeAddress: Address): Promise<GaugeData>;
  getPoolWeight(poolAddress: Address): Promise<PoolWeight>;
}
