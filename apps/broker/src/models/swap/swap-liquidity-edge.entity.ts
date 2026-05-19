import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * One row per pool: undirected liquidity edge between two tokens.
 * The swap routing graph is token nodes + these pool edges (queried in-memory for BFS).
 */
@Entity({ name: 'swap_liquidity_edges' })
export class SwapLiquidityEdgeEntity {
  @PrimaryColumn({ type: 'text' })
  poolAddress!: string;

  @Column({ type: 'text' })
  token0!: string;

  @Column({ type: 'text' })
  token1!: string;

  @Column({ type: 'boolean', default: false })
  stable!: boolean;

  @Column({ type: 'boolean', default: false })
  isConcentratedLiquidity!: boolean;

  /** Uniswap V3–style `tickSpacing` when `isConcentratedLiquidity`; null for volatile/stable v2 edges. */
  @Column({ type: 'integer', nullable: true })
  clTickSpacing!: number | null;
}
