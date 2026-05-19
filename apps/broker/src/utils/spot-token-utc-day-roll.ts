import type { SpotTokenEntity } from '../models/token/spot-token.entity';

/**
 * When `metricsDayStartTs` crosses a new UTC day boundary, reset **day-scoped**
 * metrics on `spot_tokens` (volumes, intraday OHLC hints, day TVL deltas).
 *
 * Used by swap aggregation, liquidity mint bumps, and OHLCV cron so one roll applies everywhere.
 */
export function rollSpotTokenUtcDayWindow(row: SpotTokenEntity, dayKey: number): void {
  const prev = Math.floor(Number(row.metricsDayStartTs) || 0);
  const next = Math.floor(Number(dayKey) || 0);
  if (prev === next) {
    return;
  }
  row.metricsDayStartTs = next;
  row.dayVolume = 0;
  row.dayVolumeUSD = 0;
  row.dayHigh = 0;
  row.dayLow = 0;
  row.dayPriceDifference = 0;
  row.dayPriceDifferencePercentage = 0;
  row.dayTvl = 0;
  row.dayTvlUSD = 0;
}
