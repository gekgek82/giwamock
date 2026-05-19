/**
 * TypeScript port of LiquidityAmounts.sol (Solidity BigInt math).
 *
 * Given one token amount + current price + tick range, computes the
 * matching amount of the other token so both are consumed proportionally.
 */

import { formatUnits, parseUnits } from "viem";
import { tickToSqrtPriceX96 } from "./tickMath";

const Q96 = 2n ** 96n;

// ── internal helpers (match Solidity LiquidityAmounts) ──────────────

function mulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
  return (a * b) / denominator;
}

function getLiquidityForAmount0(
  sqrtA: bigint,
  sqrtB: bigint,
  amount0: bigint
): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  const intermediate = mulDiv(sqrtA, sqrtB, Q96);
  return mulDiv(amount0, intermediate, sqrtB - sqrtA);
}

function getLiquidityForAmount1(
  sqrtA: bigint,
  sqrtB: bigint,
  amount1: bigint
): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return mulDiv(amount1, Q96, sqrtB - sqrtA);
}

function getAmount0ForLiquidity(
  sqrtA: bigint,
  sqrtB: bigint,
  liquidity: bigint
): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return mulDiv(liquidity << 96n, sqrtB - sqrtA, sqrtB) / sqrtA;
}

function getAmount1ForLiquidity(
  sqrtA: bigint,
  sqrtB: bigint,
  liquidity: bigint
): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return mulDiv(liquidity, sqrtB - sqrtA, Q96);
}

// ── public API ──────────────────────────────────────────────────────

/**
 * Given a token0 amount, calculate the paired token1 amount.
 * Returns the raw BigInt in token1's smallest unit (wei).
 */
export function getAmount1FromAmount0(
  sqrtPriceX96: bigint,
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  amount0: bigint
): bigint {
  if (sqrtPriceAX96 > sqrtPriceBX96)
    [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];

  if (sqrtPriceX96 <= sqrtPriceAX96) {
    // Below range → only token0 needed
    return 0n;
  }
  if (sqrtPriceX96 >= sqrtPriceBX96) {
    // Above range → only token1 needed, can't derive from amount0
    return 0n;
  }
  // In range
  const liquidity = getLiquidityForAmount0(sqrtPriceX96, sqrtPriceBX96, amount0);
  return getAmount1ForLiquidity(sqrtPriceAX96, sqrtPriceX96, liquidity);
}

/**
 * Given a token1 amount, calculate the paired token0 amount.
 * Returns the raw BigInt in token0's smallest unit (wei).
 */
export function getAmount0FromAmount1(
  sqrtPriceX96: bigint,
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  amount1: bigint
): bigint {
  if (sqrtPriceAX96 > sqrtPriceBX96)
    [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];

  if (sqrtPriceX96 <= sqrtPriceAX96) {
    // Below range → only token0 needed, can't derive from amount1
    return 0n;
  }
  if (sqrtPriceX96 >= sqrtPriceBX96) {
    // Above range → only token1 needed
    return 0n;
  }
  // In range
  const liquidity = getLiquidityForAmount1(sqrtPriceAX96, sqrtPriceX96, amount1);
  return getAmount0ForLiquidity(sqrtPriceX96, sqrtPriceBX96, liquidity);
}

// ── formatting helper ───────────────────────────────────────────────

/** Remove trailing zeros from a decimal string (e.g. "1.200" → "1.2") */
function trimTrailingZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Round a decimal string to at most `maxDecimals` decimal places.
 * Uses standard rounding (half-up) to avoid sub-wei display noise
 * (e.g. "99.999999999999999999" with maxDecimals=8 → "100").
 */
function roundDecimalStr(s: string, maxDecimals: number): string {
  if (!s.includes(".")) return s;
  const [intPart, fracPart] = s.split(".");
  if (fracPart.length <= maxDecimals) return s;

  // Check digit after the cut for rounding
  const kept = fracPart.slice(0, maxDecimals);
  const nextDigit = parseInt(fracPart[maxDecimals], 10);

  if (nextDigit < 5) {
    const result = maxDecimals === 0 ? intPart : `${intPart}.${kept}`;
    return trimTrailingZeros(result);
  }

  // Round up: add 1 to the kept portion using BigInt arithmetic
  const scale = 10n ** BigInt(maxDecimals);
  const combined = BigInt(intPart) * scale + BigInt(kept || "0") + 1n;
  const newInt = (combined / scale).toString();
  if (maxDecimals === 0) return newInt;
  const newFrac = (combined % scale).toString().padStart(maxDecimals, "0");
  return trimTrailingZeros(`${newInt}.${newFrac}`);
}

/**
 * High-level helper: compute the paired token amount as a display string.
 *
 * @param editedToken  Which token the user edited ('token0' | 'token1')
 * @param inputAmount  The raw string the user typed (e.g. "12.5")
 * @param sqrtPriceX96 Current pool sqrtPriceX96
 * @param tickLower    Lower tick of the range
 * @param tickUpper    Upper tick of the range
 * @param decimals0    Token0 decimals
 * @param decimals1    Token1 decimals
 * @returns The paired token amount as a display string, or '' if not applicable
 */
export function calcPairedAmount(
  editedToken: "token0" | "token1",
  inputAmount: string,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  decimals0: number,
  decimals1: number
): string {
  if (!inputAmount || parseFloat(inputAmount) === 0) return "";
  if (tickLower >= tickUpper) return "";
  if (!sqrtPriceX96 || sqrtPriceX96 === 0n) return "";

  const sqrtA = tickToSqrtPriceX96(tickLower);
  const sqrtB = tickToSqrtPriceX96(tickUpper);
  if (sqrtA === 0n || sqrtB === 0n) return "";

  // Cap display to 8 decimal places to avoid sub-wei noise
  const MAX_DISPLAY_DECIMALS = 8;

  try {
    if (editedToken === "token0") {
      const wei0 = parseUnits(inputAmount, decimals0);
      const wei1 = getAmount1FromAmount0(sqrtPriceX96, sqrtA, sqrtB, wei0);
      if (wei1 === 0n) return "";
      const raw = trimTrailingZeros(formatUnits(wei1, decimals1));
      return roundDecimalStr(raw, MAX_DISPLAY_DECIMALS);
    } else {
      const wei1 = parseUnits(inputAmount, decimals1);
      const wei0 = getAmount0FromAmount1(sqrtPriceX96, sqrtA, sqrtB, wei1);
      if (wei0 === 0n) return "";
      const raw = trimTrailingZeros(formatUnits(wei0, decimals0));
      return roundDecimalStr(raw, MAX_DISPLAY_DECIMALS);
    }
  } catch {
    return "";
  }
}

/**
 * Parse indexer / API reserve fields (wei integer string, optional fractional noise)
 * for BigInt ratio math on the deposit page.
 */
export function parseReserveWeiString(
  s: string | undefined | null,
): bigint | undefined {
  if (s === undefined || s === null) return undefined;
  const t = s.trim();
  if (!t) return undefined;
  const base = t.includes(".") ? t.split(".")[0]! : t;
  if (!/^-?\d+$/.test(base)) return undefined;
  try {
    return BigInt(base);
  } catch {
    return undefined;
  }
}
