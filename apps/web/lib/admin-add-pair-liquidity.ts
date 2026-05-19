import { parseUnits } from "viem";
import type { PublicClient } from "viem";
import {
  GiwaUniversalRouterAbi,
  CLFactoryAbi,
  ERC20Abi,
} from "@giwater/shared/abis";

export const ADD_PAIR_LIQUIDITY_ZERO =
  "0x0000000000000000000000000000000000000000" as const;

const MIN_SQRT = 4295128739n;
const MAX_SQRT = 1461446703485210103287273052203988822378723970342n;

/** Integer floor square root for non-negative bigint (Uniswap-style sqrtPrice math). */
export function sqrtFloor(n: bigint): bigint {
  if (n < 0n) throw new Error("sqrtFloor: negative");
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) >> 1n;
  while (y < x) {
    x = y;
    y = (n / x + x) >> 1n;
  }
  return x;
}

/**
 * Smallest-unit ratio token1/token0 ≈ num/den (matches `add-pair-liquidity.sh` Python).
 * `priceStr` is human "quote per 1 base" with base=token0, quote=token1; max 18 fractional digits.
 */
export function token1PerToken0Ratio(
  priceStr: string,
  dec0: number,
  dec1: number,
): { num: bigint; den: bigint } | null {
  const trimmed = priceStr.trim();
  if (!trimmed) return null;
  let priceFixed: bigint;
  try {
    priceFixed = parseUnits(trimmed, 18);
  } catch {
    return null;
  }
  if (priceFixed <= 0n) return null;
  const den = 10n ** BigInt(dec0);
  const num = (priceFixed * (10n ** BigInt(dec1))) / 10n ** 18n;
  if (num <= 0n || den === 0n) return null;
  return { num, den };
}

export function sqrtPriceX96FromRatio(num: bigint, den: bigint): bigint {
  const r = (num << 192n) / den;
  let sp = sqrtFloor(r);
  if (sp < MIN_SQRT) sp = MIN_SQRT;
  if (sp >= MAX_SQRT) sp = MAX_SQRT - 1n;
  return sp;
}

/** Initial empty pool: base (token0) wei from quote (token1) wei and price ratio. */
export function baseWeiInitialFromQuote(
  quoteWei: bigint,
  num: bigint,
  den: bigint,
): bigint {
  if (num === 0n) return 0n;
  return (quoteWei * den) / num;
}

/** Existing basic pool: amount0 given fixed token1 deposit (same as script). */
export function baseWeiFromReserves(
  quoteWei: bigint,
  reserve0: bigint,
  reserve1: bigint,
): bigint {
  if (reserve0 === 0n && reserve1 === 0n) {
    return 0n;
  }
  if (reserve1 === 0n) return 0n;
  return (quoteWei * reserve0) / reserve1;
}

export async function readErc20Meta(
  client: PublicClient,
  token: `0x${string}`,
): Promise<{ decimals: number; symbol: string }> {
  try {
    const [decimals, symbol] = await Promise.all([
      client.readContract({
        address: token,
        abi: ERC20Abi,
        functionName: "decimals",
      }) as Promise<number>,
      client.readContract({
        address: token,
        abi: ERC20Abi,
        functionName: "symbol",
      }).catch(() => "") as Promise<string>,
    ]);
    return {
      decimals: Number(decimals),
      symbol: typeof symbol === "string" ? symbol : `${token.slice(0, 8)}…`,
    };
  } catch {
    return { decimals: 18, symbol: `${token.slice(0, 8)}…` };
  }
}

export async function readSortedPair(
  client: PublicClient,
  router: `0x${string}`,
  tokenA: `0x${string}`,
  tokenB: `0x${string}`,
) {
  const [token0, token1] = (await client.readContract({
    address: router,
    abi: GiwaUniversalRouterAbi,
    functionName: "sortTokens",
    args: [tokenA, tokenB],
  })) as readonly [`0x${string}`, `0x${string}`];
  const [m0, m1] = await Promise.all([
    readErc20Meta(client, token0),
    readErc20Meta(client, token1),
  ]);
  return {
    token0,
    token1,
    dec0: m0.decimals,
    dec1: m1.decimals,
    sym0: m0.symbol,
    sym1: m1.symbol,
  };
}

export async function readBasicPoolReserves(
  client: PublicClient,
  router: `0x${string}`,
  token0: `0x${string}`,
  token1: `0x${string}`,
  stable: boolean,
): Promise<{
  pool: `0x${string}`;
  /** False when pool address is zero (not created yet). */
  poolExists: boolean;
  reserve0: bigint;
  reserve1: bigint;
}> {
  const pool = (await client.readContract({
    address: router,
    abi: GiwaUniversalRouterAbi,
    functionName: "poolFor",
    args: [token0, token1, stable, ADD_PAIR_LIQUIDITY_ZERO],
  })) as `0x${string}`;
  const poolExists =
    !!pool &&
    pool.toLowerCase() !== ADD_PAIR_LIQUIDITY_ZERO &&
    BigInt(pool) !== 0n;

  if (!poolExists) {
    return {
      pool: (pool || ADD_PAIR_LIQUIDITY_ZERO) as `0x${string}`,
      poolExists: false,
      reserve0: 0n,
      reserve1: 0n,
    };
  }

  const [reserve0, reserve1] = (await client.readContract({
    address: router,
    abi: GiwaUniversalRouterAbi,
    functionName: "getReserves",
    args: [token0, token1, stable, ADD_PAIR_LIQUIDITY_ZERO],
  })) as readonly [bigint, bigint];
  return {
    pool: pool as `0x${string}`,
    poolExists: true,
    reserve0,
    reserve1,
  };
}

export async function readClPoolExists(
  client: PublicClient,
  clFactory: `0x${string}`,
  token0: `0x${string}`,
  token1: `0x${string}`,
  tickSpacing: number,
): Promise<{ pool: `0x${string}`; exists: boolean }> {
  const pool = (await client.readContract({
    address: clFactory,
    abi: CLFactoryAbi,
    functionName: "getPool",
    args: [token0, token1, tickSpacing],
  })) as `0x${string}`;
  const exists =
    !!pool &&
    pool.toLowerCase() !== ADD_PAIR_LIQUIDITY_ZERO &&
    BigInt(pool) !== 0n;
  return { pool: pool as `0x${string}`, exists };
}

export async function readRouterPermit2AndClFactory(
  client: PublicClient,
  router: `0x${string}`,
): Promise<{ permit2: `0x${string}`; clFactory: `0x${string}` }> {
  const [permit2, clFactory] = (await Promise.all([
    client.readContract({
      address: router,
      abi: GiwaUniversalRouterAbi,
      functionName: "permit2",
    }),
    client.readContract({
      address: router,
      abi: GiwaUniversalRouterAbi,
      functionName: "clFactory",
    }),
  ])) as readonly [`0x${string}`, `0x${string}`];
  return { permit2, clFactory };
}
