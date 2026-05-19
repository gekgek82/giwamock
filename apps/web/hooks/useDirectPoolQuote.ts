import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { parseUnits, formatUnits } from "viem";

import { useSwapDataSource } from "@/lib/datasources/context";
import { usePoolFactoryAddress } from "@/hooks/useContractAddresses";
import { computePriceImpact } from "@/lib/swap/math";

/** Route for a single-hop direct pool swap. */
interface Route {
  from: `0x${string}`;
  to: `0x${string}`;
  stable: boolean;
  factory: `0x${string}`;
  poolType?: string;
  tickSpacing?: number;
}

/**
 * Get a swap quote for a single explicit route — used by the admin
 * test-swap page to target a specific pool. Delegates to the swap data
 * source; all math lives in `lib/swap/math.ts`.
 */
export function useDirectPoolQuote(
  route: Route | null,
  amountIn: string,
  decimals: number = 18,
  poolAddress?: `0x${string}`,
) {
  const swap = useSwapDataSource();
  const poolFactoryAddress = usePoolFactoryAddress();

  const amountInParsed =
    amountIn && parseFloat(amountIn) > 0
      ? parseUnits(amountIn, decimals)
      : 0n;
  const factoryAddr =
    poolFactoryAddress ??
    ("0x0000000000000000000000000000000000000000" as `0x${string}`);

  const enabled = !!(swap && route && amountInParsed > 0n);

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "swap",
      "direct-quote",
      route?.from,
      route?.to,
      route?.stable,
      route?.poolType,
      poolAddress,
      amountInParsed.toString(),
    ],
    queryFn: () =>
      swap!.getDirectQuote({
        route: { ...route!, factory: factoryAddr },
        amountIn: amountInParsed,
        poolAddress,
      }),
    enabled,
    placeholderData: keepPreviousData,
  });

  const formattedAmount = useMemo(
    () => (data && data.output > 0n ? formatUnits(data.output, decimals) : "0"),
    [data, decimals],
  );

  const priceImpact = useMemo(
    () =>
      data
        ? computePriceImpact(data.output, data.spotOutput, data.quoteInput)
        : 0,
    [data],
  );

  return {
    data: formattedAmount,
    raw: data?.output ?? 0n,
    isLoading,
    isError: !!(isError && amountInParsed > 0n && !isLoading),
    priceImpact,
    route: route ? [{ ...route, factory: factoryAddr }] : null,
  };
}
