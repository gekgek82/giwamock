import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Active fee discounts for `tx.origin` from `DiscountedRegistered` / `DiscountedDeregistered`.
 */
@Entity({ name: 'broker_dynamic_swap_fee_discounts' })
export class BrokerDynamicSwapFeeDiscountEntity {
  @PrimaryColumn({ type: 'text' })
  address!: string;

  @Column({ type: 'text' })
  discountWire!: string;
}
