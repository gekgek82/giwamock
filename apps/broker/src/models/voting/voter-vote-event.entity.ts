import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'voter_vote_events' })
@Index('voter_vote_events_owner_created', ['owner', 'createdAt'])
@Index('voter_vote_events_token_pool', ['tokenId', 'pool'])
export class VoterVoteEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  tokenId!: string;

  @Column({ type: 'text' })
  pool!: string;

  @Column({ type: 'text' })
  owner!: string;

  @Column({ type: 'text' })
  eventType!: string;

  @Column({ type: 'text', default: '0' })
  weight!: string;

  @Column({ type: 'text', default: '0' })
  totalWeight!: string;

  @Column({ type: 'text', nullable: true })
  epochTimestamp!: string | null;

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
