import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'spot_pairs' })
export class SpotPairEntity {
  /** pair contract address */
  @PrimaryColumn({ type: 'text' })
  id!: string;

  /** canonical on-chain token0 address */
  @Column({ type: 'text', default: '' })
  token0!: string;

  /** canonical on-chain token1 address */
  @Column({ type: 'text', default: '' })
  token1!: string;

  /** base token address */
  @Column({ type: 'text', default: '' })
  base!: string;

  /** quote token address */
  @Column({ type: 'text', default: '' })
  quote!: string;

  /** base token symbol */
  @Column({ type: 'text', default: '' })
  baseSymbol!: string;

  /** base token name */
  @Column({ type: 'text', default: '' })
  baseName!: string;

  /** quote token symbol */
  @Column({ type: 'text', default: '' })
  quoteSymbol!: string;

  /** quote token name */
  @Column({ type: 'text', default: '' })
  quoteName!: string;

  /** base token decimal */
  @Column({ type: 'integer', default: 0 })
  bDecimal!: number;

  /** quote token decimal */
  @Column({ type: 'integer', default: 0 })
  qDecimal!: number;

  /** pair symbol */
  @Column({ type: 'text', default: '' })
  symbol!: string;

  /** ticker for trading view */
  @Column({ type: 'text', default: '' })
  ticker!: string;

  /** description for trading view */
  @Column({ type: 'text', default: '' })
  description!: string;

  /** type for trading view */
  @Column({ type: 'text', default: '' })
  type!: string;

  /** exchange for trading view */
  @Column({ type: 'text', default: '' })
  exchange!: string;

  /** true when the pair is a concentrated-liquidity (CL) AMM pool */
  @Column({ type: 'boolean', default: false })
  isConcentratedLiquidity!: boolean;

  /**
   * CL pools only: fee mechanism follows dynamic-fee policy (vs static tier).
   * Basic/v2 pools default false.
   */
  @Column({ type: 'boolean', default: false })
  dynamicFee!: boolean;

  /**
   * Display / routing fee in basis points (1e-4), when a single static value applies.
   * Null for CL pools in full dynamic-fee mode (no fixed bps in read model).
   */
  @Column({ type: 'double precision', nullable: true })
  effectiveFeeBps!: number | null;

  /**
   * Where `effectiveFeeBps` (or fee policy) comes from:
   * `factory_tier` | `factory_custom` | `cl_module_fixed` | `cl_module_dynamic`
   */
  @Column({ type: 'text', default: '' })
  feeSource!: string;

  /** When true, the pair is shown in public listings (off by default until curated). */
  @Column({ type: 'boolean', default: false })
  listed!: boolean;

  /** True when both token0 and token1 are whitelisted on Voter — updated by WhitelistToken events. */
  @Column({ type: 'boolean', default: false })
  gaugeWhitelisted!: boolean;

  /** market price */
  @Column({ type: 'double precision', default: 0 })
  price!: number;

  /** day open price */
  @Column({ type: 'double precision', default: 0 })
  dayOpen!: number;

  /** day high price */
  @Column({ type: 'double precision', default: 0 })
  dayHigh!: number;

  /** day low price */
  @Column({ type: 'double precision', default: 0 })
  dayLow!: number;

  /** scales which supports on the orderbook */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  scales!: string[];

  /** sparkline in 7 days */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  sparkline7D!: number[];

  /** all time high */
  @Column({ type: 'double precision', default: 0 })
  ath!: number;

  /** all time low */
  @Column({ type: 'double precision', default: 0 })
  atl!: number;

  /** listing date timestamp in seconds */
  @Column({ type: 'double precision', default: 0 })
  listingDate!: number;

  /** UTC day start (unix seconds) for `day*` volume / day OHLC aggregates below */
  @Column({ type: 'double precision', default: 0 })
  metricsDayStartTs!: number;

  /** day price difference */
  @Column({ type: 'double precision', default: 0 })
  dayPriceDifference!: number;

  /** day price difference percentage */
  @Column({ type: 'double precision', default: 0 })
  dayPriceDifferencePercentage!: number;

  /**
   * Best-effort **current** pool-side inventory in **base** token human units — seeded from
   * indexer liquidity adds, adjusted on each universal-router `Swap` hop (proxy reserves for routing).
   */
  @Column({ type: 'double precision', default: 0, name: 'baseTvl' })
  baseLiquidity!: number;

  /**
   * Best-effort **current** pool-side inventory in **quote** token human units (same rules as `baseLiquidity`).
   */
  @Column({ type: 'double precision', default: 0, name: 'quoteTvl' })
  quoteLiquidity!: number;

  /** UTC-day liquidity added (base side); resets with {@link metricsDayStartTs} roll */
  @Column({ type: 'double precision', default: 0 })
  dayBaseTvl!: number;

  /** UTC-day liquidity added (quote side); resets with {@link metricsDayStartTs} roll */
  @Column({ type: 'double precision', default: 0 })
  dayQuoteTvl!: number;

  /** day base volume */
  @Column({ type: 'double precision', default: 0 })
  dayBaseVolume!: number;

  /** day quote volume */
  @Column({ type: 'double precision', default: 0 })
  dayQuoteVolume!: number;

  /** day base tvl in USD */
  @Column({ type: 'double precision', default: 0 })
  dayBaseTvlUSD!: number;

  /** day quote tvl in USD */
  @Column({ type: 'double precision', default: 0 })
  dayQuoteTvlUSD!: number;

  /** day base volume in USD */
  @Column({ type: 'double precision', default: 0 })
  dayBaseVolumeUSD!: number;

  /** day quote volume in USD */
  @Column({ type: 'double precision', default: 0 })
  dayQuoteVolumeUSD!: number;

  /**
   * Lifetime cumulative swap fees in **USD** (fee token amount × `spot_tokens.priceUSD`
   * when the broker can price the fee token). Incremented on each indexed swap.
   */
  @Column({ type: 'double precision', default: 0, name: 'totalSwapFeesUsd' })
  totalSwapFeesUsd!: number;

  /**
   * UTC-day cumulative swap fees in **USD** (same rules as `totalSwapFeesUsd`);
   * resets when {@link metricsDayStartTs} rolls with {@link rollSpotPairUtcDayWindow}.
   */
  @Column({ type: 'double precision', default: 0, name: 'daySwapFeesUsd' })
  daySwapFeesUsd!: number;

  /** total minute buckets */
  @Column({ type: 'double precision', default: 0 })
  totalMinBuckets!: number;

  /** total hour buckets */
  @Column({ type: 'double precision', default: 0 })
  totalHourBuckets!: number;

  /** total day buckets */
  @Column({ type: 'double precision', default: 0 })
  totalDayBuckets!: number;

  /** total week buckets */
  @Column({ type: 'double precision', default: 0 })
  totalWeekBuckets!: number;

  /** total month buckets */
  @Column({ type: 'double precision', default: 0 })
  totalMonthBuckets!: number;

  /**
   * CL pools only: address of the NonfungiblePositionManager contract that holds LP NFTs.
   * Null for basic (v2) pools where the LP token lives on the pool contract itself.
   */
  @Column({ type: 'text', nullable: true })
  nftAddress!: string | null;

  /**
   * CL pools only: tick spacing from CLFactory PoolCreated event.
   * Maps to fee tier: 1→0.01%, 10→0.05%, 50/100→0.3%, 200→1%.
   * Null for basic (v2) pools.
   */
  @Column({ type: 'integer', nullable: true })
  clTickSpacing!: number | null;
}
