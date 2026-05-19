import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";

import { usePoolDataSource } from "@/lib/datasources/context";
import { getMockPoolReserves } from "@/lib/mocks";

const ZERO_POOL = "0x0000000000000000000000000000000000000000";

export function usePoolReserves(poolAddress?: `0x${string}`) {
  const pool = usePoolDataSource();

  const enabled =
    !!pool &&
    !!poolAddress &&
    poolAddress.toLowerCase() !== ZERO_POOL;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pool", "reserves", poolAddress],
    queryFn: () => pool!.getReserves(poolAddress!),
    enabled,
  });

  // Design-preview: serve canned reserves for mock pool addresses so the
  // paired-amount auto-fill in the deposit form has something to compute
  // against (otherwise the form thinks every mock pool is uninitialized).
  const mockReserves = getMockPoolReserves(poolAddress);
  if (mockReserves) {
    return {
      reserve0: formatUnits(mockReserves.reserve0, 18),
      reserve1: formatUnits(mockReserves.reserve1, 18),
      reserve0Raw: mockReserves.reserve0,
      reserve1Raw: mockReserves.reserve1,
      isLoading: false,
      refetch,
    };
  }

  return {
    reserve0: data ? formatUnits(data.reserve0, 18) : "0",
    reserve1: data ? formatUnits(data.reserve1, 18) : "0",
    reserve0Raw: data?.reserve0,
    reserve1Raw: data?.reserve1,
    isLoading,
    refetch,
  };
}
