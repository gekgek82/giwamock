/**
 * Pool inventory TVL in USD from `spot_tokens.priceUSD` on **both** legs.
 *
 * Returns `null` when either leg lacks a positive finite USD price so callers can
 * fall back to quote-notional depth (`baseLiquidity * displayPrice + quoteLiquidity`).
 */
export function computeSpotPairInventoryTvlUsd(params: {
  baseLiquidity: number;
  quoteLiquidity: number;
  baseTokenPriceUsd: number | null | undefined;
  quoteTokenPriceUsd: number | null | undefined;
}): number | null {
  const pb = params.baseTokenPriceUsd;
  const pq = params.quoteTokenPriceUsd;
  if (
    pb == null ||
    pq == null ||
    !Number.isFinite(pb) ||
    !Number.isFinite(pq) ||
    pb <= 0 ||
    pq <= 0
  ) {
    return null;
  }
  const b = Number.isFinite(params.baseLiquidity)
    ? Math.max(0, params.baseLiquidity)
    : 0;
  const q = Number.isFinite(params.quoteLiquidity)
    ? Math.max(0, params.quoteLiquidity)
    : 0;
  const usd = b * pb + q * pq;
  if (!Number.isFinite(usd)) return null;
  return usd;
}
