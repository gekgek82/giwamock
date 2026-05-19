import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * Materialized Universal Router `Swap` log (one row per hop).
 * Written after {@link aggregateSwap} so pair/token OHLCV and reserves stay canonical.
 */
@Entity({ name: 'swap_hops' })
@Index('swap_hops_tx_hop_idx', ['transactionHash', 'hopIndex'])
@Index('swap_hops_sender_idx', ['sender'])
@Index('swap_hops_recipient_idx', ['recipient'])
export class BrokerSwapHopEntity {
  /** Ponder / indexer event id (same as `indexed_events.id`). */
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'transaction_hash', type: 'varchar', length: 66 })
  transactionHash!: string;

  @Column({ name: 'hop_index', type: 'integer' })
  hopIndex!: number;

  @Column({ name: 'log_index', type: 'integer' })
  logIndex!: number;

  @Column({ type: 'varchar', length: 42 })
  sender!: string;

  /** Router `to` (recipient) address. */
  @Column({ name: 'recipient', type: 'varchar', length: 42 })
  recipient!: string;

  @Column({ name: 'token_in', type: 'varchar', length: 42 })
  tokenIn!: string;

  @Column({ name: 'token_out', type: 'varchar', length: 42 })
  tokenOut!: string;

  @Column({ name: 'is_cl', type: 'boolean' })
  isCL!: boolean;

  @Column({ type: 'boolean' })
  stable!: boolean;

  @Column({ name: 'amount_in', type: 'varchar', length: 96 })
  amountIn!: string;

  @Column({ name: 'amount_out', type: 'varchar', length: 96 })
  amountOut!: string;

  @Column({ name: 'fee_amount', type: 'varchar', length: 96 })
  feeAmount!: string;

  @Column({ name: 'fee_token', type: 'varchar', length: 42 })
  feeToken!: string;

  @Column({ name: 'block_number', type: 'varchar', length: 96 })
  blockNumber!: string;

  @Column({ name: 'block_timestamp', type: 'varchar', length: 96 })
  blockTimestamp!: string;

  @CreateDateColumn({ name: 'materialized_at', type: 'timestamptz' })
  materializedAt!: Date;
}
