import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'spot_swaps' })
@Index('baseIndex', ['base'])
@Index('quoteIndex', ['quote'])
@Index('timestamp', ['timestamp'])
@Index('accountIndex', ['account'])
@Index('assetIndex', ['assetSymbol', 'asset'])
@Index('blockNumberIndex', ['blockNumber'])
export class SpotSwapEntity {
  // swap id of the swap
  @PrimaryColumn({ type: 'text' })
  swapId!: string;

  // pair contract address of the swap
  @PrimaryColumn({ type: 'text' })
  pair!: string;

  // order id of the swap
  @Column({ type: 'integer', default: 0 })
  orderId!: number;

  // base token address of the pair
  @Column({ type: 'text', default: '' })
  base!: string;

  // quote token address of the pair
  @Column({ type: 'text', default: '' })
  quote!: string;

  // base token symbol of the pair
  @Column({ type: 'text', default: '' })
  baseSymbol!: string;

  // base token logo uri of the pair
  @Column({ type: 'text', default: '' })
  baseLogoURI!: string;

  // quote token symbol of the pair
  @Column({ type: 'text', default: '' })
  quoteSymbol!: string;

  // quote token logo uri of the pair
  @Column({ type: 'text', default: '' })
  quoteLogoURI!: string;

  // symbol of the pair
  @Column({ type: 'text', default: '' })
  pairSymbol!: string;

  // is bid or ask
  @Column({ type: 'boolean', default: false })
  isBid!: boolean;

  // price of the swap
  @Column({ type: 'double precision', default: 0 })
  price!: number;

  // sender of the transaction
  @Column({ type: 'text', default: '' })
  account!: string;

  // asset of the swap
  @Column({ type: 'text', default: '' })
  asset!: string;

  // symbol of the asset
  @Column({ type: 'text', default: '' })
  assetSymbol!: string;

  // asset decimals of the asset
  @Column({ type: 'integer', default: 0 })
  assetDecimals!: number;

  // amount of the swap
  @Column({ type: 'double precision', default: 0 })
  amount!: number;

  // value in USD
  @Column({ type: 'double precision', default: 0 })
  valueUSD!: number;

  // base amount of the swap
  @Column({ type: 'double precision', default: 0 })
  baseAmount!: number;

  // quote amount of the swap
  @Column({ type: 'double precision', default: 0 })
  quoteAmount!: number;

  // base reserve after the swap
  @Column({ type: 'double precision', default: 0 })
  baseReserveAfter!: number;

  // quote reserve after the swap
  @Column({ type: 'double precision', default: 0 })
  quoteReserveAfter!: number;

  // timestamp of the swap
  @Column({ type: 'integer', default: 0 })
  timestamp!: number;

  // recipient of the swap
  @Column({ type: 'text', default: '' })
  recipient!: string;

  // asset fee of the swap
  @Column({ type: 'double precision', default: 0 })
  assetFee!: number;

  // router swap path hint: true for CL route, false for basic route
  @Column({ type: 'boolean', default: false })
  isCL!: boolean;

  // router swap path hint: stable pool hop or not
  @Column({ type: 'boolean', default: false })
  stable!: boolean;

  // hop index within a multi-hop routed swap path
  @Column({ type: 'integer', default: 0 })
  hopIndex!: number;

  // fee amount reported by router swap event
  @Column({ type: 'double precision', default: 0 })
  feeAmount!: number;

  // fee token address reported by router swap event
  @Column({ type: 'text', default: '' })
  feeToken!: string;

  // block number of the swap
  @Column({ type: 'integer', default: 0 })
  blockNumber!: number;

  // hash of the transaction
  @Column({ type: 'text', default: '' })
  txHash!: string;

  // tx index of the swap
  @Column({ type: 'integer', default: 0 })
  txIndex!: number;

  // event index of the swap
  @Column({ type: 'integer', default: 0 })
  eventIndex!: number;
}
