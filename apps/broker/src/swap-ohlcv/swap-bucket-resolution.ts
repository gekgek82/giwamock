/** Swap OHLCV bucket resolutions (shared by swap aggregator + cron). */
export const SWAP_BUCKET_RESOLUTIONS = [
  '1m',
  '1h',
  '1d',
  '1w',
  '1mo',
] as const;

export type SwapBucketResolution = (typeof SWAP_BUCKET_RESOLUTIONS)[number];

/**
 * Wall-clock length (seconds) of the **`1m` resolution stream** row in DB.
 *
 * - Default **60**: true one-minute candles (cron can run every minute).
 * - Use **300** when your deploy only runs wall-clock OHLCV **every 5 minutes** (e.g. Railway cron
 *   minimum): bucket grid aligns with that cadence so you do not depend on gap-fill across dozens of
 *   missing minutes between runs.
 *
 * Env: **`SWAP_BUCKET_FINEST_PERIOD_SEC`** — clamped to **60–3600**.
 */
export function finestResolutionPeriodSeconds(): number {
  const raw = Number(process.env.SWAP_BUCKET_FINEST_PERIOD_SEC ?? '60');
  if (!Number.isFinite(raw)) {
    return 60;
  }
  const s = Math.floor(raw);
  return Math.min(3600, Math.max(60, s));
}

export function isSwapBucketResolution(s: string): s is SwapBucketResolution {
  return (SWAP_BUCKET_RESOLUTIONS as readonly string[]).includes(s);
}

export function periodSeconds(resolution: SwapBucketResolution): number {
  switch (resolution) {
    case '1m':
      return finestResolutionPeriodSeconds();
    case '1h':
      return 3600;
    case '1d':
      return 86400;
    case '1w':
      return 86400 * 7;
    case '1mo':
      return 86400 * 30;
    default:
      return finestResolutionPeriodSeconds();
  }
}

/**
 * Bucket start (inclusive) in unix seconds, UTC calendar alignment for 1d/1w/1mo.
 * Swaps and cron use the same alignment so they share `bucketIndex` via `swap_bucket_state`.
 */
export function alignBucketStart(
  unixSeconds: number,
  resolution: SwapBucketResolution,
): number {
  const t = Math.floor(unixSeconds);
  const finest = finestResolutionPeriodSeconds();
  switch (resolution) {
    case '1m':
      return Math.floor(t / finest) * finest;
    case '1h':
      return Math.floor(t / 3600) * 3600;
    case '1d': {
      const d = new Date(t * 1000);
      return Math.floor(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000,
      );
    }
    case '1w': {
      const d = new Date(t * 1000);
      const dow = d.getUTCDay();
      const delta = dow === 0 ? -6 : 1 - dow;
      const monday = Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate() + delta,
      );
      return Math.floor(monday / 1000);
    }
    case '1mo': {
      const d = new Date(t * 1000);
      return Math.floor(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000,
      );
    }
    default:
      return Math.floor(t / finest) * finest;
  }
}

/** Next bucket start after `currentStart` (aligned stream; month uses calendar roll). */
export function nextBucketStart(
  currentStart: number,
  resolution: SwapBucketResolution,
): number {
  if (resolution === '1mo') {
    const d = new Date(currentStart * 1000);
    return Math.floor(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000,
    );
  }
  return currentStart + periodSeconds(resolution);
}

export function bucketEndExclusive(
  bucketStart: number,
  resolution: SwapBucketResolution,
): number {
  return nextBucketStart(bucketStart, resolution);
}
