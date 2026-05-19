import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'voter_vote_positions' })
@Index('voter_vote_positions_owner_active', ['owner', 'isActive'])
export class VoterVotePositionEntity {
  @PrimaryColumn({ type: 'text' })
  tokenId!: string;

  @PrimaryColumn({ type: 'text' })
  pool!: string;

  @Column({ type: 'text' })
  @Index()
  owner!: string;

  @Column({ type: 'text', default: '0' })
  weight!: string;

  @Column({ type: 'text', default: '0' })
  totalWeight!: string;

  @Column({ type: 'text', nullable: true })
  epochTimestamp!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
