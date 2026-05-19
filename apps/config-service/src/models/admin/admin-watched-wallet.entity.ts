import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'admin_watched_wallets' })
export class AdminWatchedWalletEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  address!: string;

  @Column({ type: 'text', default: '' })
  label!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
