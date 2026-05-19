import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * OHLCV-style bucket per pool and resolution.
 * PK `(pair, resolution, bucketIndex)` — `bucketIndex` starts at 1 per stream and increments
 * so the swap aggregator and cron share the same monotonic id (via `swap_bucket_state`).
 */
@Entity({ name: 'spot_pair_time_buckets' })
@Index('spot_pair_time_buckets_pair_res_start', ['pair', 'resolution', 'bucketStartTs'], {
  unique: true,
})
export class SpotPairTimeBucketEntity {
  @PrimaryColumn({ type: 'text' })
  pair!: string;

  @PrimaryColumn({ type: 'text' })
  resolution!: string;

  @PrimaryColumn({ type: 'integer' })
  bucketIndex!: number;

  /** Inclusive bucket start (unix seconds, UTC-aligned per resolution). */
  @Column({ type: 'double precision' })
  bucketStartTs!: number;

  /** Exclusive bucket end (unix seconds). */
  @Column({ type: 'double precision', default: 0 })
  bucketEndTs!: number;

  @Column({ type: 'text', default: '' })
  base!: string;

  @Column({ type: 'text', default: '' })
  quote!: string;

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
  baseVolume!: number;

  @Column({ type: 'double precision', default: 0 })
  quoteVolume!: number;

  @Column({ type: 'double precision', default: 0 })
  baseVolumeUSD!: number;

  @Column({ type: 'double precision', default: 0 })
  quoteVolumeUSD!: number;

  /**
   * Running totals (carry-forward + deltas) for charting.
   * These are accumulated across bucketIndex within the same `(pair, resolution)` stream.
   */
  @Column({ type: 'double precision', default: 0, name: 'totalBaseVolumeUSD' })
  totalBaseVolumeUSD!: number;

  @Column({ type: 'double precision', default: 0, name: 'totalQuoteVolumeUSD' })
  totalQuoteVolumeUSD!: number;

  @Column({ type: 'double precision', default: 0, name: 'totalFeesUsd' })
  totalFeesUsd!: number;

  @Column({ type: 'double precision', default: 0, name: 'totalTrades' })
  totalTrades!: number;

  @Column({ type: 'double precision', default: 0, name: 'baseTvl' })
  baseLiquidity!: number;

  @Column({ type: 'double precision', default: 0, name: 'quoteTvl' })
  quoteLiquidity!: number;

  @Column({ type: 'double precision', default: 0, name: 'baseTvlUSD' })
  baseLiquidityUSD!: number;

  @Column({ type: 'double precision', default: 0, name: 'quoteTvlUSD' })
  quoteLiquidityUSD!: number;

  @Column({ type: 'double precision', default: 0 })
  count!: number;
}
