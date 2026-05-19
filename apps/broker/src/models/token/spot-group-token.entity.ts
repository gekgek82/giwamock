import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'spot_group_tokens' })
export class SpotGroupTokenEntity {
  /** group id */
  @PrimaryColumn({ type: 'text' })
  groupId!: string;

  /** token id */
  @PrimaryColumn({ type: 'text' })
  tokenId!: string;

  /** token symbol */
  @Column({ type: 'text', default: '' })
  symbol!: string;
}
