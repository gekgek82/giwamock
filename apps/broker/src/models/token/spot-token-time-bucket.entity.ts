import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * OHLCV-style bucket per token and resolution.
 * PK `(token, resolution, bucketIndex)` with monotonic `bucketIndex` (see `swap_bucket_state`).
 */
@Entity({ name: 'spot_token_time_buckets' })
@Index('spot_token_time_buckets_token_res_start', ['token', 'resolution', 'bucketStartTs'], {
  unique: true,
})
export class SpotTokenTimeBucketEntity {
  @PrimaryColumn({ type: 'text' })
  token!: string;

  @PrimaryColumn({ type: 'text' })
  resolution!: string;

  @PrimaryColumn({ type: 'integer' })
  bucketIndex!: number;

  @Column({ type: 'double precision' })
  bucketStartTs!: number;

  @Column({ type: 'double precision', default: 0 })
  bucketEndTs!: number;

  @Column({ type: 'text', default: '' })
  symbol!: string;

  @Column({ type: 'double precision', default: 0 })
  open!: number;

  @Column({ type: 'double precision', default: 0 })
  high!: number;

  @Column({ type: 'double precision', default: 0 })
  low!: number;

  @Column({ type: 'double precision', default: 0 })
  close!: number;

  @Column({ type: 'double precision', default: 0 })
  average!: number;

  @Column({ type: 'double precision', default: 0 })
  difference!: number;

  @Column({ type: 'double precision', default: 0 })
  differencePercentage!: number;

  @Column({ type: 'double precision', default: 0 })
  tvl!: number;

  @Column({ type: 'double precision', default: 0 })
  tvlUSD!: number;

  @Column({ type: 'double precision', default: 0 })
  volume!: number;

  @Column({ type: 'double precision', default: 0 })
  volumeUSD!: number;

  /**
   * Running totals (carry-forward + deltas) for charting.
   * Accumulated across bucketIndex within `(token, resolution)`.
   */
  @Column({ type: 'double precision', default: 0, name: 'totalVolumeUSD' })
  totalVolumeUSD!: number;

  @Column({ type: 'double precision', default: 0, name: 'totalFeesUsd' })
  totalFeesUsd!: number;

  @Column({ type: 'double precision', default: 0, name: 'totalTrades' })
  totalTrades!: number;

  @Column({ type: 'double precision', default: 0 })
  count!: number;
}
