import { useQuery } from "@tanstack/react-query";

import { usePoolDataSource } from "@/lib/datasources/context";
import type { PoolType } from "@/lib/datasources/pool";

export interface PoolFeeInfo {
  feeBasisPoints: number | null;
  feePercent: number | null;
  feeDisplay: string;
  baseFeeBasisPoints: number | null;
  currentFeeBasisPoints: number | null;
  isDynamicFee: boolean;
}

/**
 * Hook to get the fee rate for a specific pool.
 * CL pools may expose a dynamic fee module; the data source hides that
 * detail and returns the currently active fee.
 */
export function usePoolFee(
  poolAddress?: `0x${string}`,
  isStable: boolean = false,
  poolType: string = "BASIC",
): PoolFeeInfo & { isLoading: boolean } {
  const pool = usePoolDataSource();
  const normalisedType: PoolType = poolType === "CL" ? "CL" : "BASIC";

  const { data, isLoading } = useQuery({
    queryKey: ["pool", "fee", poolAddress, isStable, normalisedType],
    queryFn: () => pool!.getFee(poolAddress!, isStable, normalisedType),
    enabled: !!pool && !!poolAddress,
  });

  if (!data) {
    return {
      feeBasisPoints: null,
      feePercent: null,
      feeDisplay: "-",
      baseFeeBasisPoints: null,
      currentFeeBasisPoints: null,
      isDynamicFee: false,
      isLoading,
    };
  }

  const feePercent = data.feeBasisPoints / 100;
  return {
    feeBasisPoints: data.feeBasisPoints,
    feePercent,
    feeDisplay: `${feePercent.toFixed(2)}%`,
    baseFeeBasisPoints: data.baseFeeBasisPoints,
    currentFeeBasisPoints: data.feeBasisPoints,
    isDynamicFee: data.isDynamicFee,
    isLoading,
  };
}

/**
 * Hook to get default fee rates from the pool factory.
 */
export function useDefaultFees() {
  const pool = usePoolDataSource();

  const { data, isLoading } = useQuery({
    queryKey: ["pool", "default-fees"],
    queryFn: () => pool!.getDefaultFees(),
    enabled: !!pool,
  });

  return {
    stableFee: data ? data.stableFeeBasisPoints : null,
    volatileFee: data ? data.volatileFeeBasisPoints : null,
    stableFeeDisplay: data
      ? `${data.stableFeeBasisPoints / 100}%`
      : "-",
    volatileFeeDisplay: data
      ? `${data.volatileFeeBasisPoints / 100}%`
      : "-",
    isLoading,
  };
}
