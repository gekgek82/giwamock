/**
 * Broker `spot_tokens` / `spot_pairs` materialized rows (HTTP read models).
 * Field names mirror TypeORM entities in `apps/broker`.
 */

/** `spot_tokens` row; primary key `id` is the token contract address. */
export interface SpotTokenRecordDto {
  id: string;
  name: string;
  symbol: string;
  ticker: string;
  totalSupply: number;
  logoURI: string;
  decimals: number;
  /**
   * Catalog visibility. **New broker rows default to `false`** (DB + indexer inserts);
   * becomes `true` when a pair is listed or an admin sets visibility.
   */
  listed: boolean;
  priceUSD: number;
  priceUSD1HourBF: number;
  priceUSD1DayBF: number;
  priceUSD1WeekBF: number;
  priceUSD1MonthBF: number;
  sparkline7D: number[];
  cpPrice: number;
  cgId: string;
  cmcId: string;
  ath: number;
  atl: number;
  listingDate: number;
  metricsDayStartTs: number;
  tradesCount: number;
  dayHigh: number;
  dayLow: number;
  dayPriceDifference: number;
  dayPriceDifferencePercentage: number;
  dayTvl: number;
  dayVolume: number;
  dayTvlUSD: number;
  dayVolumeUSD: number;
  hourPriceDifference: number;
  hourPriceDifferencePercentage: number;
  weekPriceDifference: number;
  weekPriceDifferencePercentage: number;
  monthPriceDifference: number;
  monthPriceDifferencePercentage: number;
  creator: string;
  totalMinBuckets: number;
  totalHourBuckets: number;
  totalDayBuckets: number;
  totalWeekBuckets: number;
  totalMonthBuckets: number;
}

/** `spot_pairs` row; primary key `id` is the pair (pool) contract address. */
export interface SpotPairRecordDto {
  id: string;
  /** Canonical on-chain token0 address. */
  token0: string;
  /** Canonical on-chain token1 address. */
  token1: string;
  /**
   * Symbol for the asset at `token0` (not base/quote display order).
   * Empty when the row has not been fully hydrated (e.g. missing indexer fields).
   */
  token0Symbol: string;
  /** Symbol for the asset at `token1`. */
  token1Symbol: string;
  token0Name: string;
  token1Name: string;
  token0Decimals: number;
  token1Decimals: number;
  /**
   * Rule-derived BASE token address for UI/ticker orientation.
   */
  base: string;
  /**
   * Rule-derived QUOTE token address for UI/ticker orientation.
   */
  quote: string;
  baseSymbol: string;
  baseName: string;
  quoteSymbol: string;
  quoteName: string;
  bDecimal: number;
  qDecimal: number;
  /**
   * Best-effort current pool inventory (base/quote) in human token units; incremented
   * from indexed liquidity adds (burns not applied until remove events are wired).
   */
  baseLiquidity: number;
  quoteLiquidity: number;
  /**
   * `baseLiquidity * spot_tokens(base).priceUSD + quoteLiquidity * spot_tokens(quote).priceUSD`
   * when broker resolves **both** leg prices; otherwise `null` (UI may fall back to quote-notional depth).
   */
  totalTvlUsd: number | null;
  symbol: string;
  ticker: string;
  description: string;
  type: string;
  exchange: string;
  isConcentratedLiquidity: boolean;
  /** Concentrated liquidity pools using dynamic fee policy. */
  dynamicFee: boolean;
  /** Static fee in basis points when known; null for CL dynamic-fee mode. */
  effectiveFeeBps: number | null;
  /**
   * `factory_tier` | `factory_custom` | `cl_module_fixed` | `cl_module_dynamic`
   */
  feeSource: string;
  listed: boolean;
  /**
   * Stored spot price as **human token1 per token0** (see pool orientation docs).
   * If `spot_tokens.decimals` was missing for a stable, older rows could be wildly wrong
   * before `effectiveErc20Decimals` stable fallbacks; prefer **`displayPrice`** for UI.
   */
  price: number;
  /**
   * **Quote per 1 base** in human units using the row's canonical `base/quote` orientation
   * (e.g. USDC per 1 ETH when `base=ETH`, `quote=USDC`).
   * This is the usual “pool price” for charts. It is *not* “base per quote”; for **quote per base**
   * in user copy, use `1/displayPrice` when you need “ETH per 1 USDC”.
   */
  displayPrice: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  scales: string[];
  sparkline7D: number[];
  ath: number;
  atl: number;
  listingDate: number;
  metricsDayStartTs: number;
  dayPriceDifference: number;
  dayPriceDifferencePercentage: number;
  /** UTC-day liquidity added (base), resets on day roll with `metricsDayStartTs` */
  dayBaseTvl: number;
  /** UTC-day liquidity added (quote), resets on day roll */
  dayQuoteTvl: number;
  dayBaseVolume: number;
  dayQuoteVolume: number;
  dayBaseTvlUSD: number;
  dayQuoteTvlUSD: number;
  dayBaseVolumeUSD: number;
  dayQuoteVolumeUSD: number;
  /** Lifetime swap fees in USD (fee token × `spot_tokens.priceUSD` when priced). */
  totalSwapFeesUsd: number;
  /** UTC-day swap fees in USD; resets with `metricsDayStartTs` day roll. */
  daySwapFeesUsd: number;
  totalMinBuckets: number;
  totalHourBuckets: number;
  totalDayBuckets: number;
  totalWeekBuckets: number;
  totalMonthBuckets: number;
  /** NFT position manager address for CL pools; null for basic pools. */
  nftAddress: string | null;
  /** CL pools only: tick spacing from PoolCreated. Maps to fee tier: 1→0.01%, 10→0.05%, 50/100→0.3%, 200→1%. Null for basic pools. */
  clTickSpacing: number | null;
  /** Pool grade from admin meta: 1=Verified, 2=Rising, 3=Unknown. Optional — not all endpoints include it. */
  grade?: number;
}

export interface SpotTokensBySymbolResponseDto {
  items: SpotTokenRecordDto[];
}

export interface SpotPairsBySymbolResponseDto {
  items: SpotPairRecordDto[];
}

/** Paginated leaderboard slice (offset/limit are echoed after clamping). */
export interface SpotTokenLeaderboardPageDto {
  offset: number;
  limit: number;
  total: number;
  items: SpotTokenRecordDto[];
}

export interface SpotPairLeaderboardPageDto {
  offset: number;
  limit: number;
  total: number;
  items: SpotPairRecordDto[];
}

/** POST body for `.../by-address/:address/listing` on tokens and pairs. */
export interface SetSpotListedDto {
  listed: boolean;
}

/** Module-wide defaults from `DynamicSwapFeeModule` admin events (wire = on-chain uint encoding). */
export interface ClDynamicFeeGlobalsDto {
  defaultFeeCapWire: string | null;
  defaultScalingFactorWire: string | null;
  secondsAgoWire: string | null;
  /** CLFactory default unstaked fee (uint24 wire). Fee paid by LPs not staked in a gauge. */
  defaultUnstakedFeeWire: string | null;
  /** Current swap fee module address set on CLFactory. Zero-address means no module (tick-based fee). */
  swapFeeModule: string | null;
}

/** Per-CL-pool curve inputs aggregated from module events (not the live TWAP `getFee` result). */
export interface ClDynamicFeeCurveDto {
  poolId: string;
  baseFeeWire: string | null;
  feeCapWire: string | null;
  scalingFactorWire: string | null;
}

/** Optional `tx.origin` discount row when `sender` query is provided. */
export interface ClDynamicFeeSenderSliceDto {
  address: string;
  discountWire: string | null;
  /** Same ÷100 convention as pool fee wire → bps (see broker `feeWireToBps`). */
  discountBps: number | null;
}

/**
 * CL pair dynamic-fee read model: globals + pool curve + optional sender discount.
 * For the instantaneous swap fee at execution time, callers still need `getFee` on-chain.
 */
export interface ClDynamicFeeReadModelDto {
  poolId: string;
  globals: ClDynamicFeeGlobalsDto;
  curve: ClDynamicFeeCurveDto;
  sender: ClDynamicFeeSenderSliceDto | null;
}
