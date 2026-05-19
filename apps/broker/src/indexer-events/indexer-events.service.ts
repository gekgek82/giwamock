import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { IndexerEventPersistenceService } from './indexer-event-persistence.service';

/**
 * In-process envelope after RabbitMQ JSON parse.
 * Intended wire shape: `IndexerBrokerQueuePayload` (`@giwater/shared` / `contract-events`).
 */
export type IndexerEventEnvelope = {
  receivedAt: string;
  payload: unknown;
};

@Injectable()
export class IndexerEventsService {
  private readonly subject = new Subject<IndexerEventEnvelope>();

  /** Internal stream for downstream processing (OHLCV builders, persistence, etc.). */
  readonly events$ = this.subject.asObservable();

  constructor(
    private readonly persistence: IndexerEventPersistenceService,
  ) {}

  async onIndexerEvent(payload: unknown): Promise<void> {
    await this.persistence.persistIfNew(payload);

    const envelope: IndexerEventEnvelope = {
      receivedAt: new Date().toISOString(),
      payload,
    };

    this.subject.next(envelope);
  }
}
