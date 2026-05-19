/**
 * One-shot prune of `spot_pair_time_buckets` + `spot_token_time_buckets` older than
 * TIME_BUCKET_RETENTION_DAYS (default 365).
 *
 * **Run from the monorepo root** (same as typical Railway `cwd`), after install + broker build:
 *
 *   pnpm prune:broker:time-buckets
 *
 * Equivalent:
 *
 *   pnpm --filter @giwater/broker prune:time-buckets
 *
 * Do not assume `cwd` is `apps/broker`; `pnpm --filter` resolves the workspace package from root.
 */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PruneTimeBucketsModule } from './prune-time-buckets.module';
import { TimeBucketPruneService } from '../swap-ohlcv/time-bucket-prune.service';

async function main(): Promise<void> {
  const logger = new Logger('PruneTimeBucketsCli');
  const app = await NestFactory.createApplicationContext(PruneTimeBucketsModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const svc = app.get(TimeBucketPruneService);
    const result = await svc.pruneExpiredBuckets();
    logger.log(`done: ${JSON.stringify(result)}`);
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
