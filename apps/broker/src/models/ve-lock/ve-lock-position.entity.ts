import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 've_lock_positions' })
@Index('ve_lock_positions_owner_active', ['owner', 'isActive'])
export class VeLockPositionEntity {
  @PrimaryColumn({ type: 'text' })
  tokenId!: string;

  @Column({ type: 'text' })
  @Index()
  owner!: string;

  @Column({ type: 'text', default: '0' })
  amount!: string;

  @Column({ type: 'text', nullable: true })
  lockEnd!: string | null;

  @Column({ type: 'boolean', default: false })
  isPermanent!: boolean;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
