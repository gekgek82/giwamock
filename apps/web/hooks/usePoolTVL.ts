import { useMemo } from 'react';
import { usePoolReserves } from './usePoolReserves';
import { useTokenPrices } from './useTokenPrices';

export interface PoolTVLResult {
  tvl: number | null;
  tvlFormatted: string;
  amount0USD: number;
  amount1USD: number;
  isLoading: boolean;
  isMockData: boolean;
}

/**
 * Hook to calculate TVL (Total Value Locked) for a pool
 * @param poolAddress - The pool contract address
 * @param token0Symbol - Symbol of token0
 * @param token1Symbol - Symbol of token1
 * @param token0Decimals - Decimals of token0 (default: 18)
 * @param token1Decimals - Decimals of token1 (default: 18)
 * @returns TVL in USD and formatted string
 */
export function usePoolTVL(
  poolAddress?: `0x${string}`,
  token0Symbol?: string,
  token1Symbol?: string,
  token0Decimals: number = 18,
  token1Decimals: number = 18
): PoolTVLResult {
  const { reserve0, reserve1, isLoading: isLoadingReserves } = usePoolReserves(poolAddress);
  const { prices, isLoading: isLoadingPrices, isMockData } = useTokenPrices([token0Symbol, token1Symbol]);

  const result = useMemo(() => {
    if (!reserve0 || !reserve1 || !token0Symbol || !token1Symbol) {
      return {
        tvl: null,
        tvlFormatted: '-',
        amount0USD: 0,
        amount1USD: 0,
      };
    }

    const price0 = prices[token0Symbol] ?? 0;
    const price1 = prices[token1Symbol] ?? 0;

    const amount0 = parseFloat(reserve0);
    const amount1 = parseFloat(reserve1);

    const amount0USD = amount0 * price0;
    const amount1USD = amount1 * price1;
    const tvl = amount0USD + amount1USD;

    return {
      tvl,
      tvlFormatted: formatUSD(tvl),
      amount0USD,
      amount1USD,
    };
  }, [reserve0, reserve1, token0Symbol, token1Symbol, prices]);

  return {
    ...result,
    isLoading: isLoadingReserves || isLoadingPrices,
    isMockData,
  };
}

/**
 * Format a number as USD currency
 */
function formatUSD(value: number): string {
  if (value === 0) return '$0';
  
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  
  if (value < 0.01) {
    return '<$0.01';
  }
  
  return `$${value.toFixed(2)}`;
}

/**
 * Hook to calculate total TVL across all pools
 * @param pools - Array of pool data with TVL
 * @returns Total TVL in USD
 */
export function useTotalTVL(poolTVLs: (number | null)[]): {
  totalTVL: number;
  totalTVLFormatted: string;
} {
  const totalTVL = useMemo(() => {
    return poolTVLs.reduce((sum: number, tvl) => sum + (tvl ?? 0), 0);
  }, [poolTVLs]);

  return {
    totalTVL,
    totalTVLFormatted: formatUSD(totalTVL),
  };
}
