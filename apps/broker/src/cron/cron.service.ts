import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SWAP_BUCKET_RESOLUTIONS } from '../swap-ohlcv/swap-bucket-resolution';
import { SwapOhlcvAggregationService } from '../swap-ohlcv/swap-ohlcv-aggregation.service';
import { TimeBucketPruneService } from '../swap-ohlcv/time-bucket-prune.service';

/** Resolutions advanced inside `ensureWallClockBuckets` (re-export for tooling). */
export const OHLCV_CHART_RESOLUTIONS = SWAP_BUCKET_RESOLUTIONS;

@Injectable()
export class BrokerCronService {
  constructor(
    private readonly swapOhlcv: SwapOhlcvAggregationService,
    private readonly timeBucketPrune: TimeBucketPruneService,
  ) {}

  /**
   * Daily in-process prune (optional). Prefer Railway Cron calling `pnpm prune:time-buckets`
   * so you can run the job only when the service is up or on a separate schedule.
   * Set ENABLE_SCHEDULED_TIME_BUCKET_PRUNE=true to enable this cron.
   */
  @Cron('0 4 * * *', { name: 'time-bucket-prune', timeZone: 'UTC' })
  async pruneOldTimeBuckets(): Promise<void> {
    if (process.env.ENABLE_SCHEDULED_TIME_BUCKET_PRUNE !== 'true') {
      return;
    }
    await this.timeBucketPrune.pruneExpiredBuckets();
  }

  /**
   * Wall-clock OHLCV buckets: **`1m`** (width from `SWAP_BUCKET_FINEST_PERIOD_SEC`, default 60s),
   * **`1h` / `1d` / `1w` / `1mo`** per pool and token.
   * Disable when Railway Cron runs the OHLCV CLI (`DISABLE_BROKER_OHLCV_CRON=true`).
   */
  @Cron('*/1 * * * *', { name: 'ohlcv-pipeline', timeZone: 'UTC' })
  async runEveryMinute(): Promise<void> {
    if (process.env.DISABLE_BROKER_OHLCV_CRON === 'true') {
      return;
    }
    await this.swapOhlcv.ensureWallClockBuckets();
  }
}
