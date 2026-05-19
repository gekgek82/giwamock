import type { SpotPairEntity } from '../models/pair/spot-pair.entity';

/**
 * When `metricsDayStartTs` crosses a new UTC day boundary, reset **day-scoped**
 * volume/price/TVL fields on `spot_pairs`. Does **not** touch `baseLiquidity` / `quoteLiquidity`
 * (running pool-side liquidity) or **`totalSwapFeesUsd`** (lifetime; only `daySwapFeesUsd` resets here).
 *
 * Used by swap aggregation and liquidity indexing so one canonical roll applies everywhere.
 */
export function rollSpotPairUtcDayWindow(pair: SpotPairEntity, dayKey: number): void {
  const prev = Math.floor(Number(pair.metricsDayStartTs) || 0);
  const next = Math.floor(Number(dayKey) || 0);
  if (prev === next) {
    return;
  }
  pair.metricsDayStartTs = next;
  pair.dayBaseVolume = 0;
  pair.dayQuoteVolume = 0;
  pair.dayBaseVolumeUSD = 0;
  pair.dayQuoteVolumeUSD = 0;
  pair.dayOpen = 0;
  pair.dayHigh = 0;
  pair.dayLow = 0;
  pair.dayPriceDifference = 0;
  pair.dayPriceDifferencePercentage = 0;
  pair.dayBaseTvl = 0;
  pair.dayQuoteTvl = 0;
  pair.dayBaseTvlUSD = 0;
  pair.dayQuoteTvlUSD = 0;
  pair.daySwapFeesUsd = 0;
}
