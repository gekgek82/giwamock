import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'spot_account_stake_events' })
@Index('stake_events_tx_log', ['transactionHash', 'logIndex'], { unique: true })
@Index('stake_events_wallet', ['walletAddress'])
@Index('stake_events_pool', ['poolAddress'])
@Index('stake_events_gauge', ['gaugeAddress'])
export class SpotAccountStakeEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  walletAddress!: string;

  @Column({ type: 'text' })
  gaugeAddress!: string;

  @Column({ type: 'text' })
  poolAddress!: string;

  @Column({ type: 'boolean', default: false })
  isCL!: boolean;

  /** 'deposit' or 'withdraw' */
  @Column({ type: 'text' })
  eventType!: string;

  /** Raw wei amount as decimal string (basic gauge) or liquidityToStake (CL gauge). */
  @Column({ type: 'numeric', precision: 78, scale: 0, default: '0' })
  amount!: string;

  /** CL only: NFT token ID as decimal string. */
  @Column({ type: 'numeric', precision: 78, scale: 0, nullable: true })
  tokenId!: string | null;

  @Column({ type: 'bigint', default: 0 })
  blockNumber!: string;

  @Column({ type: 'integer', default: 0 })
  blockTimestampSec!: number;

  @Column({ type: 'text', default: '' })
  transactionHash!: string;

  @Column({ type: 'integer', default: 0 })
  logIndex!: number;
}
