import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Singleton row id for module-wide defaults from `DynamicSwapFeeModule` admin events. */
export const BROKER_DYNAMIC_SWAP_FEE_GLOBAL_ROW_ID = 'singleton';

/**
 * Latest global defaults: `defaultFeeCap`, `defaultScalingFactor`, `secondsAgo`
 * (used when pool-specific cap/scaling are unset after reset).
 */
@Entity({ name: 'broker_dynamic_swap_fee_globals' })
export class BrokerDynamicSwapFeeGlobalEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text', nullable: true })
  defaultFeeCapWire!: string | null;

  @Column({ type: 'text', nullable: true })
  defaultScalingFactorWire!: string | null;

  @Column({ type: 'text', nullable: true })
  secondsAgoWire!: string | null;

  @Column({ type: 'text', nullable: true })
  defaultUnstakedFeeWire!: string | null;

  @Column({ type: 'text', nullable: true })
  swapFeeModule!: string | null;
}
