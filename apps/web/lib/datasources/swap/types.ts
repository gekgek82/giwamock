import type { Address } from "@/lib/datasources/types";

/** A single hop in a swap path. Matches the shape used by `useSwapPath`. */
export interface SwapRoute {
  from: Address;
  to: Address;
  stable: boolean;
  factory: Address;
  poolType?: string;
  tickSpacing?: number;
  poolAddress?: Address;
}

/**
 * Enriched pool data from the indexer API, forwarded into the swap data
 * source so it can evaluate BASIC hops without an RPC round-trip. Only the
 * fields the evaluator actually touches are required — the real `PoolInfo`
 * has many more.
 */
export interface SwapPoolSnapshot {
  address: Address;
  reserve0: string;
  reserve1: string;
  token0: { address: Address; symbol: string; decimals: number };
  token1: { address: Address; symbol: string; decimals: number };
  poolType?: string;
  isStable?: boolean;
}

export interface EvaluateSwapInput {
  candidatePaths: SwapRoute[][];
  pools: SwapPoolSnapshot[];
  amountIn: bigint;
  stableFeeBps: number;
  volatileFeeBps: number;
}

/**
 * Best swap evaluation across all candidate paths. Consumers derive
 * user-facing strings (formatted output, price impact) from these fields.
 */
export interface SwapEvaluation {
  output: bigint;
  spotOutput: bigint;
  path: SwapRoute[] | null;
  isStable: boolean;
  isCL: boolean;
  isMixed: boolean;
  quoteInput: bigint;
  clMaxOutput: bigint;
  /**
   * Worst-hop saturation across the chosen path, in basis points.
   * For each hop, `hopOutput / hopMaxOutput` is tracked; the maximum
   * across all hops (single or multi) becomes this value. 10000 = 100%.
   * Lets consumers flag insufficient liquidity uniformly for BASIC, CL,
   * and MIXED paths — not just direct CL pools.
   */
  saturationBps: number;
}

export interface DirectQuoteInput {
  route: SwapRoute;
  amountIn: bigint;
  poolAddress?: Address;
}

export interface DirectQuote {
  output: bigint;
  spotOutput: bigint;
  quoteInput: bigint;
}

export interface AddLiquidityQuoteInput {
  tokenA: Address;
  tokenB: Address;
  stable: boolean;
  amountADesired: bigint;
  amountBDesired: bigint;
}

export interface AddLiquidityQuote {
  amountA: bigint;
  amountB: bigint;
  liquidity: bigint;
}

export interface RemoveLiquidityQuoteInput {
  tokenA: Address;
  tokenB: Address;
  stable: boolean;
  liquidity: bigint;
}

export interface RemoveLiquidityQuote {
  amountA: bigint;
  amountB: bigint;
}

export interface FactoryDefaultFees {
  stableFeeBps: number;
  volatileFeeBps: number;
}

/**
 * Swap-related read-only interface.
 *
 * Path finding itself stays client-side (in `useSwapPath`) because it runs
 * against the indexer's pool snapshot — no contract reads. This interface
 * only covers the "given a path, what's the output" part, which is either
 * on-chain (today) or delegated to a `/swap/quote` endpoint (future).
 */
export interface SwapDataSource {
  evaluateSwapPaths(input: EvaluateSwapInput): Promise<SwapEvaluation>;
  getDirectQuote(input: DirectQuoteInput): Promise<DirectQuote>;
  getAddLiquidityQuote(
    input: AddLiquidityQuoteInput,
  ): Promise<AddLiquidityQuote>;
  getRemoveLiquidityQuote(
    input: RemoveLiquidityQuoteInput,
  ): Promise<RemoveLiquidityQuote>;
  getFactoryDefaultFees(): Promise<FactoryDefaultFees>;
}
