import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Latest default volatile/stable tier fees from `PoolFactory` `SetFee` events.
 * Used to backfill new basic pairs and to bulk-refresh `spot_pairs` on tier changes.
 */
@Entity({ name: 'broker_pool_factory_fee_defaults' })
export class BrokerPoolFactoryFeeDefaultsEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'double precision', nullable: true })
  volatileFeeBps!: number | null;

  @Column({ type: 'double precision', nullable: true })
  stableFeeBps!: number | null;
}
