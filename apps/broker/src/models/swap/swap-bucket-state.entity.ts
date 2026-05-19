import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Cursor for monotonic `bucketIndex` per (entity, resolution).
 * Swap aggregator and cron both advance this in row-locked transactions.
 */
@Entity({ name: 'swap_bucket_state' })
export class SwapBucketStateEntity {
  @PrimaryColumn({ type: 'text' })
  kind!: 'pair' | 'token';

  @PrimaryColumn({ type: 'text' })
  entityId!: string;

  @PrimaryColumn({ type: 'text' })
  resolution!: string;

  /** Last materialized bucket index (starts at 1). */
  @Column({ type: 'integer' })
  lastBucketIndex!: number;

  /** `bucketStart` unix seconds of the row at `lastBucketIndex`. */
  @Column({ type: 'double precision' })
  lastBucketStartTs!: number;
}
