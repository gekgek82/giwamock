import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * One row per wallet per liquidity-mint indexer event (`sender` / `to` deduped).
 * Query history with `WHERE accountId = :wallet` (lowercase `0x…`).
 */
@Entity({ name: 'spot_account_liquidity_provisions' })
@Index('spot_account_liq_prov_account_created', ['accountId', 'createdAt'])
@Index('spot_account_liq_prov_dedupe', ['accountId', 'indexerEventId', 'eventType'], {
  unique: true,
})
export class SpotAccountLiquidityProvisionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  accountId!: string;

  @Column({ type: 'text' })
  poolAddress!: string;

  @Column({ type: 'text' })
  eventType!: string;

  @Column({ type: 'text' })
  indexerEventId!: string;

  @Column({ type: 'text' })
  token0!: string;

  @Column({ type: 'text' })
  token1!: string;

  @Column({ type: 'text' })
  amount0!: string;

  @Column({ type: 'text' })
  amount1!: string;

  @Column({ type: 'boolean', nullable: true })
  stable!: boolean | null;

  @Column({ type: 'int', nullable: true })
  clTickSpacing!: number | null;

  @Column({ type: 'text', nullable: true })
  tickLower!: string | null;

  @Column({ type: 'text', nullable: true })
  tickUpper!: string | null;

  @Column({ type: 'text', nullable: true })
  liquidity!: string | null;

  @Column({ type: 'text' })
  blockNumber!: string;

  @Column({ type: 'double precision', default: 0 })
  blockTimestampSec!: number;

  @Column({ type: 'text' })
  transactionHash!: string;

  @Column({ type: 'text' })
  logIndex!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
