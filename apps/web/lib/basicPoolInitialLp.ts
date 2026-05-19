import { formatUnits } from "viem";

/** Integer square root for non-negative bigint (Newton). */
export function bigintSqrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError("bigintSqrt: negative");
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (n / x + x) / 2n;
  }
  return x;
}

/**
 * Uniswap V2–style first-mint LP estimate: `sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY`.
 * Matches common Solidly forks for **volatile** pools; not valid for stable curves.
 * Returns human string (18-decimal LP units) or `null` if not applicable.
 */
export function estimateVolatileInitialLpHuman(
  amount0Wei: bigint,
  amount1Wei: bigint,
  minimumLiquidity: bigint = 1000n,
): string | null {
  if (amount0Wei <= 0n || amount1Wei <= 0n) return null;
  try {
    const prod = amount0Wei * amount1Wei;
    const root = bigintSqrt(prod);
    const liq = root > minimumLiquidity ? root - minimumLiquidity : 0n;
    if (liq <= 0n) return null;
    return formatUnits(liq, 18);
  } catch {
    return null;
  }
}
