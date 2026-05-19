import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";

import { useSwapDataSource } from "@/lib/datasources/context";

interface QuoteRemoveLiquidityResult {
  amountA: string;
  amountB: string;
  isLoading: boolean;
  isError: boolean;
}

export function useQuoteRemoveLiquidity(
  tokenA: `0x${string}` | undefined,
  tokenB: `0x${string}` | undefined,
  stable: boolean,
  liquidity: bigint | undefined,
  tokenADecimals: number = 18,
  tokenBDecimals: number = 18,
): QuoteRemoveLiquidityResult {
  const swap = useSwapDataSource();

  const enabled = !!(
    swap &&
    tokenA &&
    tokenB &&
    liquidity &&
    liquidity > 0n
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "swap",
      "quote-remove-liquidity",
      tokenA,
      tokenB,
      stable,
      liquidity?.toString(),
    ],
    queryFn: () =>
      swap!.getRemoveLiquidityQuote({
        tokenA: tokenA!,
        tokenB: tokenB!,
        stable,
        liquidity: liquidity!,
      }),
    enabled,
  });

  if (!data || isError || isLoading) {
    return {
      amountA: "0",
      amountB: "0",
      isLoading,
      isError,
    };
  }

  return {
    amountA: formatUnits(data.amountA, tokenADecimals),
    amountB: formatUnits(data.amountB, tokenBDecimals),
    isLoading: false,
    isError: false,
  };
}
