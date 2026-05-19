import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'voter_reward_claims' })
@Index('voter_reward_claims_from_created', ['from', 'createdAt'])
@Index('voter_reward_claims_contract', ['rewardContract'])
export class VoterRewardClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  claimType!: string;

  @Column({ type: 'text' })
  rewardContract!: string;

  @Column({ type: 'text' })
  rewardToken!: string;

  @Column({ name: 'from', type: 'text' })
  from!: string;

  @Column({ type: 'text', default: '0' })
  amount!: string;

  @Column({ type: 'text', nullable: true })
  pool!: string | null;

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
