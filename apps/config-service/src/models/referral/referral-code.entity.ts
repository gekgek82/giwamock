import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'referral_codes' })
export class ReferralCodeEntity {
  @PrimaryColumn({ type: 'text' })
  address!: string;

  @Column({ type: 'text', unique: true })
  code!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
