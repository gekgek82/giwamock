import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'ticks' })
@Index('ticks_pool_id_tick_index', ['poolId', 'tickIndex'], { unique: true })
export class TickEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Pool (pair) contract address */
  @Column({ type: 'text' })
  poolId!: string;

  @Column({ type: 'integer' })
  tickIndex!: number;

  /** uint128 liquidity gross (stored as numeric string) */
  @Column({ type: 'numeric', precision: 40, scale: 0, default: 0 })
  liquidityGross!: string;

  /** int128 liquidity net (stored as numeric string) */
  @Column({ type: 'numeric', precision: 40, scale: 0, default: 0 })
  liquidityNet!: string;

  /** fee growth outside token0, Q128.78 */
  @Column({ type: 'numeric', precision: 78, scale: 0, default: 0 })
  feeGrowthOutside0X128!: string;

  /** fee growth outside token1, Q128.78 */
  @Column({ type: 'numeric', precision: 78, scale: 0, default: 0 })
  feeGrowthOutside1X128!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
