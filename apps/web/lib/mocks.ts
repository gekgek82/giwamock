/**
 * Mock data registry for design preview.
 *
 * Activated by `NEXT_PUBLIC_MOCK_DATA=true` (see `MOCK_DATA_ENABLED` in
 * `@/lib/config`). When the flag is on, `apiFetch` in `@/lib/apiClient`
 * consults `getMockResponse(...)` before doing a real network call and, on
 * match, returns the canned payload directly.
 *
 * All mock payloads for every API surface (gateway parity, broker-admin,
 * admin, indexer) live in this file as a single flat list of handlers.
 * To add a mock:
 *   1. Find or add a handler with `method` + `path` matching the endpoint
 *      `apiFetch` would call (after stripping the `/api/{gateway,admin,
 *      broker-admin}` proxy prefix and absolute origin).
 *   2. Return a value shaped like the endpoint's DTO. TypeScript will not
 *      enforce shape here (responses are typed at the caller), so use
 *      `satisfies <DTO>` to lock the shape in.
 *
 * Path matching:
 *   - `string` path: exact match against the normalized path (no query).
 *   - `RegExp` path: full-match against the normalized path; captured
 *     groups are passed to `respond` via `ctx.pathParams`.
 */

import type {
  GetProtocolContractsResponseDto,
  SpotPairRecordDto,
  SpotPairLeaderboardPageDto,
  SpotTokenRecordDto,
  SpotTokenLeaderboardPageDto,
  SpotTokensBySymbolResponseDto,
  SwapRouteResponseDto,
  SwapRouteHopDto,
  PortfolioOverview,
  LiquidityPosition,
  LiquidityPositionsResponse,
  LockPosition,
  LockPositionsResponse,
  VotePosition,
  VotePositionsResponse,
  PointEarning,
  PointPositionsResponse,
  PortfolioTransaction,
  TransactionsResponse,
  ClaimableRewardsResponse,
  ClaimResponse,
  ClaimPointEarningResponse,
  ClaimPositionPointsResponse,
  TPointLockPosition,
  TPointLocksResponse,
  TPointVotingPower,
  TPointVotePosition,
  TPointVotesResponse,
  TPointLockPokeResponse,
  LpStakeIntent,
  LpStakeIntentsResponse,
  VoteIncentive,
  VoteIncentivesResponse,
  PoolEpochIncentivesResponse,
  ReferralCodeResponse,
  ReferralClaimResponse,
  ActiveBanner,
} from "@giwater/shared";
import { CONTRACT_ADDRESSES } from "@giwater/shared/constants";
import type { EpochInfo, VotePoolInfo, VotePoolsResponse } from "@/types/indexer";
import { MOCK_DATA_ENABLED } from "@/lib/config";

interface MockContext {
  method: string;
  path: string;
  query: URLSearchParams;
  pathParams: string[];
  body: unknown;
}

interface MockHandler {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string | RegExp;
  /** Short label for debugging — surfaced in dev console when matched. */
  description: string;
  respond: (ctx: MockContext) => unknown;
}

// ============================================================================
// Mock fixtures
// ============================================================================
//
// Liquidity / pool catalog — ported from the inline mocks that used to live
// in `LiquidityMobilePageView`. Five pools spanning CL/BASIC × stable/volatile
// × gauge/no-gauge so the pool filters all have something to show.

const MOCK_TOKEN_ADDR = {
  WETH: "0x000000000000000000000000000000000000beef",
  cbBTC: "0x000000000000000000000000000000000000c0bb",
  USDC: "0x0000000000000000000000000000000000000ccc",
  USDT: "0x0000000000000000000000000000000000000ddd",
  GIWA: "0x0000000000000000000000000000000000000a11",
  TER: "0x0000000000000000000000000000000000000fee",
  DAI: "0x000000000000000000000000000000000000da11",
} as const;

const MOCK_POOL_ADDR = {
  wethCbbtc: "0x0000000000000000000000000000000000abcd01",
  usdcUsdt: "0x0000000000000000000000000000000000abcd02",
  wethGiwa: "0x0000000000000000000000000000000000abcd03",
  terWeth: "0x0000000000000000000000000000000000abcd04",
  usdcDai: "0x0000000000000000000000000000000000abcd05",
} as const;

const MOCK_GAUGE_ADDR: Record<string, string> = {
  [MOCK_POOL_ADDR.wethCbbtc]: "0x000000000000000000000000000000000000ga01",
  [MOCK_POOL_ADDR.usdcUsdt]: "0x000000000000000000000000000000000000ga02",
  [MOCK_POOL_ADDR.wethGiwa]: "0x000000000000000000000000000000000000ga03",
  [MOCK_POOL_ADDR.terWeth]: "0x000000000000000000000000000000000000ga04",
  [MOCK_POOL_ADDR.usdcDai]: "0x000000000000000000000000000000000000ga05",
};

// ----------------------------------------------------------------------------
// On-chain read mocks (balance / allowance / reserves)
//
// `apiFetch` mocks above only cover REST surfaces. The deposit / withdraw
// flows also read wallet balances, ERC-20 allowances, and pool reserves via
// wagmi/viem RPC — those bypass `apiFetch` entirely. The helpers below are
// consumed by `useTokenBalance`, `useTokenAllowance`, and `usePoolReserves`
// so that under `MOCK_DATA_ENABLED` the design preview can drive the full
// input + approval-modal UX without needing a live testnet position.
//
// Trade-off: the wallet `writeContract` calls (`approve`, `addLiquidity`)
// are NOT mocked — the user can click Approve / Deposit and walk through
// every panel up to the wallet prompt, but the prompt itself will revert
// because the mock pair addresses don't exist on-chain. That's the cut
// agreed with the user (UI-flow preview, not a full simulator).
// ----------------------------------------------------------------------------

const TEN = 10n;
function pow10(n: number): bigint {
  let v = 1n;
  for (let i = 0; i < n; i++) v *= TEN;
  return v;
}

const MOCK_TOKEN_BALANCES: Record<string, bigint> = {
  [MOCK_TOKEN_ADDR.WETH.toLowerCase()]: 5n * pow10(18),
  [MOCK_TOKEN_ADDR.cbBTC.toLowerCase()]: 5n * pow10(7),
  [MOCK_TOKEN_ADDR.USDC.toLowerCase()]: 10_000n * pow10(6),
  [MOCK_TOKEN_ADDR.USDT.toLowerCase()]: 10_000n * pow10(6),
  [MOCK_TOKEN_ADDR.GIWA.toLowerCase()]: 50_000n * pow10(18),
  [MOCK_TOKEN_ADDR.TER.toLowerCase()]: 1_000n * pow10(18),
  [MOCK_TOKEN_ADDR.DAI.toLowerCase()]: 10_000n * pow10(18),
};

// Reserves are recorded as (token0, token1) AFTER the address-sort the
// `useBasicPoolDeposit` hook performs (lowercase string compare). When
// editing here, double-check which token sorts first for the pair.
const MOCK_POOL_RESERVES: Record<
  string,
  { reserve0: bigint; reserve1: bigint }
> = {
  // wethCbbtc — beef < c0bb so token0=WETH, token1=cbBTC
  [MOCK_POOL_ADDR.wethCbbtc.toLowerCase()]: {
    reserve0: 1_000n * pow10(18), // WETH
    reserve1: 70n * pow10(8), // cbBTC
  },
  // usdcUsdt — 0ccc < 0ddd so token0=USDC, token1=USDT
  [MOCK_POOL_ADDR.usdcUsdt.toLowerCase()]: {
    reserve0: 1_000_000n * pow10(6), // USDC
    reserve1: 1_000_000n * pow10(6), // USDT
  },
  // wethGiwa — 0a11 < beef so token0=GIWA, token1=WETH
  [MOCK_POOL_ADDR.wethGiwa.toLowerCase()]: {
    reserve0: 1_000_000n * pow10(18), // GIWA
    reserve1: 100n * pow10(18), // WETH
  },
  // terWeth — 0fee < beef so token0=TER, token1=WETH
  [MOCK_POOL_ADDR.terWeth.toLowerCase()]: {
    reserve0: 100_000n * pow10(18), // TER
    reserve1: 30n * pow10(18), // WETH
  },
  // usdcDai — 0ccc < da11 so token0=USDC, token1=DAI
  [MOCK_POOL_ADDR.usdcDai.toLowerCase()]: {
    reserve0: 1_000_000n * pow10(6), // USDC
    reserve1: 1_000_000n * pow10(18), // DAI
  },
};

/** Returns a mocked wallet balance for a known mock token, else `null`. */
export function getMockTokenBalance(address?: string): bigint | null {
  if (!MOCK_DATA_ENABLED || !address) return null;
  return MOCK_TOKEN_BALANCES[address.toLowerCase()] ?? null;
}

/** True when the address is one of our preview tokens (not a real ERC-20). */
export function isMockToken(address?: string): boolean {
  if (!MOCK_DATA_ENABLED || !address) return false;
  return address.toLowerCase() in MOCK_TOKEN_BALANCES;
}

/** Returns mocked pool reserves for a known mock pool, else `null`. */
export function getMockPoolReserves(
  poolAddress?: string,
): { reserve0: bigint; reserve1: bigint } | null {
  if (!MOCK_DATA_ENABLED || !poolAddress) return null;
  return MOCK_POOL_RESERVES[poolAddress.toLowerCase()] ?? null;
}

interface MockTokenInput {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  priceUSD?: number;
}

// `tokenRowToTokenInfo` (gatewayBrokerApi.ts) reads only id/symbol/name/
// decimals/logoURI/listed from each row; remaining fields default to 0/"" so
// the SpotTokenRecordDto contract stays satisfied without inflating the file.
function buildMockSpotToken(input: MockTokenInput): SpotTokenRecordDto {
  return {
    id: input.address,
    name: input.name,
    symbol: input.symbol,
    ticker: input.symbol,
    totalSupply: 0,
    logoURI: input.logoURI ?? "",
    decimals: input.decimals,
    listed: true,
    priceUSD: input.priceUSD ?? 0,
    priceUSD1HourBF: 0,
    priceUSD1DayBF: 0,
    priceUSD1WeekBF: 0,
    priceUSD1MonthBF: 0,
    sparkline7D: [],
    cpPrice: 0,
    cgId: "",
    cmcId: "",
    ath: 0,
    atl: 0,
    listingDate: 0,
    metricsDayStartTs: 0,
    tradesCount: 0,
    dayHigh: 0,
    dayLow: 0,
    dayPriceDifference: 0,
    dayPriceDifferencePercentage: 0,
    dayTvl: 0,
    dayVolume: 0,
    dayTvlUSD: 0,
    dayVolumeUSD: 0,
    hourPriceDifference: 0,
    hourPriceDifferencePercentage: 0,
    weekPriceDifference: 0,
    weekPriceDifferencePercentage: 0,
    monthPriceDifference: 0,
    monthPriceDifferencePercentage: 0,
    creator: "",
    totalMinBuckets: 0,
    totalHourBuckets: 0,
    totalDayBuckets: 0,
    totalWeekBuckets: 0,
    totalMonthBuckets: 0,
  };
}

// Order matters: `getContractAddresses` slices the first 10 into
// `popularTokens` (rendered as the modal's "Popular token" chip row), so the
// most common assets should appear first.
const MOCK_SPOT_TOKENS: SpotTokenRecordDto[] = [
  buildMockSpotToken({ address: MOCK_TOKEN_ADDR.WETH, symbol: "WETH", name: "Wrapped Ether", decimals: 18, priceUSD: 3_200 }),
  buildMockSpotToken({ address: MOCK_TOKEN_ADDR.USDC, symbol: "USDC", name: "USD Coin", decimals: 6, priceUSD: 1 }),
  buildMockSpotToken({ address: MOCK_TOKEN_ADDR.USDT, symbol: "USDT", name: "Tether", decimals: 6, priceUSD: 1 }),
  buildMockSpotToken({ address: MOCK_TOKEN_ADDR.GIWA, symbol: "GIWA", name: "Giwa", decimals: 18, priceUSD: 0.42 }),
  buildMockSpotToken({ address: MOCK_TOKEN_ADDR.TER, symbol: "TER", name: "Ter", decimals: 18, priceUSD: 1.18 }),
  buildMockSpotToken({ address: MOCK_TOKEN_ADDR.cbBTC, symbol: "cbBTC", name: "Coinbase BTC", decimals: 8, priceUSD: 67_500 }),
  buildMockSpotToken({ address: MOCK_TOKEN_ADDR.DAI, symbol: "DAI", name: "Dai", decimals: 18, priceUSD: 1 }),
];

interface MockPoolInput {
  id: string;
  base: { address: string; symbol: string; name: string; decimals: number };
  quote: { address: string; symbol: string; name: string; decimals: number };
  isStable: boolean;
  isConcentratedLiquidity: boolean;
  effectiveFeeBps: number;
  tvlUsd: number;
  volume24hUsd: number;
  daySwapFeesUsd: number;
  totalSwapFeesUsd: number;
}

// Build a SpotPairRecordDto where `convertSpotPairRecordToPoolInfo` (in
// `hooks/usePools`) will yield a pool with the intended TVL / volume / fees.
// The non-display fields are zeroed; the preview only consumes the fields
// surfaced through `buildGatewayPoolMetricsFromSpotPair`.
function buildMockSpotPair(input: MockPoolInput): SpotPairRecordDto {
  return {
    id: input.id,
    // Concentrated pools own a Slipstream NFT for each LP position; basic
    // pools don't. Mock pools have neither, so leave it null per the DTO.
    nftAddress: null,
    clTickSpacing: null,
    token0: input.base.address,
    token1: input.quote.address,
    token0Symbol: input.base.symbol,
    token1Symbol: input.quote.symbol,
    token0Name: input.base.name,
    token1Name: input.quote.name,
    token0Decimals: input.base.decimals,
    token1Decimals: input.quote.decimals,
    base: input.base.address,
    quote: input.quote.address,
    baseSymbol: input.base.symbol,
    baseName: input.base.name,
    quoteSymbol: input.quote.symbol,
    quoteName: input.quote.name,
    bDecimal: input.base.decimals,
    qDecimal: input.quote.decimals,
    baseLiquidity: 0,
    quoteLiquidity: 0,
    totalTvlUsd: input.tvlUsd,
    symbol: `${input.base.symbol}/${input.quote.symbol}`,
    ticker: `${input.base.symbol}/${input.quote.symbol}`,
    description: "",
    type: input.isStable ? "stable" : "volatile",
    exchange: "giwater",
    isConcentratedLiquidity: input.isConcentratedLiquidity,
    dynamicFee: false,
    effectiveFeeBps: input.effectiveFeeBps,
    feeSource: input.isConcentratedLiquidity ? "cl_module_fixed" : "factory_tier",
    listed: true,
    price: 0,
    displayPrice: 0,
    dayOpen: 0,
    dayHigh: 0,
    dayLow: 0,
    scales: [],
    sparkline7D: [],
    ath: 0,
    atl: 0,
    listingDate: 0,
    metricsDayStartTs: 0,
    dayPriceDifference: 0,
    dayPriceDifferencePercentage: 0,
    dayBaseTvl: 0,
    dayQuoteTvl: 0,
    dayBaseVolume: 0,
    dayQuoteVolume: 0,
    dayBaseTvlUSD: input.tvlUsd / 2,
    dayQuoteTvlUSD: input.tvlUsd / 2,
    dayBaseVolumeUSD: input.volume24hUsd / 2,
    dayQuoteVolumeUSD: input.volume24hUsd / 2,
    totalSwapFeesUsd: input.totalSwapFeesUsd,
    daySwapFeesUsd: input.daySwapFeesUsd,
    totalMinBuckets: 0,
    totalHourBuckets: 0,
    totalDayBuckets: 0,
    totalWeekBuckets: 0,
    totalMonthBuckets: 0,
  };
}

const MOCK_SPOT_PAIRS: SpotPairRecordDto[] = [
  buildMockSpotPair({
    id: MOCK_POOL_ADDR.wethCbbtc,
    base: { address: MOCK_TOKEN_ADDR.WETH, symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
    quote: { address: MOCK_TOKEN_ADDR.cbBTC, symbol: "cbBTC", name: "Coinbase BTC", decimals: 8 },
    isStable: false,
    isConcentratedLiquidity: true,
    effectiveFeeBps: 3.28,
    tvlUsd: 33_660_000,
    volume24hUsd: 91_260_000,
    daySwapFeesUsd: 28_291.98,
    totalSwapFeesUsd: 1_245_300.5,
  }),
  buildMockSpotPair({
    id: MOCK_POOL_ADDR.usdcUsdt,
    base: { address: MOCK_TOKEN_ADDR.USDC, symbol: "USDC", name: "USD Coin", decimals: 6 },
    quote: { address: MOCK_TOKEN_ADDR.USDT, symbol: "USDT", name: "Tether", decimals: 6 },
    isStable: true,
    isConcentratedLiquidity: false,
    effectiveFeeBps: 5,
    tvlUsd: 12_500_000,
    volume24hUsd: 4_800_000,
    daySwapFeesUsd: 2_400,
    totalSwapFeesUsd: 198_400,
  }),
  buildMockSpotPair({
    id: MOCK_POOL_ADDR.wethGiwa,
    base: { address: MOCK_TOKEN_ADDR.WETH, symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
    quote: { address: MOCK_TOKEN_ADDR.GIWA, symbol: "GIWA", name: "Giwa", decimals: 18 },
    isStable: false,
    isConcentratedLiquidity: true,
    effectiveFeeBps: 30,
    tvlUsd: 845_300,
    volume24hUsd: 1_120_000,
    daySwapFeesUsd: 3_360,
    totalSwapFeesUsd: 42_180,
  }),
  buildMockSpotPair({
    id: MOCK_POOL_ADDR.terWeth,
    base: { address: MOCK_TOKEN_ADDR.TER, symbol: "TER", name: "Ter", decimals: 18 },
    quote: { address: MOCK_TOKEN_ADDR.WETH, symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
    isStable: false,
    isConcentratedLiquidity: false,
    effectiveFeeBps: 30,
    tvlUsd: 2_180_000,
    volume24hUsd: 415_000,
    daySwapFeesUsd: 1_245,
    totalSwapFeesUsd: 86_330,
  }),
  buildMockSpotPair({
    id: MOCK_POOL_ADDR.usdcDai,
    base: { address: MOCK_TOKEN_ADDR.USDC, symbol: "USDC", name: "USD Coin", decimals: 6 },
    quote: { address: MOCK_TOKEN_ADDR.DAI, symbol: "DAI", name: "Dai", decimals: 18 },
    isStable: true,
    isConcentratedLiquidity: false,
    effectiveFeeBps: 5,
    tvlUsd: 4_320_000,
    volume24hUsd: 612_000,
    daySwapFeesUsd: 306,
    totalSwapFeesUsd: 24_900,
  }),
];

// ----------------------------------------------------------------------------
// Vote / Epoch fixtures
//
// Derived from MOCK_SPOT_PAIRS so the voting list cross-references the same
// pool identities the liquidity surface shows. Vote weights / shares are
// hand-picked so the five mocked pools sum to ~100% of voting power.
// ----------------------------------------------------------------------------

interface MockVotePoolInput {
  pair: SpotPairRecordDto;
  voteShare: number; // percentage, e.g. 28.5
  voteWeightTpoint: number; // tPOINT count (UI converts)
  incentivesUsd: number;
  emissionAprPct: number; // annual %
  vAprPct: number; // annual %
}

function buildMockVotePool(input: MockVotePoolInput): VotePoolInfo {
  const { pair } = input;
  const isStable = pair.type === "stable";
  return {
    poolAddress: pair.id,
    token0: {
      address: pair.token0,
      symbol: pair.token0Symbol,
      decimals: pair.token0Decimals,
    },
    token1: {
      address: pair.token1,
      symbol: pair.token1Symbol,
      decimals: pair.token1Decimals,
    },
    isStable,
    poolType: pair.isConcentratedLiquidity ? "concentrated" : isStable ? "stable" : "volatile",
    tickSpacing: pair.isConcentratedLiquidity ? 60 : null,
    feePercent: ((pair.effectiveFeeBps ?? 0) / 100).toFixed(4),
    tvl: (pair.totalTvlUsd ?? 0).toFixed(2),
    gaugeAddress: MOCK_GAUGE_ADDR[pair.id] ?? "0x0000000000000000000000000000000000000000",
    voteWeight: input.voteWeightTpoint.toFixed(2),
    voteShare: input.voteShare.toFixed(4),
    // 7-day fees ≈ 7× the daily figure for the mocked pool.
    fees7d: (pair.daySwapFeesUsd * 7).toFixed(2),
    incentives: input.incentivesUsd.toFixed(2),
    totalRewards: (pair.daySwapFeesUsd * 7 + input.incentivesUsd).toFixed(2),
    vAPR: input.vAprPct.toFixed(2),
    emissionApr: input.emissionAprPct.toFixed(2),
  };
}

const MOCK_VOTE_POOLS: VotePoolInfo[] = [
  buildMockVotePool({
    pair: MOCK_SPOT_PAIRS[0], // WETH/cbBTC
    voteShare: 38.42,
    voteWeightTpoint: 1_245_300,
    incentivesUsd: 18_500,
    emissionAprPct: 24.8,
    vAprPct: 31.2,
  }),
  buildMockVotePool({
    pair: MOCK_SPOT_PAIRS[1], // USDC/USDT
    voteShare: 24.18,
    voteWeightTpoint: 783_400,
    incentivesUsd: 9_200,
    emissionAprPct: 8.4,
    vAprPct: 12.6,
  }),
  buildMockVotePool({
    pair: MOCK_SPOT_PAIRS[2], // WETH/GIWA
    voteShare: 18.76,
    voteWeightTpoint: 607_900,
    incentivesUsd: 5_400,
    emissionAprPct: 42.1,
    vAprPct: 55.7,
  }),
  buildMockVotePool({
    pair: MOCK_SPOT_PAIRS[3], // TER/WETH
    voteShare: 11.92,
    voteWeightTpoint: 386_200,
    incentivesUsd: 3_100,
    emissionAprPct: 18.9,
    vAprPct: 22.4,
  }),
  buildMockVotePool({
    pair: MOCK_SPOT_PAIRS[4], // USDC/DAI
    voteShare: 6.72,
    voteWeightTpoint: 217_800,
    incentivesUsd: 1_250,
    emissionAprPct: 6.1,
    vAprPct: 7.8,
  }),
];

function buildMockEpoch(): EpochInfo {
  // Epoch boundary: current epoch ends 4 days from "now". Voting window is the
  // last 24h of the epoch (open for the preview so the user can interact).
  const now = Date.now();
  const endsInSeconds = 4 * 24 * 60 * 60 - 6 * 60 * 60; // ~3.75 days
  const endsAtMs = now + endsInSeconds * 1_000;
  const startsAtMs = endsAtMs - 7 * 24 * 60 * 60 * 1_000;
  const votingWindowStartMs = endsAtMs - 24 * 60 * 60 * 1_000;
  const totalIncentivesUsd = MOCK_VOTE_POOLS.reduce(
    (acc, p) => acc + Number(p.incentives),
    0,
  );
  const totalFeesUsd = MOCK_VOTE_POOLS.reduce(
    (acc, p) => acc + Number(p.fees7d),
    0,
  );
  return {
    epochNumber: 42,
    startsAt: new Date(startsAtMs).toISOString(),
    endsAt: new Date(endsAtMs).toISOString(),
    endsInSeconds,
    endsInDays: Math.floor(endsInSeconds / 86_400),
    votingWindowStart: new Date(votingWindowStartMs).toISOString(),
    votingWindowEnd: new Date(endsAtMs).toISOString(),
    isVotingOpen: true,
    totalVotingPower: MOCK_VOTE_POOLS.reduce(
      (acc, p) => acc + Number(p.voteWeight),
      0,
    ).toFixed(2),
    totalFees: totalFeesUsd.toFixed(2),
    totalIncentives: totalIncentivesUsd.toFixed(2),
    totalRewards: (totalFeesUsd + totalIncentivesUsd).toFixed(2),
  };
}

// ----------------------------------------------------------------------------
// Portfolio / Lock / Stake fixtures
//
// Same mock data is returned for any wallet address — the preview is not
// per-wallet. The numbers below tell a coherent story: the user has two LP
// positions, two tPOINT locks (one auto-max, one short), a couple of votes
// for the current epoch, and a mix of pending / claimable point earnings.
// ----------------------------------------------------------------------------

const NOW_ISO = new Date().toISOString();
const ONE_DAY_MS = 86_400_000;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * ONE_DAY_MS).toISOString();
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * ONE_DAY_MS).toISOString();
}

const MOCK_LIQUIDITY_POSITIONS: LiquidityPosition[] = [
  {
    id: "mock-lp-1",
    poolAddress: MOCK_POOL_ADDR.wethCbbtc,
    token0: { address: MOCK_TOKEN_ADDR.WETH, symbol: "WETH", decimals: 18 },
    token1: { address: MOCK_TOKEN_ADDR.cbBTC, symbol: "cbBTC", decimals: 8 },
    strategy: "Concentrated",
    volatility: "Volatile",
    volatilityValue: 60,
    poolType: "CL",
    tickSpacing: 60,
    priceRange: {
      min: "20.50",
      max: "23.10",
      currentPrice: "21.10",
      inRange: true,
    },
    feePercent: "0.03",
    deposited: {
      token0Amount: "1.5",
      token1Amount: "0.0712",
      usdValue: "9605.50",
    },
    poolInventory: {
      token0Amount: "1000",
      token1Amount: "70",
      token0Symbol: "WETH",
      token1Symbol: "cbBTC",
    },
    stake: {
      status: "working",
      apr: "42.18",
      isStaked: true,
      token0Amount: "1.5",
      token1Amount: "0.0712",
      usdValue: "9605.50",
    },
    rewards: {
      terPoint: "128.45",
      swapFees: {
        token0Amount: "0.012",
        token1Amount: "0.00045",
        usdValue: "68.92",
      },
    },
    lpTokenBalance: "0",
    poolShare: "0.0285",
    tokenId: "8842",
    createdAt: isoDaysAgo(12),
    updatedAt: isoDaysAgo(0),
  },
  {
    id: "mock-lp-2",
    poolAddress: MOCK_POOL_ADDR.usdcUsdt,
    token0: { address: MOCK_TOKEN_ADDR.USDC, symbol: "USDC", decimals: 6 },
    token1: { address: MOCK_TOKEN_ADDR.USDT, symbol: "USDT", decimals: 6 },
    strategy: "Basic",
    volatility: "Stable",
    volatilityValue: 5,
    poolType: "BASIC",
    tickSpacing: null,
    priceRange: null,
    feePercent: "0.05",
    deposited: {
      token0Amount: "5000",
      token1Amount: "5000",
      usdValue: "10000.00",
    },
    poolInventory: {
      token0Amount: "1000000",
      token1Amount: "1000000",
      token0Symbol: "USDC",
      token1Symbol: "USDT",
    },
    stake: {
      status: "ready",
      apr: "12.60",
      isStaked: false,
      token0Amount: "0",
      token1Amount: "0",
      usdValue: "0.00",
    },
    rewards: {
      terPoint: "0",
      swapFees: {
        token0Amount: "1.85",
        token1Amount: "1.92",
        usdValue: "3.77",
      },
    },
    lpTokenBalance: "9998.42",
    poolShare: "0.0080",
    tokenId: null,
    createdAt: isoDaysAgo(4),
    updatedAt: isoDaysAgo(0),
  },
];

const MOCK_TPOINT_LOCKS: TPointLockPosition[] = [
  {
    id: 1001,
    userAddress: "0x000000000000000000000000000000000000beef",
    amount: "5000",
    lockedSymbol: "tPOINT",
    votingPower: "5000.00",
    lockDays: 730,
    lockStart: isoDaysAgo(45),
    lockEnd: isoDaysFromNow(685),
    isActive: true,
    autoMax: true,
    createdAt: isoDaysAgo(45),
  },
  {
    id: 1002,
    userAddress: "0x000000000000000000000000000000000000beef",
    amount: "1500",
    lockedSymbol: "tPOINT",
    votingPower: "615.07",
    lockDays: 90,
    lockStart: isoDaysAgo(60),
    lockEnd: isoDaysFromNow(30),
    isActive: true,
    autoMax: false,
    createdAt: isoDaysAgo(60),
  },
];

const MOCK_LOCK_POSITIONS: LockPosition[] = [
  {
    id: "mock-velock-1",
    tokenId: "412",
    lockedAmount: "5000",
    lockedSymbol: "tPOINT",
    votingPower: "5000.00",
    lockDuration: {
      weeks: 104,
      startDate: isoDaysAgo(45),
      endDate: isoDaysFromNow(685),
    },
    isExpired: false,
    canWithdraw: false,
    rewards: { claimable: "12.84", claimed: "0" },
    createdAt: isoDaysAgo(45),
  },
];

const MOCK_VOTE_POSITIONS: VotePosition[] = [
  {
    id: "mock-vote-1",
    lockTokenId: "1001",
    poolAddress: MOCK_POOL_ADDR.wethCbbtc,
    poolName: "WETH/cbBTC",
    token0: { address: MOCK_TOKEN_ADDR.WETH, symbol: "WETH", decimals: 18 },
    token1: { address: MOCK_TOKEN_ADDR.cbBTC, symbol: "cbBTC", decimals: 8 },
    strategy: "Concentrated",
    volatility: "Volatile",
    volatilityValue: 60,
    poolType: "CL",
    tickSpacing: 60,
    estimatedApr: "24.80",
    lockedAmount: "5000",
    lockedSymbol: "tPOINT",
    votingPower: "3500.00",
    percentage: "70.00",
    epoch: 42,
    estimatedRewards: {
      swapFee: {
        token0: { symbol: "WETH", amount: "0.018", usdValue: "57.60" },
        token1: { symbol: "cbBTC", amount: "0.00018", usdValue: "12.15" },
        usdValue: "69.75",
      },
      incentive: {
        tokens: [
          { symbol: "GIWA", amount: "120", usdValue: "50.40" },
        ],
        usdValue: "50.40",
      },
      totalUsd: "120.15",
    },
    votedAt: isoDaysAgo(2),
  },
  {
    id: "mock-vote-2",
    lockTokenId: "1001",
    poolAddress: MOCK_POOL_ADDR.usdcUsdt,
    poolName: "USDC/USDT",
    token0: { address: MOCK_TOKEN_ADDR.USDC, symbol: "USDC", decimals: 6 },
    token1: { address: MOCK_TOKEN_ADDR.USDT, symbol: "USDT", decimals: 6 },
    strategy: "Basic",
    volatility: "Stable",
    volatilityValue: 5,
    poolType: "BASIC",
    tickSpacing: null,
    estimatedApr: "8.40",
    lockedAmount: "5000",
    lockedSymbol: "tPOINT",
    votingPower: "1500.00",
    percentage: "30.00",
    epoch: 42,
    estimatedRewards: {
      swapFee: {
        token0: { symbol: "USDC", amount: "4.50", usdValue: "4.50" },
        token1: { symbol: "USDT", amount: "4.50", usdValue: "4.50" },
        usdValue: "9.00",
      },
      incentive: { tokens: [], usdValue: "0.00" },
      totalUsd: "9.00",
    },
    votedAt: isoDaysAgo(2),
  },
];

const MOCK_POINT_EARNINGS: PointEarning[] = [
  {
    id: "earn-1",
    type: "LP",
    category: "LIQUIDITY_STAKING",
    typeLabel: "LP Reward",
    eventType: null,
    amount: "128.45",
    status: "READY_TO_CLAIM",
    earnedAt: isoDaysAgo(1),
    claimedAt: null,
    claimTxHash: null,
    sourcePoolAddress: MOCK_POOL_ADDR.wethCbbtc,
    sourcePoolName: "WETH/cbBTC",
  },
  {
    id: "earn-2",
    type: "TRADING",
    category: "SWAP",
    typeLabel: "Trading Reward",
    eventType: null,
    amount: "12.30",
    status: "READY_TO_CLAIM",
    earnedAt: isoDaysAgo(2),
    claimedAt: null,
    claimTxHash: null,
  },
  {
    id: "earn-3",
    type: "REFERRAL",
    category: "EVENT",
    typeLabel: "Referral Bonus",
    eventType: "referral_signup",
    amount: "50.00",
    status: "CLAIMED",
    earnedAt: isoDaysAgo(10),
    claimedAt: isoDaysAgo(10),
    claimTxHash:
      "0x1111111111111111111111111111111111111111111111111111111111111111",
  },
  {
    id: "earn-4",
    type: "EMISSION",
    category: "LIQUIDITY_STAKING",
    typeLabel: "Emission",
    eventType: null,
    amount: "84.10",
    status: "PENDING",
    earnedAt: isoDaysAgo(0),
    claimedAt: null,
    claimTxHash: null,
    sourcePoolAddress: MOCK_POOL_ADDR.wethCbbtc,
    sourcePoolName: "WETH/cbBTC",
  },
];

const MOCK_TRANSACTIONS: PortfolioTransaction[] = [
  {
    id: "tx-1",
    txHash:
      "0x2222222222222222222222222222222222222222222222222222222222222222",
    type: "SWAP",
    timestamp: isoDaysAgo(0),
    usdValue: "320.00",
    tokens: [
      { symbol: "WETH", amount: "0.1", direction: "out" },
      { symbol: "USDC", amount: "320", direction: "in" },
    ],
    status: "confirmed",
    blockNumber: 18_500_000,
  },
  {
    id: "tx-2",
    txHash:
      "0x3333333333333333333333333333333333333333333333333333333333333333",
    type: "ADD_LIQUIDITY",
    timestamp: isoDaysAgo(4),
    usdValue: "10000.00",
    tokens: [
      { symbol: "USDC", amount: "5000", direction: "out" },
      { symbol: "USDT", amount: "5000", direction: "out" },
    ],
    poolAddress: MOCK_POOL_ADDR.usdcUsdt,
    poolName: "USDC/USDT",
    lpTokensReceived: "9998.42",
    status: "confirmed",
    blockNumber: 18_488_000,
  },
  {
    id: "tx-3",
    txHash:
      "0x4444444444444444444444444444444444444444444444444444444444444444",
    type: "LOCK",
    timestamp: isoDaysAgo(45),
    usdValue: null,
    tokens: [{ symbol: "tPOINT", amount: "5000", direction: "out" }],
    lockDuration: { weeks: 104 },
    votingPowerReceived: "5000",
    status: "confirmed",
    blockNumber: 18_300_000,
  },
];

const MOCK_LP_STAKE_INTENTS: LpStakeIntent[] = [
  {
    id: 7001,
    walletAddress: "0x000000000000000000000000000000000000beef",
    poolAddress: MOCK_POOL_ADDR.wethCbbtc,
    tokenId: "8842",
    stakedAmount: "1500000000000000000", // 1.5 WETH-equivalent liquidity
    isActive: true,
    createdAt: isoDaysAgo(12),
    updatedAt: isoDaysAgo(0),
  },
];

const MOCK_VOTE_INCENTIVES: VoteIncentive[] = [
  {
    id: 9001,
    walletAddress: "0x000000000000000000000000000000000000cafe",
    poolAddress: MOCK_POOL_ADDR.wethGiwa,
    tokenAddress: MOCK_TOKEN_ADDR.GIWA,
    tokenSymbol: "GIWA",
    tokenDecimals: 18,
    amount: "5000000000000000000000",
    amountUsd: "2100.00",
    epoch: 42,
    createdAt: isoDaysAgo(1),
  },
  {
    id: 9002,
    walletAddress: "0x000000000000000000000000000000000000cafe",
    poolAddress: MOCK_POOL_ADDR.wethCbbtc,
    tokenAddress: MOCK_TOKEN_ADDR.USDC,
    tokenSymbol: "USDC",
    tokenDecimals: 6,
    amount: "10000000000",
    amountUsd: "10000.00",
    epoch: 42,
    createdAt: isoDaysAgo(2),
  },
];

// ----------------------------------------------------------------------------
// Swap route builder
//
// Given (from, to, amountInWei) return a one-hop route through whichever mock
// pool contains both tokens, or a two-hop through WETH otherwise. The numbers
// are deliberately crude — UX preview, not a quoting engine.
// ----------------------------------------------------------------------------

function findMockPoolFor(a: string, b: string): SpotPairRecordDto | undefined {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  return MOCK_SPOT_PAIRS.find((p) => {
    const t0 = p.token0.toLowerCase();
    const t1 = p.token1.toLowerCase();
    return (t0 === la && t1 === lb) || (t0 === lb && t1 === la);
  });
}

function findMockTokenByAddress(addr: string): SpotTokenRecordDto | undefined {
  const la = addr.toLowerCase();
  return MOCK_SPOT_TOKENS.find((t) => t.id.toLowerCase() === la);
}

function buildHop(opts: {
  pair: SpotPairRecordDto;
  tokenIn: string;
  tokenOut: string;
  amountInWei?: string;
}): SwapRouteHopDto {
  const feeBps = Math.max(1, Math.round(opts.pair.effectiveFeeBps ?? 30));
  let feeOnInputWei: string | null = null;
  if (opts.amountInWei) {
    try {
      const amt = BigInt(opts.amountInWei);
      feeOnInputWei = ((amt * BigInt(feeBps)) / 10_000n).toString();
    } catch {
      feeOnInputWei = null;
    }
  }
  const tokenInRow = findMockTokenByAddress(opts.tokenIn);
  const tokenOutRow = findMockTokenByAddress(opts.tokenOut);
  return {
    pairAddress: opts.pair.id,
    tokenIn: opts.tokenIn,
    inputTokenLogo: tokenInRow?.logoURI ?? null,
    tokenOut: opts.tokenOut,
    outputTokenLogo: tokenOutRow?.logoURI ?? null,
    effectiveFeeBps: opts.pair.effectiveFeeBps ?? null,
    feeBps,
    feeSource: opts.pair.feeSource ?? "",
    poolKind: opts.pair.isConcentratedLiquidity
      ? "cl"
      : opts.pair.type === "stable"
        ? "stable"
        : "volatile",
    tickSpacing: opts.pair.isConcentratedLiquidity ? 60 : 0,
    priceImpactPercent: 0.12,
    feeOnInputWei,
  };
}

function buildMockSwapRoute(args: {
  from: string;
  to: string;
  amountInWei?: string;
  withTx?: boolean;
}): SwapRouteResponseDto {
  const fromTokenRow = findMockTokenByAddress(args.from);
  const toTokenRow = findMockTokenByAddress(args.to);

  let hops: SwapRouteHopDto[] = [];
  const direct = findMockPoolFor(args.from, args.to);
  if (direct) {
    hops = [
      buildHop({
        pair: direct,
        tokenIn: args.from,
        tokenOut: args.to,
        amountInWei: args.amountInWei,
      }),
    ];
  } else {
    const viaWeth = MOCK_TOKEN_ADDR.WETH;
    const hop1 = findMockPoolFor(args.from, viaWeth);
    const hop2 = findMockPoolFor(viaWeth, args.to);
    if (hop1 && hop2) {
      hops = [
        buildHop({
          pair: hop1,
          tokenIn: args.from,
          tokenOut: viaWeth,
          amountInWei: args.amountInWei,
        }),
        buildHop({ pair: hop2, tokenIn: viaWeth, tokenOut: args.to }),
      ];
    }
  }

  // Crude amountOut estimate based on token USD prices.
  let amountOutWei: string | undefined;
  let exchangeRate: number | null = null;
  if (
    args.amountInWei &&
    fromTokenRow &&
    toTokenRow &&
    fromTokenRow.priceUSD > 0 &&
    toTokenRow.priceUSD > 0
  ) {
    const inDec = fromTokenRow.decimals;
    const outDec = toTokenRow.decimals;
    const amtIn = Number(args.amountInWei) / 10 ** inDec;
    const amtOut = (amtIn * fromTokenRow.priceUSD * 0.997) / toTokenRow.priceUSD;
    amountOutWei = BigInt(Math.floor(amtOut * 10 ** outDec)).toString();
    exchangeRate = fromTokenRow.priceUSD / toTokenRow.priceUSD;
  }

  const avgFeeBps =
    hops.length > 0
      ? hops.reduce((acc, h) => acc + h.feeBps, 0) / hops.length
      : null;

  return {
    fromToken: args.from,
    toToken: args.to,
    fromTokenIconUrl: fromTokenRow?.logoURI ?? null,
    toTokenIconUrl: toTokenRow?.logoURI ?? null,
    amountInWei: args.amountInWei,
    amountOutWei,
    exchangeRate,
    totalFeeUsd: args.amountInWei && fromTokenRow ? 0.5 : null,
    averageFeeBps: avgFeeBps,
    routePriceImpactPercent: hops.length > 0 ? 0.12 * hops.length : null,
    hops,
    ...(args.withTx
      ? {
          tx: {
            to: "0x000000000000000000000000000000000000700f",
            data: "0xdeadbeef",
            valueWei: "0",
            method: "swapExactTokensForTokens",
          },
        }
      : {}),
  };
}

// ============================================================================
// Handlers
// ============================================================================

const handlers: MockHandler[] = [
  // --------------------------------------------------------------------------
  // gatewayBrokerApi (base: `/api/gateway`)
  // --------------------------------------------------------------------------

  {
    method: "GET",
    path: "/contracts",
    description: "gatewayBrokerApi.getContractAddresses (/contracts)",
    respond: (): GetProtocolContractsResponseDto => ({
      contracts: CONTRACT_ADDRESSES,
    }),
  },

  {
    method: "GET",
    path: "/spot-pairs/recently-created",
    description: "gatewayBrokerApi.listSpotPairsRecentlyCreated",
    respond: ({ query }): SpotPairLeaderboardPageDto => {
      const offset = Number(query.get("offset") ?? 0);
      const limit = Number(query.get("limit") ?? 200);
      const items = MOCK_SPOT_PAIRS.slice(offset, offset + limit);
      return {
        offset,
        limit,
        total: MOCK_SPOT_PAIRS.length,
        items,
      };
    },
  },

  {
    method: "GET",
    path: "/spot-tokens/recently-created",
    description: "gatewayBrokerApi.listSpotTokensRecentlyCreated",
    respond: ({ query }): SpotTokenLeaderboardPageDto => {
      const offset = Number(query.get("offset") ?? 0);
      const limit = Number(query.get("limit") ?? 200);
      const items = MOCK_SPOT_TOKENS.slice(offset, offset + limit);
      return {
        offset,
        limit,
        total: MOCK_SPOT_TOKENS.length,
        items,
      };
    },
  },

  // Admin variants — same upstream rows, same shape.
  {
    method: "GET",
    path: "/spot-pairs/recently-created",
    description: "gatewayBrokerApi.listSpotPairsRecentlyCreatedAdmin (broker-admin)",
    respond: ({ query }): SpotPairLeaderboardPageDto => {
      const offset = Number(query.get("offset") ?? 0);
      const limit = Number(query.get("limit") ?? 200);
      return {
        offset,
        limit,
        total: MOCK_SPOT_PAIRS.length,
        items: MOCK_SPOT_PAIRS.slice(offset, offset + limit),
      };
    },
  },

  // --------------------------------------------------------------------------
  // indexerApi (base: `/api/indexer`, legacy NestJS)
  // --------------------------------------------------------------------------

  {
    method: "GET",
    path: "/vote/epoch/current",
    description: "indexerApi.getVoteEpoch",
    respond: (): EpochInfo => buildMockEpoch(),
  },

  {
    method: "GET",
    path: "/vote/pools",
    description: "indexerApi.getVotePools",
    respond: ({ query }): VotePoolsResponse => {
      const limit = Number(query.get("limit") ?? MOCK_VOTE_POOLS.length);
      const offset = Number(query.get("offset") ?? 0);
      const search = (query.get("search") ?? "").trim().toLowerCase();
      const sortBy = query.get("sortBy") as
        | "rewards"
        | "votes"
        | "fees"
        | "tvl"
        | null;

      let rows = MOCK_VOTE_POOLS.slice();
      if (search) {
        rows = rows.filter((p) => {
          const pair = `${p.token0.symbol}/${p.token1.symbol}`.toLowerCase();
          return (
            pair.includes(search) ||
            p.poolAddress.toLowerCase().includes(search) ||
            p.token0.symbol.toLowerCase().includes(search) ||
            p.token1.symbol.toLowerCase().includes(search)
          );
        });
      }
      if (sortBy) {
        const keyOf = (p: VotePoolInfo) => {
          switch (sortBy) {
            case "votes":
              return Number(p.voteWeight);
            case "fees":
              return Number(p.fees7d);
            case "tvl":
              return Number(p.tvl);
            case "rewards":
            default:
              return Number(p.totalRewards);
          }
        };
        rows.sort((a, b) => keyOf(b) - keyOf(a));
      }

      const total = rows.length;
      const items = rows.slice(offset, offset + limit);
      return {
        pools: items,
        pagination: { total, limit, offset },
      };
    },
  },

  // --------------------------------------------------------------------------
  // Swap — gateway broker parity routes
  // --------------------------------------------------------------------------

  {
    method: "GET",
    path: "/swap-routes",
    description: "gatewayBrokerApi.getSwapRoute / getSwapRouteTx",
    respond: ({ query }): SwapRouteResponseDto => {
      const from = (query.get("from") ?? MOCK_TOKEN_ADDR.WETH) as string;
      const to = (query.get("to") ?? MOCK_TOKEN_ADDR.USDC) as string;
      const amountIn = query.get("amountIn") ?? undefined;
      const withTx = query.get("buildCalldata") === "true";
      return buildMockSwapRoute({
        from,
        to,
        amountInWei: amountIn,
        withTx,
      });
    },
  },

  // --------------------------------------------------------------------------
  // Spot tokens / pairs — by symbol / address (used by token search modal + pool detail)
  // --------------------------------------------------------------------------

  {
    method: "GET",
    path: /^\/spot-tokens\/by-symbol\/([^/]+)$/,
    description: "gatewayBrokerApi.getSpotTokensBySymbol / searchTokens(symbol)",
    respond: ({ pathParams }): SpotTokensBySymbolResponseDto => {
      const sym = decodeURIComponent(pathParams[0] ?? "").toLowerCase();
      const items = MOCK_SPOT_TOKENS.filter((t) =>
        t.symbol.toLowerCase().includes(sym),
      );
      return { items };
    },
  },

  {
    method: "GET",
    path: /^\/spot-tokens\/by-address\/(0x[a-fA-F0-9]{40})$/,
    description: "gatewayBrokerApi.searchTokens(address)",
    respond: ({ pathParams }): SpotTokenRecordDto => {
      const addr = pathParams[0]?.toLowerCase() ?? "";
      const row = MOCK_SPOT_TOKENS.find((t) => t.id.toLowerCase() === addr);
      if (!row) {
        // fallback: synthesize a placeholder so the modal still renders
        return buildMockSpotToken({
          address: pathParams[0] ?? "",
          symbol: "UNKN",
          name: "Unknown",
          decimals: 18,
        });
      }
      return row;
    },
  },

  {
    method: "GET",
    path: /^\/spot-pairs\/by-address\/(0x[a-fA-F0-9]{40})$/,
    description: "gatewayBrokerApi.getSpotPairByAddress",
    respond: ({ pathParams }): SpotPairRecordDto => {
      const addr = pathParams[0]?.toLowerCase() ?? "";
      const row = MOCK_SPOT_PAIRS.find((p) => p.id.toLowerCase() === addr);
      // Default to first mock pair when address is unknown so the detail view
      // still has something to render in preview mode.
      return row ?? MOCK_SPOT_PAIRS[0];
    },
  },

  // --------------------------------------------------------------------------
  // Public chrome / points
  // --------------------------------------------------------------------------

  {
    method: "GET",
    path: /^\/banners\/([^/]+)$/,
    description: "bannerApi.getActiveBanners",
    respond: (): ActiveBanner[] => [],
  },

  {
    method: "POST",
    path: /^\/banners\/(\d+)\/impression$/,
    description: "bannerApi.recordImpression",
    respond: (): void => undefined,
  },

  {
    method: "POST",
    path: /^\/banners\/(\d+)\/click$/,
    description: "bannerApi.recordClick",
    respond: (): void => undefined,
  },

  {
    method: "GET",
    path: /^\/point\/balance\/(0x[a-fA-F0-9]{40})$/,
    description: "points.getBalance",
    respond: (): { totalPoints: string } => ({
      totalPoints: "128450",
    }),
  },

  {
    method: "GET",
    path: /^\/point\/faucet\/(0x[a-fA-F0-9]{40})\/status$/,
    description: "points.getFaucetStatus",
    respond: (): { canClaim: boolean; nextClaimAt: string | null } => ({
      canClaim: true,
      nextClaimAt: null,
    }),
  },

  {
    method: "POST",
    path: /^\/point\/faucet\/(0x[a-fA-F0-9]{40})$/,
    description: "points.claimFaucet",
    respond: (): { success: boolean; amount: string; totalPoints: string } => ({
      success: true,
      amount: "1000",
      totalPoints: "129450",
    }),
  },

  {
    method: "GET",
    path: "/tokens/prices",
    description: "indexerApi.getTokenPrices",
    respond: (): {
      tokens: { address: string; symbol: string; priceUSD: string; updatedAt: string }[];
    } => ({
      tokens: MOCK_SPOT_TOKENS.map((token) => ({
        address: token.id,
        symbol: token.symbol,
        priceUSD: String(token.priceUSD || 1),
        updatedAt: NOW_ISO,
      })),
    }),
  },

  // --------------------------------------------------------------------------
  // Referral (gateway)
  // --------------------------------------------------------------------------

  {
    method: "GET",
    path: /^\/referral\/code\/(0x[a-fA-F0-9]{40})$/,
    description: "referralApi.getCode",
    respond: ({ pathParams }): ReferralCodeResponse => ({
      address: pathParams[0] ?? "",
      code: "GIWA-MOCK",
    }),
  },

  {
    method: "POST",
    path: "/referral/claim",
    description: "referralApi.claim",
    respond: (): ReferralClaimResponse => ({
      success: true,
      alreadyClaimed: false,
      referrerAddress: "0x000000000000000000000000000000000000dead",
    }),
  },

  // --------------------------------------------------------------------------
  // Portfolio (legacy indexer base — see project_apps_api_deprecated memo)
  // --------------------------------------------------------------------------

  {
    method: "GET",
    path: /^\/portfolio\/(0x[a-fA-F0-9]{40})\/overview$/,
    description: "portfolioApi.getOverview",
    respond: (): PortfolioOverview => ({
      assetsByPool: {
        activePools: MOCK_LIQUIDITY_POSITIONS.length,
        totalDepositUsd: "19605.50",
        avgNetApr: "27.39",
      },
      pendingRewards: {
        totalUnclaimedUsd: "245.32",
        fee: {
          totalUsd: "72.69",
          breakdown: [
            {
              poolAddress: MOCK_POOL_ADDR.wethCbbtc,
              token0Amount: "0.012",
              token0Symbol: "WETH",
              token1Amount: "0.00045",
              token1Symbol: "cbBTC",
              usdValue: "68.92",
            },
            {
              poolAddress: MOCK_POOL_ADDR.usdcUsdt,
              token0Amount: "1.85",
              token0Symbol: "USDC",
              token1Amount: "1.92",
              token1Symbol: "USDT",
              usdValue: "3.77",
            },
          ],
        },
        terPoint: {
          amount: "128.45",
          totalEarned: "212.55",
          totalClaimed: "84.10",
          onChainBalance: "20000.00",
          usdValue: "151.57",
        },
        vote: { amount: "120.15", symbol: "USD" },
      },
      updatedAt: NOW_ISO,
    }),
  },

  {
    method: "GET",
    path: /^\/portfolio\/(0x[a-fA-F0-9]{40})\/positions\/liquidity$/,
    description: "portfolioApi.getLiquidityPositions",
    respond: ({ query }): LiquidityPositionsResponse => {
      const limit = Number(query.get("limit") ?? 50);
      const offset = Number(query.get("offset") ?? 0);
      const positions = MOCK_LIQUIDITY_POSITIONS.slice(offset, offset + limit);
      return {
        positions,
        pagination: {
          total: MOCK_LIQUIDITY_POSITIONS.length,
          limit,
          offset,
        },
      };
    },
  },

  {
    method: "GET",
    path: /^\/portfolio\/(0x[a-fA-F0-9]{40})\/positions\/locks$/,
    description: "portfolioApi.getLockPositions",
    respond: ({ query }): LockPositionsResponse => {
      const limit = Number(query.get("limit") ?? 50);
      const offset = Number(query.get("offset") ?? 0);
      const totalLocked = MOCK_LOCK_POSITIONS.reduce(
        (acc, p) => acc + Number(p.lockedAmount),
        0,
      );
      const totalVoting = MOCK_LOCK_POSITIONS.reduce(
        (acc, p) => acc + Number(p.votingPower),
        0,
      );
      return {
        positions: MOCK_LOCK_POSITIONS.slice(offset, offset + limit),
        summary: {
          totalLocked: totalLocked.toFixed(2),
          totalVotingPower: totalVoting.toFixed(2),
          totalLocks: MOCK_LOCK_POSITIONS.length,
        },
        pagination: { total: MOCK_LOCK_POSITIONS.length, limit, offset },
      };
    },
  },

  {
    method: "GET",
    path: /^\/portfolio\/(0x[a-fA-F0-9]{40})\/positions\/votes$/,
    description: "portfolioApi.getVotePositions",
    respond: ({ query }): VotePositionsResponse => {
      const limit = Number(query.get("limit") ?? 50);
      const offset = Number(query.get("offset") ?? 0);
      const usedVoting = MOCK_VOTE_POSITIONS.reduce(
        (acc, v) => acc + Number(v.votingPower),
        0,
      );
      const totalVoting = MOCK_TPOINT_LOCKS.reduce(
        (acc, l) => acc + Number(l.votingPower),
        0,
      );
      return {
        positions: MOCK_VOTE_POSITIONS.slice(offset, offset + limit),
        summary: {
          totalVotingPower: totalVoting.toFixed(2),
          usedVotingPower: usedVoting.toFixed(2),
          availableVotingPower: (totalVoting - usedVoting).toFixed(2),
          currentEpoch: 42,
          epochEndsAt: isoDaysFromNow(4),
        },
        pagination: { total: MOCK_VOTE_POSITIONS.length, limit, offset },
      };
    },
  },

  {
    method: "GET",
    path: /^\/portfolio\/(0x[a-fA-F0-9]{40})\/positions\/points$/,
    description: "portfolioApi.getPointPositions",
    respond: ({ query }): PointPositionsResponse => {
      const limit = Number(query.get("limit") ?? 50);
      const offset = Number(query.get("offset") ?? 0);
      const category = query.get("category") ?? undefined;
      const rows = category
        ? MOCK_POINT_EARNINGS.filter((e) => e.category === category)
        : MOCK_POINT_EARNINGS;
      const totalPoints = rows.reduce((acc, e) => acc + Number(e.amount), 0);
      const claimablePoints = rows
        .filter((e) => e.status === "READY_TO_CLAIM")
        .reduce((acc, e) => acc + Number(e.amount), 0);
      const claimedPoints = rows
        .filter((e) => e.status === "CLAIMED")
        .reduce((acc, e) => acc + Number(e.amount), 0);
      const pendingCount = rows.filter((e) => e.status === "PENDING").length;
      const readyCount = rows.filter((e) => e.status === "READY_TO_CLAIM").length;
      const totalLocked = MOCK_TPOINT_LOCKS.reduce(
        (acc, l) => acc + Number(l.amount),
        0,
      );
      // Preview: pretend the user already holds 16,500 tPOINT on-chain so
      // after subtracting the locked 6,500, the visible balance is ~10,000.
      const onChainBalance = 16_500;
      return {
        summary: {
          totalPoints: totalPoints.toFixed(2),
          claimablePoints: claimablePoints.toFixed(2),
          claimedPoints: claimedPoints.toFixed(2),
          onChainBalance: onChainBalance.toFixed(2),
          lockedPoints: totalLocked.toFixed(2),
          availablePoints: Math.max(0, onChainBalance - totalLocked).toFixed(2),
          vePoints: MOCK_TPOINT_LOCKS.reduce(
            (acc, l) => acc + Number(l.votingPower),
            0,
          ).toFixed(2),
          lockCount: pendingCount + readyCount,
          pendingCount,
          readyToClaimCount: readyCount,
        },
        earnings: rows.slice(offset, offset + limit),
        pagination: { total: rows.length, limit, offset },
      };
    },
  },

  {
    method: "POST",
    path: /^\/portfolio\/(0x[a-fA-F0-9]{40})\/positions\/points\/([^/]+)\/claim$/,
    description: "portfolioApi.claimPointEarning",
    respond: (): ClaimPointEarningResponse => ({
      txHash:
        "0x5555555555555555555555555555555555555555555555555555555555555555",
    }),
  },

  {
    method: "GET",
    path: /^\/portfolio\/(0x[a-fA-F0-9]{40})\/transactions$/,
    description: "portfolioApi.getTransactions",
    respond: ({ query }): TransactionsResponse => {
      const limit = Number(query.get("limit") ?? 50);
      const offset = Number(query.get("offset") ?? 0);
      const type = query.get("type") ?? null;
      const rows = type
        ? MOCK_TRANSACTIONS.filter((t) => t.type === type)
        : MOCK_TRANSACTIONS;
      const total = rows.length;
      return {
        transactions: rows.slice(offset, offset + limit),
        pagination: {
          total,
          limit,
          offset,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    },
  },

  {
    method: "GET",
    path: /^\/portfolio\/(0x[a-fA-F0-9]{40})\/claimable-rewards$/,
    description: "portfolioApi.getClaimableRewards",
    respond: (): ClaimableRewardsResponse => ({
      bribes: [
        {
          poolAddress: MOCK_POOL_ADDR.wethCbbtc,
          poolName: "WETH/cbBTC",
          tokenAddress: MOCK_TOKEN_ADDR.GIWA,
          tokenSymbol: "GIWA",
          amount: "120",
          amountUsd: "50.40",
        },
      ],
      fees: [
        {
          poolAddress: MOCK_POOL_ADDR.wethCbbtc,
          poolName: "WETH/cbBTC",
          tokenAddress: MOCK_TOKEN_ADDR.WETH,
          tokenSymbol: "WETH",
          amount: "0.012",
          amountUsd: "38.40",
        },
        {
          poolAddress: MOCK_POOL_ADDR.wethCbbtc,
          poolName: "WETH/cbBTC",
          tokenAddress: MOCK_TOKEN_ADDR.cbBTC,
          tokenSymbol: "cbBTC",
          amount: "0.00045",
          amountUsd: "30.37",
        },
      ],
      rebase: { amount: "12.84", amountUsd: "5.40" },
      totalUsd: "124.57",
    }),
  },

  {
    method: "POST",
    path: /^\/portfolio\/(0x[a-fA-F0-9]{40})\/claim$/,
    description: "portfolioApi.claimRewards",
    respond: (): ClaimResponse => ({
      transactions: [
        {
          to: "0x000000000000000000000000000000000000c1a1",
          data: "0xfeedface",
          value: "0",
          description: "Claim mock rewards",
        },
      ],
      estimatedGas: "180000",
      rewards: {
        fees: {
          totalUsd: "68.77",
          tokens: [
            { symbol: "WETH", amount: "0.012" },
            { symbol: "cbBTC", amount: "0.00045" },
          ],
        },
        bribes: {
          totalUsd: "50.40",
          tokens: [{ symbol: "GIWA", amount: "120" }],
        },
        rebase: { amount: "12.84", amountUsd: "5.40" },
      },
      claimId: 1,
      contractEnabled: false,
    }),
  },

  {
    method: "POST",
    path: /^\/portfolio\/(0x[a-fA-F0-9]{40})\/claim-points\/position$/,
    description: "portfolioApi.claimPositionPoints",
    respond: (): ClaimPositionPointsResponse => ({
      amount: "128.45",
      claimId: 42,
      onChain: false,
    }),
  },

  {
    method: "POST",
    path: "/portfolio/notify-transaction",
    description: "portfolioApi.notifyTransaction",
    respond: (): { processed: number; skipped: number; errors: number } => ({
      processed: 1,
      skipped: 0,
      errors: 0,
    }),
  },

  // --------------------------------------------------------------------------
  // tPOINT Lock (Pre-TGE off-chain)
  // --------------------------------------------------------------------------

  {
    method: "POST",
    path: "/tpoint-lock/lock",
    description: "portfolioApi.createTPointLock",
    respond: ({ body }): TPointLockPosition => {
      const b = (body ?? {}) as {
        walletAddress?: string;
        amount?: string;
        durationDays?: number;
      };
      const vp =
        Number(b.amount ?? "0") * Math.min(1, (b.durationDays ?? 30) / 730);
      return {
        id: Math.floor(Math.random() * 100_000) + 2000,
        userAddress: b.walletAddress ?? "0x0",
        amount: b.amount ?? "0",
        lockedSymbol: "tPOINT",
        votingPower: vp.toFixed(2),
        lockDays: b.durationDays ?? 30,
        lockStart: NOW_ISO,
        lockEnd: isoDaysFromNow(b.durationDays ?? 30),
        isActive: true,
        autoMax: false,
        createdAt: NOW_ISO,
      };
    },
  },

  {
    method: "GET",
    path: /^\/tpoint-lock\/locks\/(0x[a-fA-F0-9]{40})$/,
    description: "portfolioApi.getTPointLocks",
    respond: (): TPointLocksResponse => {
      const totalLocked = MOCK_TPOINT_LOCKS.reduce(
        (acc, l) => acc + Number(l.amount),
        0,
      );
      const totalVoting = MOCK_TPOINT_LOCKS.reduce(
        (acc, l) => acc + Number(l.votingPower),
        0,
      );
      return {
        locks: MOCK_TPOINT_LOCKS,
        summary: {
          totalLocked: totalLocked.toFixed(2),
          totalVotingPower: totalVoting.toFixed(2),
          totalLocks: MOCK_TPOINT_LOCKS.length,
        },
      };
    },
  },

  {
    method: "GET",
    path: /^\/tpoint-lock\/lock\/(\d+)$/,
    description: "portfolioApi.getTPointLockById",
    respond: ({ pathParams }): TPointLockPosition => {
      const id = Number(pathParams[0]);
      return MOCK_TPOINT_LOCKS.find((l) => l.id === id) ?? MOCK_TPOINT_LOCKS[0];
    },
  },

  {
    method: "POST",
    path: /^\/tpoint-lock\/lock\/(\d+)\/increase$/,
    description: "portfolioApi.increaseTPointLock",
    respond: ({ pathParams, body }): TPointLockPosition => {
      const id = Number(pathParams[0]);
      const base =
        MOCK_TPOINT_LOCKS.find((l) => l.id === id) ?? MOCK_TPOINT_LOCKS[0];
      const inc = Number((body as { amount?: string } | undefined)?.amount ?? 0);
      const newAmt = Number(base.amount) + inc;
      return {
        ...base,
        amount: newAmt.toFixed(2),
        votingPower: (
          newAmt * Math.min(1, base.lockDays / 730)
        ).toFixed(2),
      };
    },
  },

  {
    method: "POST",
    path: /^\/tpoint-lock\/lock\/(\d+)\/extend$/,
    description: "portfolioApi.extendTPointLock",
    respond: ({ pathParams, body }): TPointLockPosition => {
      const id = Number(pathParams[0]);
      const base =
        MOCK_TPOINT_LOCKS.find((l) => l.id === id) ?? MOCK_TPOINT_LOCKS[0];
      const b = body as {
        newDurationDays?: number;
        autoMax?: boolean;
      } | undefined;
      const newDays = b?.newDurationDays ?? base.lockDays;
      return {
        ...base,
        lockDays: newDays,
        lockEnd: isoDaysFromNow(newDays),
        autoMax: b?.autoMax ?? base.autoMax,
        votingPower: (
          Number(base.amount) * Math.min(1, newDays / 730)
        ).toFixed(2),
      };
    },
  },

  {
    method: "POST",
    path: /^\/tpoint-lock\/lock\/(\d+)\/disable-auto-max$/,
    description: "portfolioApi.disableAutoMaxTPointLock",
    respond: ({ pathParams }): TPointLockPosition => {
      const id = Number(pathParams[0]);
      const base =
        MOCK_TPOINT_LOCKS.find((l) => l.id === id) ?? MOCK_TPOINT_LOCKS[0];
      return { ...base, autoMax: false };
    },
  },

  {
    method: "DELETE",
    path: /^\/tpoint-lock\/lock\/(\d+)$/,
    description: "portfolioApi.unlockTPoint",
    respond: (): void => undefined,
  },

  {
    method: "POST",
    path: "/tpoint-lock/merge",
    description: "portfolioApi.mergeTPointLocks",
    respond: ({ body }): TPointLockPosition => {
      const b = body as {
        baseLockId?: number;
        sourceLockIds?: number[];
      } | undefined;
      const base =
        MOCK_TPOINT_LOCKS.find((l) => l.id === b?.baseLockId) ??
        MOCK_TPOINT_LOCKS[0];
      const extras = (b?.sourceLockIds ?? [])
        .map((id) => MOCK_TPOINT_LOCKS.find((l) => l.id === id))
        .filter(Boolean) as TPointLockPosition[];
      const merged =
        Number(base.amount) +
        extras.reduce((acc, l) => acc + Number(l.amount), 0);
      return {
        ...base,
        amount: merged.toFixed(2),
        votingPower: (merged * Math.min(1, base.lockDays / 730)).toFixed(2),
      };
    },
  },

  {
    method: "POST",
    path: /^\/tpoint-lock\/lock\/(\d+)\/poke$/,
    description: "portfolioApi.pokeTPointLock",
    respond: ({ pathParams }): TPointLockPokeResponse => {
      const id = Number(pathParams[0]);
      const base =
        MOCK_TPOINT_LOCKS.find((l) => l.id === id) ?? MOCK_TPOINT_LOCKS[0];
      const prev = Number(base.votingPower);
      const next = prev * 0.97;
      return {
        lock: { ...base, votingPower: next.toFixed(2) },
        previousVotingPower: prev.toFixed(2),
        newVotingPower: next.toFixed(2),
        affectedVotes: MOCK_VOTE_POSITIONS.length,
        currentEpoch: 42,
      };
    },
  },

  {
    method: "GET",
    path: /^\/tpoint-lock\/voting-power\/(0x[a-fA-F0-9]{40})$/,
    description: "portfolioApi.getTPointVotingPower",
    respond: ({ pathParams }): TPointVotingPower => ({
      walletAddress: pathParams[0] ?? "",
      totalVotingPower: MOCK_TPOINT_LOCKS.reduce(
        (acc, l) => acc + Number(l.votingPower),
        0,
      ).toFixed(2),
      activeLocks: MOCK_TPOINT_LOCKS.filter((l) => l.isActive).length,
    }),
  },

  {
    method: "POST",
    path: "/tpoint-lock/vote",
    description: "portfolioApi.tpointVote",
    respond: ({ body }): TPointVotePosition => {
      const b = body as {
        lockId?: number;
        poolAddress?: string;
        percentage?: number;
      } | undefined;
      const lock =
        MOCK_TPOINT_LOCKS.find((l) => l.id === b?.lockId) ?? MOCK_TPOINT_LOCKS[0];
      const pct = b?.percentage ?? 50;
      return {
        id: Math.floor(Math.random() * 100_000) + 5000,
        tpointLockId: lock.id,
        poolAddress: b?.poolAddress ?? MOCK_POOL_ADDR.wethCbbtc,
        votingPower: ((Number(lock.votingPower) * pct) / 100).toFixed(2),
        percentage: pct.toFixed(2),
        epoch: 42,
        votedAt: NOW_ISO,
      };
    },
  },

  {
    method: "GET",
    path: /^\/tpoint-lock\/votes\/(0x[a-fA-F0-9]{40})$/,
    description: "portfolioApi.getTPointVotes",
    respond: (): TPointVotesResponse => {
      const totalVoting = MOCK_TPOINT_LOCKS.reduce(
        (acc, l) => acc + Number(l.votingPower),
        0,
      );
      const usedVoting = MOCK_VOTE_POSITIONS.reduce(
        (acc, v) => acc + Number(v.votingPower),
        0,
      );
      // The DTO is a separate shape from VotePositionsResponse — the tpoint-lock
      // surface only carries lockId / poolAddress / votingPower / pct / epoch.
      const votes: TPointVotePosition[] = MOCK_VOTE_POSITIONS.map((v, i) => ({
        id: i + 1,
        tpointLockId: 1001,
        poolAddress: v.poolAddress,
        votingPower: v.votingPower,
        percentage: v.percentage,
        epoch: v.epoch,
        votedAt: v.votedAt,
      }));
      return {
        votes,
        summary: {
          totalVotingPower: totalVoting.toFixed(2),
          usedVotingPower: usedVoting.toFixed(2),
          currentEpoch: 42,
        },
      };
    },
  },

  {
    method: "POST",
    path: "/tpoint-lock/vote/reset",
    description: "portfolioApi.resetTPointVotes",
    respond: (): void => undefined,
  },

  // --------------------------------------------------------------------------
  // LP Stake Intent (Pre-TGE off-chain deposit/withdraw bookkeeping)
  // --------------------------------------------------------------------------

  {
    method: "POST",
    path: "/lp-stake-intent",
    description: "portfolioApi.setLpStakeIntent",
    respond: ({ body }): LpStakeIntent => {
      const b = (body ?? {}) as {
        walletAddress?: string;
        poolAddress?: string;
        tokenId?: string;
        stakedAmount?: string;
      };
      return {
        id: Math.floor(Math.random() * 100_000) + 7000,
        walletAddress: b.walletAddress ?? "0x0",
        poolAddress: b.poolAddress ?? MOCK_POOL_ADDR.wethCbbtc,
        tokenId: b.tokenId ?? "",
        stakedAmount: b.stakedAmount ?? "0",
        isActive: (b.stakedAmount ?? "0") !== "0",
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
      };
    },
  },

  {
    method: "GET",
    path: /^\/lp-stake-intent\/(0x[a-fA-F0-9]{40})$/,
    description: "portfolioApi.getLpStakeIntents",
    respond: (): LpStakeIntentsResponse => ({
      intents: MOCK_LP_STAKE_INTENTS,
    }),
  },

  {
    method: "DELETE",
    path: /^\/lp-stake-intent\/(0x[a-fA-F0-9]{40})\/(0x[a-fA-F0-9]{40})(?:\/([^/]+))?$/,
    description: "portfolioApi.clearLpStakeIntent",
    respond: (): void => undefined,
  },

  // --------------------------------------------------------------------------
  // Vote Incentive (Pre-TGE off-chain bribes)
  // --------------------------------------------------------------------------

  {
    method: "POST",
    path: "/vote-incentive",
    description: "portfolioApi.addVoteIncentive",
    respond: ({ body }): VoteIncentive => {
      const b = (body ?? {}) as {
        walletAddress?: string;
        poolAddress?: string;
        tokenAddress?: string;
        tokenSymbol?: string;
        tokenDecimals?: number;
        amount?: string;
        amountUsd?: string;
        epoch?: number;
      };
      return {
        id: Math.floor(Math.random() * 100_000) + 9000,
        walletAddress: b.walletAddress ?? "0x0",
        poolAddress: b.poolAddress ?? MOCK_POOL_ADDR.wethGiwa,
        tokenAddress: b.tokenAddress ?? MOCK_TOKEN_ADDR.GIWA,
        tokenSymbol: b.tokenSymbol ?? "GIWA",
        tokenDecimals: b.tokenDecimals ?? 18,
        amount: b.amount ?? "0",
        amountUsd: b.amountUsd ?? "0",
        epoch: b.epoch ?? 42,
        createdAt: NOW_ISO,
      };
    },
  },

  {
    method: "GET",
    path: /^\/vote-incentive\/wallet\/(0x[a-fA-F0-9]{40})$/,
    description: "portfolioApi.getVoteIncentivesByWallet",
    respond: (): VoteIncentivesResponse => ({
      incentives: MOCK_VOTE_INCENTIVES,
    }),
  },

  {
    method: "GET",
    path: /^\/vote-incentive\/pool\/(0x[a-fA-F0-9]{40})$/,
    description: "portfolioApi.getVoteIncentivesByPool",
    respond: ({ pathParams, query }): PoolEpochIncentivesResponse => {
      const pool = pathParams[0] ?? "";
      const epoch = Number(query.get("epoch") ?? 42);
      const rows = MOCK_VOTE_INCENTIVES.filter(
        (v) => v.poolAddress.toLowerCase() === pool.toLowerCase(),
      );
      const totalUsd = rows.reduce((acc, v) => acc + Number(v.amountUsd), 0);
      return {
        poolAddress: pool,
        epoch,
        incentives: rows,
        totalAmountUsd: totalUsd.toFixed(2),
      };
    },
  },

  // --------------------------------------------------------------------------
  // Add more mocks here. Each handler is a self-contained entry; the file
  // stays flat so all mock data is greppable in one place.
  // --------------------------------------------------------------------------
];

// ============================================================================
// Matching engine
// ============================================================================

/**
 * Normalize a fully-qualified request URL down to a path the handlers above
 * can match against. Strips:
 *   - absolute origin (`http://localhost:3044/foo` → `/foo`)
 *   - same-origin proxy prefixes (`/api/gateway/foo` → `/foo`)
 */
function normalizePath(url: string): string {
  let pathAndQuery = url;
  if (/^https?:\/\//.test(url)) {
    const u = new URL(url);
    pathAndQuery = `${u.pathname}${u.search}`;
  }
  const [path] = pathAndQuery.split("?");
  return path
    .replace(/^\/api\/gateway/, "")
    .replace(/^\/api\/broker-admin/, "")
    .replace(/^\/api\/admin/, "")
    .replace(/^\/api\/indexer/, "")
    || "/";
}

export type MockResult =
  | { matched: true; data: unknown; description: string }
  | { matched: false };

/**
 * Returns a mock response for the given fully-qualified URL + method, or
 * `{ matched: false }` if no handler is registered. Always returns
 * `{ matched: false }` when `MOCK_DATA_ENABLED` is off so the live path runs
 * untouched.
 */
export function getMockResponse(opts: {
  method: string;
  url: string;
  body?: BodyInit | null;
}): MockResult {
  if (!MOCK_DATA_ENABLED) return { matched: false };

  const method = (opts.method || "GET").toUpperCase();
  const path = normalizePath(opts.url);
  const queryStr = opts.url.includes("?")
    ? opts.url.slice(opts.url.indexOf("?") + 1)
    : "";
  const query = new URLSearchParams(queryStr);

  let parsedBody: unknown = undefined;
  if (typeof opts.body === "string") {
    try {
      parsedBody = JSON.parse(opts.body);
    } catch {
      parsedBody = opts.body;
    }
  }

  for (const h of handlers) {
    if (h.method !== method) continue;
    let pathParams: string[] = [];
    if (typeof h.path === "string") {
      if (h.path !== path) continue;
    } else {
      const m = path.match(h.path);
      if (!m || m[0] !== path) continue;
      pathParams = m.slice(1);
    }
    const data = h.respond({
      method,
      path,
      query,
      pathParams,
      body: parsedBody,
    });
    if (process.env.NODE_ENV !== "production") {
      console.log(`[mocks] ${method} ${path} → ${h.description}`);
    }
    return { matched: true, data, description: h.description };
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[mocks] no handler for ${method} ${path} — falling through to real fetch (likely 404 / network error if backend is offline)`,
    );
  }
  return { matched: false };
}
