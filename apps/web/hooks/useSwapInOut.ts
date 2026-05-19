import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { parseUnits, formatUnits } from "viem";

import { useSwapDataSource } from "@/lib/datasources/context";
import {
  usePoolFactoryAddress,
  useRouterAddress,
} from "@/hooks/useContractAddresses";
import { computePriceImpact } from "@/lib/swap/math";
import { useSwapPath, type Route } from "./useSwapPath";
import type { SwapPoolSnapshot } from "@/lib/datasources/swap";

/**
 * Swap input/output estimation hook.
 *
 * - `amountInUi` is a human string for the *sell* token.
 * - Return `data` is a human string for the *buy* token (amountOut).
 *
 * Naming note: this is NOT related to broker pair base/quote orientation.
 */
export function useSwapInOut(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  amountInUi: string,
  tokenInDecimals = 18,
  tokenOutDecimals = 18,
) {
  const swap = useSwapDataSource();
  const routerAddress = useRouterAddress();
  const poolFactoryAddress = usePoolFactoryAddress();

  const amountInParsed =
    amountInUi && parseFloat(amountInUi) > 0
      ? parseUnits(amountInUi, tokenInDecimals)
      : 0n;

  const { candidatePaths, isLoading: isPathLoading, pools } = useSwapPath(
    tokenIn,
    tokenOut,
  );

  // Factory default fees (used by MIXED-path BASIC hops)
  const { data: defaultFees } = useQuery({
    queryKey: ["swap", "factory-default-fees", poolFactoryAddress],
    queryFn: () => swap!.getFactoryDefaultFees(),
    enabled: !!swap,
  });
  const stableFeeBps = defaultFees?.stableFeeBps ?? 5;
  const volatileFeeBps = defaultFees?.volatileFeeBps ?? 30;

  const enabled = !!(
    swap &&
    routerAddress &&
    candidatePaths &&
    candidatePaths.length > 0 &&
    amountInParsed > 0n
  );

  const { data: best, isLoading: isEvalLoading, isError: isEvalError } =
    useQuery({
      queryKey: [
        "swap",
        "evaluate",
        tokenIn,
        tokenOut,
        amountInParsed.toString(),
        candidatePaths?.map((p) => p.map((r) => r.poolAddress).join("-")).join("|"),
        stableFeeBps,
        volatileFeeBps,
      ],
      queryFn: () =>
        swap!.evaluateSwapPaths({
          candidatePaths: (candidatePaths ?? []) as Route[][],
          pools: (pools ?? []) as unknown as SwapPoolSnapshot[],
          amountIn: amountInParsed,
          stableFeeBps,
          volatileFeeBps,
        }),
      enabled,
      placeholderData: keepPreviousData,
    });

  const isLoading = isPathLoading || isEvalLoading;

  const formattedAmount =
    best && best.output > 0n ? formatUnits(best.output, tokenOutDecimals) : "0";

  const priceImpact = useMemo(() => {
    if (!best) return 0;
    const quoteInput = best.isCL ? amountInParsed : best.quoteInput;
    return computePriceImpact(best.output, best.spotOutput, quoteInput);
  }, [best, amountInParsed]);

  const isError = !!(
    isEvalError &&
    amountInParsed > 0n &&
    !isLoading &&
    (!best || best.output === 0n)
  );

  /**
   * Output-token reserve across candidate direct pools (from the indexer),
   * with a fall-back to CL virtual reserve when the pool has zero indexer
   * reserves.
   */
  const maxOutputReserve = useMemo(() => {
    const tokenOutLower = tokenOut.toLowerCase();
    let maxReserve = 0;
    let reserveSymbol = "";
    let outDecimals = 18;

    if (candidatePaths && candidatePaths.length > 0 && pools.length > 0) {
      for (const path of candidatePaths) {
        if (path.length !== 1) continue;
        const route = path[0];
        const pool = pools.find(
          (p) => p.address.toLowerCase() === route.poolAddress?.toLowerCase(),
        );
        if (!pool) continue;

        const isToken0Out = pool.token0.address.toLowerCase() === tokenOutLower;
        const isToken1Out = pool.token1.address.toLowerCase() === tokenOutLower;
        let reserve = 0;
        if (isToken0Out) {
          reserve = parseFloat(
            formatUnits(BigInt(pool.reserve0), pool.token0.decimals),
          );
          if (!reserveSymbol) reserveSymbol = pool.token0.symbol;
          outDecimals = pool.token0.decimals;
        } else if (isToken1Out) {
          reserve = parseFloat(
            formatUnits(BigInt(pool.reserve1), pool.token1.decimals),
          );
          if (!reserveSymbol) reserveSymbol = pool.token1.symbol;
          outDecimals = pool.token1.decimals;
        }

        if (reserve > maxReserve) maxReserve = reserve;
      }
    }

    if (maxReserve === 0 && best?.isCL && best.clMaxOutput > 0n) {
      const clReserve = parseFloat(formatUnits(best.clMaxOutput, outDecimals));
      if (clReserve > 0) return { amount: clReserve, symbol: reserveSymbol };
    }

    if (maxReserve === 0) return null;
    return { amount: maxReserve, symbol: reserveSymbol };
  }, [candidatePaths, pools, tokenOut, best]);

  const insufficientLiquidity = useMemo(() => {
    if (amountInParsed === 0n || isLoading) return false;
    if (candidatePaths && candidatePaths.length > 0 && best?.output === 0n) {
      return true;
    }
    // Per-hop saturation covers single-hop AND multi-hop for BASIC, CL, and
    // MIXED paths. Threshold is 80% of any hop's max output.
    if (best && best.output > 0n && best.saturationBps >= 8000) {
      return true;
    }
    return false;
  }, [amountInParsed, isLoading, candidatePaths, best]);

  return {
    data: formattedAmount,
    isLoading,
    isError,
    raw: best?.output ?? 0n,
    isStable: best?.isStable ?? false,
    hasCLPool: best?.isCL ?? false,
    isMixed: best?.isMixed ?? false,
    priceImpact,
    path: best && best.output > 0n ? best.path : null,
    hopCount: best?.path?.length ?? 1,
    insufficientLiquidity,
    maxOutputReserve,
  };
}

