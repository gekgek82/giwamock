import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'account_balance_time_buckets' })
export class AccountBalanceTimeBucketsEntity {
  @PrimaryColumn({ type: 'text' })
  account!: string;

  @PrimaryColumn({ type: 'integer' })
  index!: number;

  @Column({ type: 'double precision', default: 0 })
  totalBalanceInUSD!: number;

  @Column({ type: 'double precision', default: 0 })
  totalTokens!: number;
}
