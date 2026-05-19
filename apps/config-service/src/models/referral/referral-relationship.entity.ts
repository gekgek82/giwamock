import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'referral_relationships' })
export class ReferralRelationshipEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  referrerAddress!: string;

  @Column({ type: 'text', unique: true })
  refereeAddress!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
