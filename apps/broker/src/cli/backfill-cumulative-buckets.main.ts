/**
 * One-shot: backfill cumulative (running total) columns in time bucket tables:
 * - spot_pair_time_buckets: totalBaseVolumeUSD / totalQuoteVolumeUSD / totalTrades / totalFeesUsd
 * - spot_token_time_buckets: totalVolumeUSD / totalTrades / totalFeesUsd
 *
 * Usage (from repo root after build):
 *   pnpm --filter @giwater/broker backfill:cumulative-buckets
 *
 * Requires BROKER_DATABASE_URL.
 */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BackfillCumulativeBucketsModule } from './backfill-cumulative-buckets.module';
import { getRepositoryToken } from '@nestjs/typeorm/dist/common/typeorm.utils';
import { Repository } from 'typeorm';
import { SpotPairTimeBucketEntity } from '../models/pair/spot-pair-time-bucket.entity';
import { SpotTokenTimeBucketEntity } from '../models/token/spot-token-time-bucket.entity';

const EPS = 1e-12;

function nearlyEqual(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= EPS;
}

async function main(): Promise<void> {
  const logger = new Logger('BackfillCumulativeBucketsCli');
  const app = await NestFactory.createApplicationContext(BackfillCumulativeBucketsModule, {
    logger: ['error', 'warn', 'log'],
  });

  const pairRepo = app.get<Repository<SpotPairTimeBucketEntity>>(
    getRepositoryToken(SpotPairTimeBucketEntity),
  );
  const tokenRepo = app.get<Repository<SpotTokenTimeBucketEntity>>(
    getRepositoryToken(SpotTokenTimeBucketEntity),
  );

  try {
    // Pairs
    const pairKeys = await pairRepo
      .createQueryBuilder('b')
      .select('b.pair', 'pair')
      .addSelect('b.resolution', 'resolution')
      .groupBy('b.pair')
      .addGroupBy('b.resolution')
      .orderBy('b.pair', 'ASC')
      .addOrderBy('b.resolution', 'ASC')
      .getRawMany<{ pair: string; resolution: string }>();

    logger.log(`pair streams: ${pairKeys.length}`);

    const pairUpdated = await backfillPairs(logger, pairRepo, pairKeys);
    const tokenUpdated = await backfillTokens(logger, tokenRepo);

    logger.log(`done: pairUpdated=${pairUpdated} tokenUpdated=${tokenUpdated}`);
  } finally {
    await app.close();
  }
}

async function backfillPairs(
  logger: Logger,
  pairRepo: Repository<SpotPairTimeBucketEntity>,
  pairKeys: { pair: string; resolution: string }[],
): Promise<number> {
  let updated = 0;
  for (const { pair, resolution } of pairKeys) {
    let runningBaseUsd = 0;
    let runningQuoteUsd = 0;
    let runningTrades = 0;
    let runningFees = 0;
    let afterIndex = 0;

    for (;;) {
      const rows = await pairRepo
        .createQueryBuilder('b')
        .where('b.pair = :pair AND b.resolution = :resolution', { pair, resolution })
        .andWhere('b.bucketIndex > :after', { after: afterIndex })
        .orderBy('b.bucketIndex', 'ASC')
        .take(5000)
        .getMany();

      if (rows.length === 0) break;

      for (const r of rows) {
        const dBaseUsd = Number.isFinite(r.baseVolumeUSD) ? (r.baseVolumeUSD ?? 0) : 0;
        const dQuoteUsd = Number.isFinite(r.quoteVolumeUSD) ? (r.quoteVolumeUSD ?? 0) : 0;
        const dTrades = Number.isFinite(r.count) ? (r.count ?? 0) : 0;

        runningBaseUsd += dBaseUsd;
        runningQuoteUsd += dQuoteUsd;
        runningTrades += dTrades;

        // Preserve any already-populated fee totals; otherwise carry forward.
        if (Number.isFinite((r as any).totalFeesUsd) && ((r as any).totalFeesUsd ?? 0) > 0) {
          runningFees = (r as any).totalFeesUsd ?? runningFees;
        }

        const nextBase = runningBaseUsd;
        const nextQuote = runningQuoteUsd;
        const nextTrades = runningTrades;
        const nextFees = runningFees;

        const curBase = (r as any).totalBaseVolumeUSD ?? 0;
        const curQuote = (r as any).totalQuoteVolumeUSD ?? 0;
        const curTrades = (r as any).totalTrades ?? 0;
        const curFees = (r as any).totalFeesUsd ?? 0;

        const needs =
          !nearlyEqual(curBase, nextBase) ||
          !nearlyEqual(curQuote, nextQuote) ||
          !nearlyEqual(curTrades, nextTrades) ||
          // only set fees when currently zero (avoid overwriting live-computed)
          (curFees === 0 && nextFees !== 0);

        if (needs) {
          await pairRepo.update(
            { pair: r.pair, resolution: r.resolution, bucketIndex: r.bucketIndex } as any,
            {
              totalBaseVolumeUSD: nextBase,
              totalQuoteVolumeUSD: nextQuote,
              totalTrades: nextTrades,
              ...(curFees === 0 ? { totalFeesUsd: nextFees } : {}),
            } as any,
          );
          updated++;
        }

        afterIndex = r.bucketIndex;
      }
    }

    if (updated > 0 && updated % 5000 === 0) {
      logger.log(`pair backfill progress: updated=${updated}`);
    }
  }
  return updated;
}

async function backfillTokens(
  logger: Logger,
  tokenRepo: Repository<SpotTokenTimeBucketEntity>,
): Promise<number> {
  const tokenKeys = await tokenRepo
    .createQueryBuilder('b')
    .select('b.token', 'token')
    .addSelect('b.resolution', 'resolution')
    .groupBy('b.token')
    .addGroupBy('b.resolution')
    .orderBy('b.token', 'ASC')
    .addOrderBy('b.resolution', 'ASC')
    .getRawMany<{ token: string; resolution: string }>();

  logger.log(`token streams: ${tokenKeys.length}`);

  let updated = 0;
  for (const { token, resolution } of tokenKeys) {
    let runningVolUsd = 0;
    let runningTrades = 0;
    let runningFees = 0;
    let afterIndex = 0;

    for (;;) {
      const rows = await tokenRepo
        .createQueryBuilder('b')
        .where('b.token = :token AND b.resolution = :resolution', { token, resolution })
        .andWhere('b.bucketIndex > :after', { after: afterIndex })
        .orderBy('b.bucketIndex', 'ASC')
        .take(5000)
        .getMany();

      if (rows.length === 0) break;

      for (const r of rows) {
        const dVolUsd = Number.isFinite(r.volumeUSD) ? (r.volumeUSD ?? 0) : 0;
        const dTrades = Number.isFinite(r.count) ? (r.count ?? 0) : 0;

        runningVolUsd += dVolUsd;
        runningTrades += dTrades;

        if (Number.isFinite((r as any).totalFeesUsd) && ((r as any).totalFeesUsd ?? 0) > 0) {
          runningFees = (r as any).totalFeesUsd ?? runningFees;
        }

        const nextVol = runningVolUsd;
        const nextTrades = runningTrades;
        const nextFees = runningFees;

        const curVol = (r as any).totalVolumeUSD ?? 0;
        const curTrades = (r as any).totalTrades ?? 0;
        const curFees = (r as any).totalFeesUsd ?? 0;

        const needs =
          !nearlyEqual(curVol, nextVol) ||
          !nearlyEqual(curTrades, nextTrades) ||
          (curFees === 0 && nextFees !== 0);

        if (needs) {
          await tokenRepo.update(
            { token: r.token, resolution: r.resolution, bucketIndex: r.bucketIndex } as any,
            {
              totalVolumeUSD: nextVol,
              totalTrades: nextTrades,
              ...(curFees === 0 ? { totalFeesUsd: nextFees } : {}),
            } as any,
          );
          updated++;
        }

        afterIndex = r.bucketIndex;
      }
    }

    if (updated > 0 && updated % 5000 === 0) {
      logger.log(`token backfill progress: updated=${updated}`);
    }
  }

  return updated;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

