/**
 * Tick math utilities for Concentrated Liquidity pools.
 *
 * Based on Uniswap V3 tick math:
 *   price = 1.0001^tick
 *   tick  = floor(log(price) / log(1.0001))
 */

export const MIN_TICK = -887272;
export const MAX_TICK = 887272;

/** Practical tick bounds — matches CLFactory.MAX_INITIAL_TICK / MIN_INITIAL_TICK */
export const MIN_INITIAL_TICK = -500000;
export const MAX_INITIAL_TICK = 500000;

/**
 * A pool with current tick beyond this absolute threshold is considered
 * "imbalanced" — one token side has been depleted and the price has drifted
 * to a tick with no active liquidity. Matches MAX_INITIAL_TICK so anything
 * outside the normal initialization range qualifies.
 */
export const IMBALANCED_TICK_THRESHOLD = MAX_INITIAL_TICK;

/** Returns true if the tick is at the extreme end of the pool's price space. */
export function isTickImbalanced(tick: number | null | undefined): boolean {
  if (tick === null || tick === undefined) return false;
  return Math.abs(tick) >= IMBALANCED_TICK_THRESHOLD;
}

const LOG_BASE = Math.log(1.0001);

/**
 * Convert a tick to a human-readable price.
 * Adjusts for token decimal differences.
 *
 * price(token1/token0) = 1.0001^tick * 10^(decimals0 - decimals1)
 */
export function tickToPrice(
  tick: number,
  decimals0: number,
  decimals1: number
): number {
  const rawPrice = Math.pow(1.0001, tick);
  const decimalAdjustment = Math.pow(10, decimals0 - decimals1);
  return rawPrice * decimalAdjustment;
}

/**
 * Convert a human-readable price to the nearest tick.
 * Adjusts for token decimal differences.
 */
export function priceToTick(
  price: number,
  decimals0: number,
  decimals1: number
): number {
  if (price <= 0) return MIN_TICK;
  const decimalAdjustment = Math.pow(10, decimals0 - decimals1);
  const rawPrice = price / decimalAdjustment;
  return Math.floor(Math.log(rawPrice) / LOG_BASE);
}

/**
 * Convert a human-readable price to sqrtPriceX96 (Q64.96 fixed-point).
 * Derives the tick first, then uses the exact integer-math conversion
 * so the result matches the on-chain TickMath computation.
 */
export function priceToSqrtPriceX96(
  price: number,
  decimals0: number,
  decimals1: number
): bigint {
  if (price <= 0) return 0n;
  const tick = priceToTick(price, decimals0, decimals1);
  // Reject ticks outside practical bounds to prevent extreme pool prices
  if (tick < MIN_INITIAL_TICK || tick > MAX_INITIAL_TICK) return 0n;
  return tickToSqrtPriceX96(tick);
}

/**
 * Round a tick DOWN to the nearest valid tick for the given tick spacing.
 */
export function nearestUsableTick(tick: number, tickSpacing: number): number {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing;
  return Math.max(MIN_TICK, Math.min(MAX_TICK, rounded));
}

/**
 * Get the minimum usable tick for a given tick spacing.
 */
export function minUsableTick(tickSpacing: number): number {
  return Math.ceil(MIN_TICK / tickSpacing) * tickSpacing;
}

/**
 * Get the maximum usable tick for a given tick spacing.
 */
export function maxUsableTick(tickSpacing: number): number {
  return Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
}

/**
 * Convert a tick directly to sqrtPriceX96 (Q64.96 fixed-point).
 *
 * Pure integer-math port of Uniswap V3 TickMath.getSqrtRatioAtTick.
 * Uses pre-computed Q128.128 magic constants — no floating-point
 * rounding, so the result matches the on-chain computation exactly.
 */
export function tickToSqrtPriceX96(tick: number): bigint {
  const absTick = BigInt(tick < 0 ? -tick : tick);
  if (absTick > 887272n) return 0n;

  let ratio: bigint =
    (absTick & 0x1n) !== 0n
      ? 0xfffcb933bd6fad37aa2d162d1a594001n
      : 0x100000000000000000000000000000000n;
  if ((absTick & 0x2n) !== 0n)
    ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if ((absTick & 0x4n) !== 0n)
    ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if ((absTick & 0x8n) !== 0n)
    ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if ((absTick & 0x10n) !== 0n)
    ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if ((absTick & 0x20n) !== 0n)
    ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if ((absTick & 0x40n) !== 0n)
    ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if ((absTick & 0x80n) !== 0n)
    ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if ((absTick & 0x100n) !== 0n)
    ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if ((absTick & 0x200n) !== 0n)
    ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if ((absTick & 0x400n) !== 0n)
    ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if ((absTick & 0x800n) !== 0n)
    ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if ((absTick & 0x1000n) !== 0n)
    ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if ((absTick & 0x2000n) !== 0n)
    ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if ((absTick & 0x4000n) !== 0n)
    ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if ((absTick & 0x8000n) !== 0n)
    ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if ((absTick & 0x10000n) !== 0n)
    ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if ((absTick & 0x20000n) !== 0n)
    ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if ((absTick & 0x40000n) !== 0n)
    ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if ((absTick & 0x80000n) !== 0n)
    ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;

  if (tick > 0) {
    const MAX_UINT256 =
      0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
    ratio = MAX_UINT256 / ratio;
  }

  // Convert from Q128.128 → Q128.96, rounding up
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

/**
 * Compute the capital allocation ratio for a CL position at the current tick,
 * derived purely from the tick range (no USD prices, no user amounts).
 *
 * This is the single source of truth for both the "In Range" badge and the
 * "Deposit Ratio" display — if both read from this they will never disagree.
 *
 * Below the range → 100% token0; above the range → 100% token1; in range →
 * Uniswap V3 sqrt-price math (Number arithmetic, adequate for UI percentages).
 */
export function computeRangeRatio(
  currentTick: number | null | undefined,
  tickLower: number,
  tickUpper: number,
  decimals0: number,
  decimals1: number
): { ratio0: number; ratio1: number } {
  if (currentTick === null || currentTick === undefined || tickUpper <= tickLower) {
    return { ratio0: 0.5, ratio1: 0.5 };
  }
  if (currentTick <= tickLower) return { ratio0: 1, ratio1: 0 };
  if (currentTick >= tickUpper) return { ratio0: 0, ratio1: 1 };

  const sqrtP = Math.pow(1.0001, currentTick / 2);
  const sqrtA = Math.pow(1.0001, tickLower / 2);
  const sqrtB = Math.pow(1.0001, tickUpper / 2);

  const amount0 = (sqrtB - sqrtP) / (sqrtP * sqrtB);
  const amount1 = sqrtP - sqrtA;

  const decimalAdjust = Math.pow(10, decimals0 - decimals1);
  const value0 = amount0 * sqrtP * sqrtP * decimalAdjust;
  const value1 = amount1;

  const total = value0 + value1;
  if (!Number.isFinite(total) || total <= 0) {
    return { ratio0: 0.5, ratio1: 0.5 };
  }

  const r0 = Math.max(0, Math.min(1, value0 / total));
  return { ratio0: r0, ratio1: 1 - r0 };
}

/**
 * Format a price for display with appropriate precision.
 *
 * Extreme values (|price| >= 1e15 or very small positives below 1e-15) fall
 * back to scientific notation so the UI doesn't render a 30+ digit string
 * — which happens when a pool drifts to the tick space boundary after one
 * side is depleted.
 */
export function formatPrice(price: number): string {
  if (price === 0) return "0";
  if (!Number.isFinite(price)) return "∞";
  if (price < 0) return "-" + formatPrice(-price);

  if (price >= 1e15) return price.toExponential(2);
  if (price < 1e-15) return "0";
  if (price < 1e-5) return price.toExponential(4);
  if (price < 1e-3) return price.toFixed(8);
  if (price < 1) return price.toFixed(6);
  if (price < 10) return price.toFixed(4);
  if (price < 10000) return price.toFixed(2);
  return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
