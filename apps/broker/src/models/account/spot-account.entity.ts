import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'spot_accounts' })
export class SpotAccountEntity {
  /// account wallet address
  @PrimaryColumn({ type: 'text' })
  id!: string;

  /// total value locked in USD
  @Column({ type: 'double precision', default: 0 })
  tvlUSD!: number;

  /// last traded
  @Column({ type: 'double precision', default: 0 })
  lastTraded!: number;

  /// total orders that a user has currently
  @Column({ type: 'double precision', default: 0 })
  totalOrders!: number;

  /// total order history that a user has currently
  @Column({ type: 'double precision', default: 0 })
  totalOrderHistory!: number;

  /// total trade number of records that a user has currently
  @Column({ type: 'double precision', default: 0 })
  totalTradeHistory!: number;

  /// total USD volume of trades that a user has currently
  @Column({ type: 'double precision', default: 0 })
  totalVolumeUSD!: number;

  /// total created tokens
  @Column({ type: 'double precision', default: 0 })
  totalCreatedTokens!: number;

  /// api key for the account
  @Column({ type: 'text', default: '' })
  apiKey!: string;

  /// email for the account
  @Column({ type: 'text', default: '' })
  email!: string;
}
