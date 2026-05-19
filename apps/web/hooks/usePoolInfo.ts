import { useQuery } from "@tanstack/react-query";

import { usePoolDataSource } from "@/lib/datasources/context";

export interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
}

export interface PoolInfoData {
  token0: TokenInfo | null;
  token1: TokenInfo | null;
  isLoading: boolean;
}

export function usePoolInfo(
  poolAddress: `0x${string}` | undefined,
): PoolInfoData {
  const pool = usePoolDataSource();

  const { data, isLoading } = useQuery({
    queryKey: ["pool", "info", poolAddress],
    queryFn: () => pool!.getInfo(poolAddress!),
    enabled: !!pool && !!poolAddress,
  });

  return {
    token0: data?.token0 ?? null,
    token1: data?.token1 ?? null,
    isLoading,
  };
}
