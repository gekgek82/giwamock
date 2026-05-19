import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One row per VotingEscrow event per tokenId.
 * For Split: fromTokenId=tokenId1, toTokenId=tokenId2 (both new tokens from the split).
 * For Merge: fromTokenId=_from (burned), toTokenId=_to (receiving).
 */
@Entity({ name: 've_lock_events' })
@Index('ve_lock_events_token_id_created', ['tokenId', 'createdAt'])
@Index('ve_lock_events_owner_created', ['owner', 'createdAt'])
export class VeLockEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  tokenId!: string;

  @Column({ type: 'text' })
  owner!: string;

  @Column({ type: 'text' })
  eventType!: string;

  @Column({ type: 'text', nullable: true })
  depositType!: string | null;

  @Column({ type: 'text', default: '0' })
  value!: string;

  @Column({ type: 'text', nullable: true })
  lockEnd!: string | null;

  @Column({ type: 'text', nullable: true })
  fromTokenId!: string | null;

  @Column({ type: 'text', nullable: true })
  toTokenId!: string | null;

  @Column({ type: 'text', unique: true })
  indexerEventId!: string;

  @Column({ type: 'text' })
  blockNumber!: string;

  @Column({ type: 'text' })
  blockTimestamp!: string;

  @Column({ type: 'text' })
  transactionHash!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
