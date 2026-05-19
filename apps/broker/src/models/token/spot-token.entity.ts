import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'spot_tokens' })
export class SpotTokenEntity {
  /** token address */
  @PrimaryColumn({ type: 'text' })
  id!: string;

  /** token name */
  @Column({ type: 'text', default: '' })
  name!: string;

  /** token symbol */
  @Column({ type: 'text', default: '' })
  symbol!: string;

  /** token ticker */
  @Column({ type: 'text', default: '' })
  ticker!: string;

  /** total supply */
  @Column({ type: 'double precision', default: 0 })
  totalSupply!: number;

  /** logo URL */
  @Column({ type: 'text', default: '' })
  logoURI!: string;

  /** token decimals */
  @Column({ type: 'integer', default: 0 })
  decimals!: number;

  /** When true, the token is shown in public listings (off by default until curated). */
  @Column({ type: 'boolean', default: false })
  listed!: boolean;

  /** price in DEX in USD */
  @Column({ type: 'double precision', default: 0 })
  priceUSD!: number;

  /** price in DEX in USD 1 hour before */
  @Column({ type: 'double precision', default: 0 })
  priceUSD1HourBF!: number;

  /** price in DEX in USD 1 day before */
  @Column({ type: 'double precision', default: 0 })
  priceUSD1DayBF!: number;

  /** price in DEX in USD 1 week before */
  @Column({ type: 'double precision', default: 0 })
  priceUSD1WeekBF!: number;

  /** price in DEX in USD 1 month before */
  @Column({ type: 'double precision', default: 0 })
  priceUSD1MonthBF!: number;

  /** sparkline in 7 days */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  sparkline7D!: number[];

  /** price in USD based on coin portals such as CMC or CG */
  @Column({ type: 'double precision', default: 0 })
  cpPrice!: number;

  /** Coingecko id */
  @Column({ type: 'text', default: '' })
  cgId!: string;

  /** Coinmarketcap id */
  @Column({ type: 'text', default: '' })
  cmcId!: string;

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

  /** trades count */
  @Column({ type: 'double precision', default: 0 })
  tradesCount!: number;

  /** day high price */
  @Column({ type: 'double precision', default: 0 })
  dayHigh!: number;

  /** day low price */
  @Column({ type: 'double precision', default: 0 })
  dayLow!: number;

  /** 24h difference in usd */
  @Column({ type: 'double precision', default: 0 })
  dayPriceDifference!: number;

  /** 24h difference percentage in usd */
  @Column({ type: 'double precision', default: 0 })
  dayPriceDifferencePercentage!: number;

  /** day tvl */
  @Column({ type: 'double precision', default: 0 })
  dayTvl!: number;

  /** day volume */
  @Column({ type: 'double precision', default: 0 })
  dayVolume!: number;

  /** day tvl in USD */
  @Column({ type: 'double precision', default: 0 })
  dayTvlUSD!: number;

  /** day volume in USD */
  @Column({ type: 'double precision', default: 0 })
  dayVolumeUSD!: number;

  /** hour difference in usd */
  @Column({ type: 'double precision', default: 0 })
  hourPriceDifference!: number;

  /** hour difference percentage in usd */
  @Column({ type: 'double precision', default: 0 })
  hourPriceDifferencePercentage!: number;

  /** 7D difference in usd */
  @Column({ type: 'double precision', default: 0 })
  weekPriceDifference!: number;

  /** 7D difference percentage in usd */
  @Column({ type: 'double precision', default: 0 })
  weekPriceDifferencePercentage!: number;

  /** month difference in usd */
  @Column({ type: 'double precision', default: 0 })
  monthPriceDifference!: number;

  /** month difference percentage in usd */
  @Column({ type: 'double precision', default: 0 })
  monthPriceDifferencePercentage!: number;

  /** creator address */
  @Column({ type: 'text', default: '' })
  creator!: string;

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
}
