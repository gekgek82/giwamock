import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'spot_pair_admin_meta' })
export class SpotPairAdminMetaEntity {
  @PrimaryColumn({ type: 'text' })
  pairId!: string;

  /** 1=Verified, 2=Rising, 3=Unknown */
  @Column({ type: 'integer', default: 3 })
  grade!: number;

  @Column({ type: 'boolean', default: false })
  isGradeManualOverride!: boolean;

  @Column({ type: 'boolean', default: false })
  isVotingEnabled!: boolean;
}

