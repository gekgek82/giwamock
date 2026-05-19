import { Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'spot_account_follows' })
export class FollowsEntity {
  @PrimaryColumn({ type: 'text' })
  follower!: string;

  @PrimaryColumn({ type: 'text' })
  following!: string;
}
