import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndexerIngestedEventEntity } from '../models/indexer-ingested-event.entity';
import { IndexerAggregationService } from '../aggregation/indexer-aggregation.service';

export type ReplayIndexedEventsOptions = {
  dryRun: boolean;
  /** Skip N rows after filters (order: createdAt ASC, then id ASC). */
  skip: number;
  /** Max rows to process (after skip). */
  limit?: number;
  /** Inclusive: only events with `id` >= this (string compare on text PK). */
  fromId?: string;
  /** Inclusive lower bound on `createdAt`. */
  afterCreatedAt?: Date;
  /** Inclusive upper bound on `createdAt`. */
  beforeCreatedAt?: Date;
  continueOnError: boolean;
  progressEvery: number;
};

@Injectable()
export class ReplayIndexedEventsRunnerService {
  private readonly logger = new Logger(ReplayIndexedEventsRunnerService.name);

  constructor(
    @InjectRepository(IndexerIngestedEventEntity)
    private readonly events: Repository<IndexerIngestedEventEntity>,
    private readonly aggregation: IndexerAggregationService,
  ) {}

  async run(options: ReplayIndexedEventsOptions): Promise<{
    total: number;
    processed: number;
    failed: number;
  }> {
    const qb = this.events
      .createQueryBuilder('e')
      .orderBy('e.createdAt', 'ASC')
      .addOrderBy('e.id', 'ASC');

    if (options.fromId !== undefined) {
      qb.andWhere('e.id >= :fromId', { fromId: options.fromId });
    }
    if (options.afterCreatedAt) {
      qb.andWhere('e.createdAt > :after', { after: options.afterCreatedAt });
    }
    if (options.beforeCreatedAt) {
      qb.andWhere('e.createdAt <= :before', { before: options.beforeCreatedAt });
    }

    if (options.skip > 0) {
      qb.skip(options.skip);
    }
    if (options.limit !== undefined) {
      qb.take(options.limit);
    }

    const rows = await qb.getMany();
    const total = rows.length;

    this.logger.log(
      `Selected ${total} row(s) from indexed_events (order: createdAt ASC, id ASC)`,
    );

    if (options.dryRun) {
      for (const r of rows.slice(0, 5)) {
        this.logger.log(
          `dry-run sample: id=${r.id} createdAt=${r.createdAt.toISOString()}`,
        );
      }
      if (total > 5) {
        this.logger.log(`dry-run: … (${total - 5} more)`);
      }
      return { total, processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;
    let index = 0;

    for (const row of rows) {
      index++;
      try {
        await this.aggregation.aggregatePayload(row.payload);
        processed++;
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Replay failed at ${index}/${total} id=${row.id}: ${msg}`,
        );
        if (!options.continueOnError) {
          throw err;
        }
      }

      if (
        options.progressEvery > 0 &&
        index % options.progressEvery === 0 &&
        index < total
      ) {
        this.logger.log(`Replay progress: ${index}/${total}`);
      }
    }

    this.logger.log(
      `Replay finished: processed=${processed} failed=${failed} total=${total}`,
    );
    return { total, processed, failed };
  }
}
