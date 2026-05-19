import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type LiquidityHistogramBucketType = 'tick' | 'price';

@Entity({ name: 'liquidity_histogram_buckets' })
@Index(
  'liquidity_hist_pool_type_tick_range',
  ['poolId', 'bucketType', 'bucketStartTick', 'bucketEndTick'],
  { unique: true },
)
export class LiquidityHistogramBucketEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Pool (pair) contract address */
  @Column({ type: 'text' })
  poolId!: string;

  @Column({ type: 'text' })
  bucketType!: LiquidityHistogramBucketType;

  @Column({ type: 'integer' })
  bucketStartTick!: number;

  @Column({ type: 'integer' })
  bucketEndTick!: number;

  @Column({ type: 'double precision', default: 0 })
  priceLower!: number;

  @Column({ type: 'double precision', default: 0 })
  priceUpper!: number;

  /** uint128-scale liquidity (stored as numeric string) */
  @Column({ type: 'numeric', precision: 40, scale: 0, default: 0 })
  liquidityAmount!: string;

  /** uint128-scale active liquidity (stored as numeric string) */
  @Column({ type: 'numeric', precision: 40, scale: 0, default: 0 })
  activeLiquidityAmount!: string;

  @Column({ type: 'integer', default: 0 })
  positionCount!: number;

  @Column({ type: 'bigint', default: 0 })
  snapshotBlockNumber!: string;

  @Column({ type: 'timestamptz' })
  snapshotTime!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
