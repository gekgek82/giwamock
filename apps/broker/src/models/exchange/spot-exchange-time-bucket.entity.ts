import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'spot_exchange_time_buckets' })
export class SpotExchangeTimeBucketEntity {
  /// index to find previous bucket
  @PrimaryColumn({ type: 'integer' })
  index!: number;

  /// protocol id as "standard-exchange"
  @PrimaryColumn({ type: 'text' })
  protocolId!: string;

  /// timestamp
  @PrimaryColumn({ type: 'double precision' })
  timestamp!: number;

  /// network name
  @Column({ type: 'text', default: '' })
  networkName!: string;

  /// accumulated volume
  @Column({ type: 'double precision', default: 0 })
  totalVolume!: number;

  /// accumulated swap fees (USD)
  @Column({ type: 'double precision', default: 0 })
  totalFeesUsd!: number;

  /// TVL
  @Column({ type: 'double precision', default: 0 })
  tvl!: number;

  /// total global trades
  @Column({ type: 'double precision', default: 0 })
  totalGlobalTrades!: number;

  /// total global pairs
  @Column({ type: 'double precision', default: 0 })
  totalGlobalPairs!: number;

  /// total global traders
  @Column({ type: 'double precision', default: 0 })
  totalGlobalTraders!: number;
}
