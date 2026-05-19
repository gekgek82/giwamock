export type PoolCategory = "cl" | "basic" | null;

export type PoolSelection =
  | { category: "cl"; tickSpacing: number }
  | { category: "basic"; isStable: boolean }
  | null;

export interface LaunchPoolRowMetrics {
  tvl: string;
  apr7d: string;
}

export interface ConfigurationRow {
  key: string;
  strategyTop: string;
  strategyBottom: string;
  poolMetrics: LaunchPoolRowMetrics | null;
  poolSelection: NonNullable<PoolSelection>;
}
