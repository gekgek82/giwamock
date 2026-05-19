/**
 * Fixed chart resolution for CL liquidity depth (ticks per bar).
 * Independent of pool `tickSpacing`; only affects histogram rows.
 */
export const CL_HISTOGRAM_TICK_WIDTH = 64;

/**
 * Histogram buckets of width `width` that intersect `[tickLower, tickUpper)` (Uniswap-style half-open range).
 */
export function clHistogramBucketsForRange(
  tickLower: number,
  tickUpperExclusive: number,
  width: number,
): Array<{ bucketStartTick: number; bucketEndTick: number }> {
  const lo = Math.min(tickLower, tickUpperExclusive);
  const hi = Math.max(tickLower, tickUpperExclusive);
  const out: Array<{ bucketStartTick: number; bucketEndTick: number }> = [];
  if (!(hi > lo) || width <= 0) return out;

  let start = Math.floor(lo / width) * width;
  while (start < hi) {
    const end = start + width - 1;
    if (end >= lo && start < hi) {
      out.push({ bucketStartTick: start, bucketEndTick: end });
    }
    start += width;
  }
  return out;
}

/** Rough sqrt-price proxy for chart axes (not exact sqrt×96). */
export function tickToDisplayPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}
