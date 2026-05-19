/**
 * GiwaTer CL factory tiers: fee (bps) ↔ tick spacing used on /pool/launch.
 * Matches static CL fee labels (0.01% = 1 bps, …).
 */
const CL_FEE_BPS_TO_TICK: Readonly<Record<number, number>> = {
  1: 1,
  5: 10,
  30: 50,
  100: 100,
  200: 200,
};

export function inferClTickSpacingFromFeeBps(
  bps: number | null | undefined,
): number | null {
  if (bps == null || !Number.isFinite(bps)) return null;
  return CL_FEE_BPS_TO_TICK[Math.round(bps)] ?? null;
}

const CL_TICK_TO_FEE_BPS: Readonly<Record<number, number>> = Object.fromEntries(
  Object.entries(CL_FEE_BPS_TO_TICK).map(([bps, tick]) => [tick, Number(bps)]),
);

export function clTickSpacingToFeeBps(tickSpacing: number | null | undefined): number | null {
  if (tickSpacing == null || !Number.isFinite(tickSpacing)) return null;
  return CL_TICK_TO_FEE_BPS[tickSpacing] ?? null;
}

export type PoolGatewayMetrics = {
  /** Sum of broker UTC-day base+quote volume (USD). */
  volume24hUsd: number;
  /**
   * **USD TVL** when broker sends both leg `spot_tokens.priceUSD` values on the pair row
   * (`totalTvlUsd`); otherwise `null`.
   */
  totalTvlUsd: number | null;
  /**
   * **Depth proxy for sorting / APR denominator** (not always literal USD).
   *
   * Primary: `baseLiquidity * displayPrice + quoteLiquidity` — inventory in human
   * units, valued in **quote token** using broker `displayPrice` (quote per 1 base).
   * Fallback: `dayBaseTvlUSD + dayQuoteTvlUSD` when inventory×price is unusable
   * (UTC-day liquidity added in USD — often ~0 after day roll).
   */
  tvlSortUsd: number;
  /**
   * Dollar amount to show as “TVL”: real USD when `totalTvlUsd` is set, else the same
   * notional depth as {@link PoolGatewayMetrics.tvlSortUsd}.
   */
  tvlDisplayUsd: number;
  /**
   * Estimated UTC-day fees from `volume24hUsd * effectiveFeeBps / 10_000` when static fee is known.
   * Used only when {@link feesDayUsd} has no on-chain fee accumulation yet.
   */
  feesDayEstimateUsd: number;
  /** UTC-day swap fees in USD from indexed swaps (preferred for display and APR). */
  feesDayUsd: number;
  /** Lifetime cumulative swap fees in USD (same pricing as `feesDayUsd`). */
  totalSwapFeesUsd: number;
  /** Annualized swap-fee APR % from {@link feesDayUsd} over a TVL denominator. */
  swapAprApprox: number;
};

/** Broker JSON may surface DECIMAL-like values as strings; keep UI math stable. */
function asNonNegFiniteNumber(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function estimateTvlSortUsd(params: {
  baseLiquidity: number;
  quoteLiquidity: number;
  displayPrice: number;
  dayBaseTvlUSD: number;
  dayQuoteTvlUSD: number;
}): number {
  const b = Number.isFinite(params.baseLiquidity) ? params.baseLiquidity : 0;
  const q = Number.isFinite(params.quoteLiquidity) ? params.quoteLiquidity : 0;
  const dp = Number.isFinite(params.displayPrice) ? params.displayPrice : 0;
  if (dp > 0 && (b > 0 || q > 0)) {
    const notionalQuote = b * dp + q;
    if (Number.isFinite(notionalQuote) && notionalQuote > 0) {
      return notionalQuote;
    }
  }
  return (params.dayBaseTvlUSD || 0) + (params.dayQuoteTvlUSD || 0);
}

/** Build per-pool gateway metrics from a broker `spot_pairs` row (DTO). */
export function buildGatewayPoolMetricsFromSpotPair(row: {
  baseLiquidity: number;
  quoteLiquidity: number;
  displayPrice: number;
  dayBaseVolumeUSD: number;
  dayQuoteVolumeUSD: number;
  dayBaseTvlUSD: number;
  dayQuoteTvlUSD: number;
  effectiveFeeBps: number | null;
  totalTvlUsd?: number | null;
  totalSwapFeesUsd?: number;
  daySwapFeesUsd?: number;
}): PoolGatewayMetrics {
  const volume24hUsd =
    (row.dayBaseVolumeUSD || 0) + (row.dayQuoteVolumeUSD || 0);
  const tvlSortUsd = estimateTvlSortUsd({
    baseLiquidity: row.baseLiquidity,
    quoteLiquidity: row.quoteLiquidity,
    displayPrice: row.displayPrice,
    dayBaseTvlUSD: row.dayBaseTvlUSD,
    dayQuoteTvlUSD: row.dayQuoteTvlUSD,
  });
  const totalTvlUsd =
    row.totalTvlUsd != null &&
    Number.isFinite(row.totalTvlUsd) &&
    row.totalTvlUsd > 0
      ? row.totalTvlUsd
      : null;
  const tvlDisplayUsd = totalTvlUsd ?? tvlSortUsd;
  const feeBps =
    row.effectiveFeeBps != null && Number.isFinite(row.effectiveFeeBps)
      ? Math.max(0, row.effectiveFeeBps)
      : 0;
  const feesDayEstimateUsd = (volume24hUsd * feeBps) / 10_000;
  const daySwapFees = asNonNegFiniteNumber(row.daySwapFeesUsd);
  const feesDayUsd =
    daySwapFees > 1e-12 ? daySwapFees : feesDayEstimateUsd;
  const totalSwapFeesUsd = asNonNegFiniteNumber(row.totalSwapFeesUsd);
  const tvlAprDen = tvlDisplayUsd > 1e-9 ? tvlDisplayUsd : tvlSortUsd;
  const swapAprApprox =
    tvlAprDen > 1e-9 ? (feesDayUsd / tvlAprDen) * 365 * 100 : 0;
  return {
    volume24hUsd,
    totalTvlUsd,
    tvlSortUsd,
    tvlDisplayUsd,
    feesDayEstimateUsd,
    feesDayUsd,
    totalSwapFeesUsd,
    swapAprApprox,
  };
}

/**
 * Aggregate metrics for pool-list header cards.
 * `tvlDisplayUsd` sums per-pool display TVL; `feesDayUsd` sums UTC-day fee USD (actual when indexed, else estimate).
 */
export function sumGatewayMetrics(
  rows: ReadonlyArray<{ gateway?: PoolGatewayMetrics | undefined }>,
): PoolGatewayMetrics {
  let volume24hUsd = 0;
  let tvlSortUsd = 0;
  let tvlDisplayUsd = 0;
  let feesDayEstimateUsd = 0;
  let feesDayUsd = 0;
  let totalSwapFeesUsd = 0;
  for (const p of rows) {
    const g = p.gateway;
    if (!g) continue;
    volume24hUsd += g.volume24hUsd;
    tvlSortUsd += g.tvlSortUsd;
    tvlDisplayUsd += g.tvlDisplayUsd;
    feesDayEstimateUsd += g.feesDayEstimateUsd;
    feesDayUsd += g.feesDayUsd;
    totalSwapFeesUsd += g.totalSwapFeesUsd;
  }
  const swapAprApprox =
    tvlDisplayUsd > 1e-9 ? (feesDayUsd / tvlDisplayUsd) * 365 * 100 : 0;
  return {
    volume24hUsd,
    totalTvlUsd: null,
    tvlSortUsd,
    tvlDisplayUsd,
    feesDayEstimateUsd,
    feesDayUsd,
    totalSwapFeesUsd,
    swapAprApprox,
  };
}
