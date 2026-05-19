/**
 * One-shot: advance wall-clock OHLCV buckets for all resolutions (1m, 1h, 1d, 1w, 1mo).
 *
 * **Cron:** from monorepo root (broker `dist/` must exist — build in deploy or run
 * `pnpm --filter @giwater/broker build` once):
 *
 *   pnpm ohlcv:broker:pipeline
 *
 * Or from `apps/broker` with `dist` present:
 *
 *   node dist/cli/ohlcv-pipeline.main.js
 *
 * Requires `BROKER_DATABASE_URL` (and optional `DEX_USD_QUOTE_*` for USD fields).
 * Finest bucket width: **`SWAP_BUCKET_FINEST_PERIOD_SEC`** (default `60`; use **`300`** with 5‑minute Railway cron).
 * When the long-running **broker HTTP** process also runs the in-app cron, set
 * `DISABLE_BROKER_OHLCV_CRON=true` on that service to avoid double work.
 *
 * After buckets advance, **`spot_tokens.priceUSD*BF`** are refreshed for edge tokens from OHLCV
 * closes; periodic full scan uses **`SPOT_TOKEN_BF_FULL_SCAN_INTERVAL_SEC`** (see README).
 */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { OhlcvPipelineModule } from './ohlcv-pipeline.module';
import { SwapOhlcvAggregationService } from '../swap-ohlcv/swap-ohlcv-aggregation.service';

async function main(): Promise<void> {
  const logger = new Logger('OhlcvPipelineCli');
  const app = await NestFactory.createApplicationContext(OhlcvPipelineModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const swapOhlcv = app.get(SwapOhlcvAggregationService);
    await swapOhlcv.ensureWallClockBuckets();
    logger.log('ensureWallClockBuckets done');
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
