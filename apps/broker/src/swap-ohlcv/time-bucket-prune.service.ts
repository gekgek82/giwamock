import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpotPairTimeBucketEntity } from '../models/pair/spot-pair-time-bucket.entity';
import { SpotTokenTimeBucketEntity } from '../models/token/spot-token-time-bucket.entity';

/** Default rolling window for OHLCV bucket rows (pair + token time buckets). */
const DEFAULT_RETENTION_DAYS = 365;

function retentionDaysFromEnv(): number {
  const raw = process.env.TIME_BUCKET_RETENTION_DAYS;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_RETENTION_DAYS;
  }
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_RETENTION_DAYS;
  }
  return n;
}

/**
 * Deletes pair/token OHLCV bucket rows older than the configured retention window.
 * Does not modify `spot_swaps`, `indexed_events`, or `swap_bucket_state`.
 */
@Injectable()
export class TimeBucketPruneService {
  private readonly logger = new Logger(TimeBucketPruneService.name);

  constructor(
    @InjectRepository(SpotPairTimeBucketEntity)
    private readonly pairBuckets: Repository<SpotPairTimeBucketEntity>,
    @InjectRepository(SpotTokenTimeBucketEntity)
    private readonly tokenBuckets: Repository<SpotTokenTimeBucketEntity>,
  ) {}

  /**
   * `bucketStartTs` is unix seconds (see entities). Cutoff = now − retention days.
   */
  async pruneExpiredBuckets(): Promise<{
    retentionDays: number;
    cutoffSec: number;
    pairDeleted: number;
    tokenDeleted: number;
  }> {
    const retentionDays = retentionDaysFromEnv();
    const cutoffSec =
      Math.floor(Date.now() / 1000) - retentionDays * 24 * 60 * 60;

    const pairResult = await this.pairBuckets
      .createQueryBuilder()
      .delete()
      .from(SpotPairTimeBucketEntity)
      .where('bucketStartTs < :cutoff', { cutoff: cutoffSec })
      .execute();

    const tokenResult = await this.tokenBuckets
      .createQueryBuilder()
      .delete()
      .from(SpotTokenTimeBucketEntity)
      .where('bucketStartTs < :cutoff', { cutoff: cutoffSec })
      .execute();

    const pairDeleted = pairResult.affected ?? 0;
    const tokenDeleted = tokenResult.affected ?? 0;

    this.logger.log(
      `Pruned time buckets older than ${retentionDays}d (cutoff unix=${cutoffSec}): spot_pair_time_buckets=${pairDeleted} rows, spot_token_time_buckets=${tokenDeleted} rows`,
    );

    return {
      retentionDays,
      cutoffSec,
      pairDeleted,
      tokenDeleted,
    };
  }
}
