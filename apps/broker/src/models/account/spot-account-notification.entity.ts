import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Per-wallet feed of indexer-driven activity (swaps, liquidity, etc.).
 * `eventType` matches on-chain payload `type` or a short broker label (`swap`, …).
 */
@Entity({ name: 'spot_account_notifications' })
@Index('spot_account_notifications_account_created', ['accountId', 'createdAt'])
@Index('spot_account_notifications_dedupe', ['accountId', 'indexerEventId', 'eventType'], {
  unique: true,
})
export class SpotAccountNotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  accountId!: string;

  @Column({ type: 'text' })
  eventType!: string;

  /** Indexer event id (`IndexerBrokerOnchainWireBase.id`) for cross-reference. */
  @Column({ type: 'text' })
  indexerEventId!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload!: Record<string, unknown>;

  @Column({ type: 'double precision', default: 0 })
  blockTimestampSec!: number;

  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
