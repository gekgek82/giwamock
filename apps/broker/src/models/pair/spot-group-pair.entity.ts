import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'spot_group_pairs' })
export class SpotGroupPairEntity {
  @PrimaryColumn({ type: 'text' })
  pairId!: string;

  @PrimaryColumn({ type: 'text' })
  groupId!: string;

  @Column({ type: 'text', default: '' })
  symbol!: string;

  @Column({ type: 'text', default: '' })
  base!: string;

  @Column({ type: 'text', default: '' })
  quote!: string;
}
