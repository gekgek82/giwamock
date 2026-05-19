import { useQuery } from "@tanstack/react-query";

import { useVoteDataSource } from "@/lib/datasources/context";

export interface GaugeInfo {
  gaugeAddress: `0x${string}` | null;
  hasGauge: boolean;
  isAlive: boolean;
}

/**
 * Hook to get the Gauge contract address for a pool.
 * Pre-TGE `hasGauge: false` is the normal state for most pools.
 */
export function useGauge(
  poolAddress?: `0x${string}`,
): GaugeInfo & { isLoading: boolean } {
  const vote = useVoteDataSource();

  const { data, isLoading } = useQuery({
    queryKey: ["vote", "gauge", poolAddress],
    queryFn: () => vote!.getGauge(poolAddress!),
    enabled: !!vote && !!poolAddress,
  });

  return {
    gaugeAddress: data?.gaugeAddress ?? null,
    hasGauge: !!data?.hasGauge,
    isAlive: !!data?.isAlive,
    isLoading,
  };
}

export interface GaugeData {
  rewardRate: bigint;
  totalSupply: bigint;
  periodFinish: bigint;
  rewardToken: `0x${string}`;
  isActive: boolean;
}

/**
 * Hook to get detailed Gauge contract data.
 */
export function useGaugeData(
  gaugeAddress?: `0x${string}` | null,
): GaugeData & { isLoading: boolean } {
  const vote = useVoteDataSource();

  const { data, isLoading } = useQuery({
    queryKey: ["vote", "gauge-data", gaugeAddress],
    queryFn: () => vote!.getGaugeData(gaugeAddress!),
    enabled: !!vote && !!gaugeAddress,
  });

  const now = BigInt(Math.floor(Date.now() / 1000));
  const periodFinish = data?.periodFinish ?? 0n;

  return {
    rewardRate: data?.rewardRate ?? 0n,
    totalSupply: data?.totalSupply ?? 0n,
    periodFinish,
    rewardToken:
      data?.rewardToken ??
      ("0x0000000000000000000000000000000000000000" as `0x${string}`),
    isActive: periodFinish > 0n && now < periodFinish,
    isLoading,
  };
}

/**
 * Hook to get pool voting weight from Voter contract.
 */
export function usePoolWeight(poolAddress?: `0x${string}`) {
  const vote = useVoteDataSource();

  const { data, isLoading } = useQuery({
    queryKey: ["vote", "pool-weight", poolAddress],
    queryFn: () => vote!.getPoolWeight(poolAddress!),
    enabled: !!vote && !!poolAddress,
  });

  const weight = data?.weight ?? 0n;
  const totalWeight = data?.totalWeight ?? 0n;
  const voteShare =
    totalWeight > 0n ? Number((weight * 10000n) / totalWeight) / 100 : 0;

  return {
    weight,
    totalWeight,
    voteShare,
    voteShareFormatted: `${voteShare.toFixed(2)}%`,
    isLoading,
  };
}
