/**
 * Pure math helpers for swap quote calculation.
 *
 * These functions intentionally have no React, wagmi, or viem dependencies
 * so they can be unit-tested directly and reused from both the on-chain
 * `WagmiSwapDataSource` today and any future gateway client that needs to
 * validate / predict quote output.
 */

import { parseUnits } from "viem";

export const Q96 = 2n ** 96n;

/** 0.000001 token @ 18 decimals — baseline for spot-price estimation. */
export const SPOT_REF_AMOUNT = parseUnits("0.000001", 18);

export type PathType = "BASIC" | "CL" | "MIXED";

export interface RouteLike {
  poolType?: string;
}

/**
 * Classify a multi-hop path as BASIC, CL, or MIXED based on hop pool types.
 */
export function classifyPath(path: RouteLike[]): PathType {
  const hasCL = path.some((r) => r.poolType === "CL");
  const hasBasic = path.some((r) => r.poolType !== "CL");
  if (hasCL && hasBasic) return "MIXED";
  return hasCL ? "CL" : "BASIC";
}

/**
 * Max output available from a CL pool within the current tick range, i.e.
 * the virtual reserve of the output token.
 *   zeroForOne → max token1 out = L * sqrtP / 2^96
 *   oneForZero → max token0 out = L * 2^96 / sqrtP
 */
export function computeCLMaxOutput(
  sqrtPriceX96: bigint,
  liquidity: bigint,
  zeroForOne: boolean,
): bigint {
  if (sqrtPriceX96 === 0n || liquidity === 0n) return 0n;
  if (zeroForOne) {
    return (liquidity * sqrtPriceX96) / Q96;
  }
  return (liquidity * Q96) / sqrtPriceX96;
}

/**
 * Expected CL swap output using the constant-product AMM curve.
 * Accurate within a single tick range; large swaps crossing ticks will be
 * approximate (actual on-chain output slightly lower).
 *
 * @param feePips Fee in hundredths of a bip (e.g. 3000 = 0.30%)
 */
export function computeCLQuote(
  sqrtPriceX96: bigint,
  liquidity: bigint,
  feePips: bigint,
  amountIn: bigint,
  zeroForOne: boolean,
): bigint {
  if (sqrtPriceX96 === 0n || liquidity === 0n || amountIn === 0n) return 0n;

  const amountInAfterFee = (amountIn * (1_000_000n - feePips)) / 1_000_000n;

  if (zeroForOne) {
    const x = (liquidity * Q96) / sqrtPriceX96;
    const xPrime = x + amountInAfterFee;
    if (xPrime === 0n) return 0n;
    const newSqrtPriceX96 = (liquidity * Q96) / xPrime;
    if (newSqrtPriceX96 >= sqrtPriceX96) return 0n;
    return (liquidity * (sqrtPriceX96 - newSqrtPriceX96)) / Q96;
  }

  const newSqrtPriceX96 =
    sqrtPriceX96 + (amountInAfterFee * Q96) / liquidity;
  if (newSqrtPriceX96 === 0n) return 0n;
  const outOld = (liquidity * Q96) / sqrtPriceX96;
  const outNew = (liquidity * Q96) / newSqrtPriceX96;
  return outOld > outNew ? outOld - outNew : 0n;
}

/**
 * Expected BASIC-pool swap output using the constant-product formula.
 * @param feeBps Fee in basis points (e.g. 30 = 0.30%)
 */
export function computeBasicQuote(
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: number,
  amountIn: bigint,
): bigint {
  if (reserveIn === 0n || reserveOut === 0n || amountIn === 0n) return 0n;
  const amountInAfterFee = (amountIn * BigInt(10_000 - feeBps)) / 10_000n;
  return (amountInAfterFee * reserveOut) / (reserveIn + amountInAfterFee);
}

/**
 * Price impact in percent, expressed as a non-negative number. Uses the
 * ratio between the execution rate and the spot rate as the reference.
 */
export function computePriceImpact(
  output: bigint,
  spotOutput: bigint,
  quoteInput: bigint,
): number {
  if (output === 0n || spotOutput === 0n || quoteInput === 0n) return 0;

  const execNumerator = output * SPOT_REF_AMOUNT;
  const execDenominator = quoteInput * spotOutput;
  if (execDenominator === 0n) return 0;

  const ratio =
    Number((execNumerator * BigInt(1e18)) / execDenominator) / 1e18;
  return Math.max(0, (1 - ratio) * 100);
}
