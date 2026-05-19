import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'spot_exchanges' })
export class SpotExchangeEntity {
  /// standard-exchange
  @PrimaryColumn({ type: 'text' })
  id!: string;

  /// network name
  @Column({ type: 'text', default: '' })
  networkName!: string;

  /// orderbook bytecode to locate pair contract address
  @Column({ type: 'text', default: '' })
  bytecode!: string;

  /// deployer address to predict pair address
  @Column({ type: 'text', default: '' })
  deployer!: string;

  /// total day buckets
  @Column({ type: 'double precision', default: 0 })
  totalDayBuckets!: number;

  /// total week buckets
  @Column({ type: 'double precision', default: 0 })
  totalWeekBuckets!: number;

  /// total month buckets
  @Column({ type: 'double precision', default: 0 })
  totalMonthBuckets!: number;
}
