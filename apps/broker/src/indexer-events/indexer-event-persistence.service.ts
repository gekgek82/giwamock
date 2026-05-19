import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsOrder, Repository } from 'typeorm';
import { IndexerIngestedEventEntity } from '../models/indexer-ingested-event.entity';

function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

function readId(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const id = (payload as Record<string, unknown>).id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

@Injectable()
export class IndexerEventPersistenceService {
  private readonly logger = new Logger(IndexerEventPersistenceService.name);

  constructor(
    @InjectRepository(IndexerIngestedEventEntity)
    private readonly repo: Repository<IndexerIngestedEventEntity>,
  ) {}

  /**
   * Persists the full payload when `id` is present. Skips if `id` already exists.
   */
  async persistIfNew(payload: unknown): Promise<void> {
    const id = readId(payload);
    if (!id) {
      this.logger.debug(
        'Skipping DB persist: payload has no string `id` (e.g. setup-only message)',
      );
      return;
    }

    try {
      const body =
        typeof payload === 'object' && payload !== null
          ? payload
          : { value: payload };
      await this.repo.insert({
        id,
        payload: body,
      });
      this.logger.log(`Stored indexer event in DB (id=${id})`);
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        this.logger.log(`Skipped indexer event — already stored (id=${id})`);
        return;
      }
      throw err;
    }
  }

  async getRecentIndexedEvents(offset: number, limit: number): Promise<{
    offset: number;
    limit: number;
    total: number;
    items: IndexerIngestedEventEntity[];
  }> {
    const order: FindOptionsOrder<IndexerIngestedEventEntity> = {
      createdAt: 'DESC',
    };

    const [items, total] = await this.repo.findAndCount({
      order,
      skip: offset,
      take: limit,
    });

    return {
      offset,
      limit,
      total,
      items,
    };
  }
}
