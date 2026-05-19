import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Per-CL-pool dynamic fee curve inputs mirrored from `DynamicSwapFeeModule` events.
 * `feeCap` / `scalingFactor` are cleared on-chain on `DynamicFeeReset`; `baseFee` is not.
 */
@Entity({ name: 'broker_dynamic_swap_fee_pools' })
export class BrokerDynamicSwapFeePoolEntity {
  @PrimaryColumn({ type: 'text' })
  poolId!: string;

  /** From `CustomFeeSet` (`fee`); null until first event for this pool. */
  @Column({ type: 'text', nullable: true })
  baseFeeWire!: string | null;

  @Column({ type: 'text', nullable: true })
  feeCapWire!: string | null;

  @Column({ type: 'text', nullable: true })
  scalingFactorWire!: string | null;
}
