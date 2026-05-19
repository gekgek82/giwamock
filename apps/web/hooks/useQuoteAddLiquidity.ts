import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";

import { useSwapDataSource } from "@/lib/datasources/context";

interface QuoteAddLiquidityResult {
  amountA: string;
  amountB: string;
  liquidity: string;
  isLoading: boolean;
  isError: boolean;
}

export function useQuoteAddLiquidity(
  tokenA: `0x${string}` | undefined,
  tokenB: `0x${string}` | undefined,
  stable: boolean,
  amountADesired: bigint | undefined,
  amountBDesired: bigint | undefined,
): QuoteAddLiquidityResult {
  const swap = useSwapDataSource();

  const aDesired = amountADesired ?? 0n;
  const bDesired = amountBDesired ?? 0n;

  const enabled = !!(
    swap &&
    tokenA &&
    tokenB &&
    aDesired > 0n &&
    bDesired > 0n
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "swap",
      "quote-add-liquidity",
      tokenA,
      tokenB,
      stable,
      aDesired.toString(),
      bDesired.toString(),
    ],
    queryFn: () =>
      swap!.getAddLiquidityQuote({
        tokenA: tokenA!,
        tokenB: tokenB!,
        stable,
        amountADesired: aDesired,
        amountBDesired: bDesired,
      }),
    enabled,
  });

  if (!data || isError || isLoading) {
    return {
      amountA: "0",
      amountB: "0",
      liquidity: "0",
      isLoading,
      isError,
    };
  }

  return {
    amountA: formatUnits(data.amountA, 18),
    amountB: formatUnits(data.amountB, 18),
    liquidity: formatUnits(data.liquidity, 18),
    isLoading: false,
    isError: false,
  };
}
