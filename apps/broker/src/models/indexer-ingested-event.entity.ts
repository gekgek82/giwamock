import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Raw indexer queue payloads keyed by `id` (Ponder event id), as received from amm-indexer via RabbitMQ.
 */
@Entity({ name: 'indexed_events' })
export class IndexerIngestedEventEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  /** Full JSON body from the queue (includes `id`, `type`, `transactionHash`, etc.). */
  @Column({ type: 'jsonb' })
  payload!: object;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
