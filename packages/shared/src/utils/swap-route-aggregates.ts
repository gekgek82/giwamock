/**
 * Route-level aggregates for multi-hop swap routes (broker swap-route API).
 *
 * **Price impact:** per-hop values from {@link computePriceImpact} are independent
 * percentages for each leg. For the route we compound retention factors:
 * `routeImpact = (1 - Π(1 - pᵢ/100)) × 100` where each `pᵢ` is a hop’s
 * `priceImpactPercent` (non-negative).
 */

/**
 * Compounded route-level price impact in percent (non-negative).
 * Returns `null` if `hopImpactPercents` is empty or any entry is null/invalid.
 */
export function compoundRoutePriceImpactPercent(
  hopImpactPercents: readonly (number | null | undefined)[],
): number | null {
  if (hopImpactPercents.length === 0) return null;
  let product = 1;
  for (const p of hopImpactPercents) {
    if (p === null || p === undefined || !Number.isFinite(p) || p < 0) {
      return null;
    }
    product *= 1 - p / 100;
  }
  if (!Number.isFinite(product) || product < 0) return null;
  const impact = (1 - product) * 100;
  return Number.isFinite(impact) ? impact : null;
}

/**
 * Arithmetic mean of hop fee rates in **basis points**.
 */
export function averageFeeBpsAcrossHops(
  hops: readonly { feeBps: number }[],
): number | null {
  if (hops.length === 0) return null;
  let sum = 0;
  for (const h of hops) {
    if (!Number.isFinite(h.feeBps) || h.feeBps < 0) return null;
    sum += h.feeBps;
  }
  return sum / hops.length;
}
