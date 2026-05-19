/**
 * One-shot: copy latest completed `spot_token_time_buckets.close` per resolution into
 * `spot_tokens.priceUSD*BF` columns (same logic as the broker OHLCV job).
 *
 * Edge tokens get BF fields automatically after each bucket write (swaps + wall-clock OHLCV).
 * This CLI runs a **full `spot_tokens` scan** — useful for orphan rows or manual repair.
 * Respect **`DISABLE_SPOT_TOKEN_BF_SYNC`** (same as the Nest service).
 *
 * Railway Cron example (e.g. every 5 minutes): `node dist/cli/spot-token-bf-sync.main.js`
 * from **`apps/broker`** with `BROKER_DATABASE_URL` set.
 */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { OhlcvPipelineModule } from './ohlcv-pipeline.module';
import { SwapOhlcvAggregationService } from '../swap-ohlcv/swap-ohlcv-aggregation.service';

async function main(): Promise<void> {
  const logger = new Logger('SpotTokenBfSyncCli');
  const app = await NestFactory.createApplicationContext(OhlcvPipelineModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const swapOhlcv = app.get(SwapOhlcvAggregationService);
    await swapOhlcv.syncSpotTokenBfFieldsFromTimeBuckets();
    logger.log('syncSpotTokenBfFieldsFromTimeBuckets done');
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
