'use client';

import { useQuery } from '@tanstack/react-query';
import { indexerApi } from '@/lib/indexerApi';
import type { LiquidityDistributionResponse } from '@/types/indexer';

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function useLiquidityDistribution(poolAddress: string | null) {
  return useQuery<LiquidityDistributionResponse, Error>({
    queryKey: ['liquidity-distribution', poolAddress],
    queryFn: () => indexerApi.getLiquidityDistribution(poolAddress!),
    enabled: !!poolAddress && poolAddress.toLowerCase() !== ZERO_ADDRESS,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
