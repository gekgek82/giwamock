import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { KolBadgeType } from '@giwater/shared';

@Entity({ name: 'referral_tier_badges' })
export class ReferralTierBadgeEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  address!: string;

  @Column({ type: 'text' })
  badgeType!: KolBadgeType;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  grantedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  grantedBy!: string | null;
}
