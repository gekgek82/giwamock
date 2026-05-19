/**
 * Hook to read slot0 (current price, tick) + active liquidity from a CL pool.
 * Delegates to the pool data source so a gateway implementation can replace
 * direct RPC access later without changing callers.
 */

import { useQuery } from "@tanstack/react-query";

import { usePoolDataSource } from "@/lib/datasources/context";

interface Slot0Data {
  sqrtPriceX96: bigint;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  unlocked: boolean;
}

export function useCLPoolSlot0(poolAddress: `0x${string}` | null | undefined) {
  const pool = usePoolDataSource();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["pool", "cl-slot0", poolAddress],
    queryFn: () => pool!.getCLSlot0(poolAddress!),
    enabled: !!pool && !!poolAddress,
  });

  const slot0: Slot0Data | null = data
    ? {
        sqrtPriceX96: data.sqrtPriceX96,
        tick: data.tick,
        observationIndex: data.observationIndex,
        observationCardinality: data.observationCardinality,
        observationCardinalityNext: data.observationCardinalityNext,
        unlocked: data.unlocked,
      }
    : null;

  return {
    slot0,
    sqrtPriceX96: slot0?.sqrtPriceX96 ?? null,
    tick: slot0?.tick ?? null,
    liquidity: data?.liquidity,
    isLoading,
    error,
    refetch,
  };
}
