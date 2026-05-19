import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'spot_groups' })
export class SpotGroupEntity {
  // trading view group id (e.g. giwater_bitcoin, giwater_memecoin)
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text', default: '' })
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;
}
