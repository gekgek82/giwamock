/**
 * Pure bigint swap quote helpers (no viem). Mirrors `apps/web/lib/swap/math.ts`
 * so broker and clients share one formula for price impact.
 */

export const Q96 = 2n ** 96n;

/** Same as web `parseUnits("0.000001", 18)` — spot-size reference for impact. */
export const SPOT_REF_AMOUNT = 1_000_000_000_000n;

/**
 * Expected CL swap output (single tick range; approximate if swap crosses ticks).
 * @param feePips Fee in hundredths of a bip (contract `fee()` raw value space).
 */
export function computeCLQuote(
  sqrtPriceX96: bigint,
  liquidity: bigint,
  feePips: bigint,
  amountIn: bigint,
  zeroForOne: boolean,
): bigint {
  if (sqrtPriceX96 === 0n || liquidity === 0n || amountIn === 0n) return 0n;

  const amountInAfterFee = (amountIn * (1_000_000n - feePips)) / 1_000_000n;

  if (zeroForOne) {
    const x = (liquidity * Q96) / sqrtPriceX96;
    const xPrime = x + amountInAfterFee;
    if (xPrime === 0n) return 0n;
    const newSqrtPriceX96 = (liquidity * Q96) / xPrime;
    if (newSqrtPriceX96 >= sqrtPriceX96) return 0n;
    return (liquidity * (sqrtPriceX96 - newSqrtPriceX96)) / Q96;
  }

  const newSqrtPriceX96 =
    sqrtPriceX96 + (amountInAfterFee * Q96) / liquidity;
  if (newSqrtPriceX96 === 0n) return 0n;
  const outOld = (liquidity * Q96) / sqrtPriceX96;
  const outNew = (liquidity * Q96) / newSqrtPriceX96;
  return outOld > outNew ? outOld - outNew : 0n;
}

/**
 * Expected BASIC pool swap output (constant-product), volatile or stable curve
 * as implemented by the router `getAmountsOut` on-chain — use those reads for
 * stable pools; this helper is only for reserve-based estimates when needed.
 */
export function computeBasicQuote(
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: number,
  amountIn: bigint,
): bigint {
  if (reserveIn === 0n || reserveOut === 0n || amountIn === 0n) return 0n;
  const amountInAfterFee =
    (amountIn * BigInt(10_000 - feeBps)) / 10_000n;
  return (amountInAfterFee * reserveOut) / (reserveIn + amountInAfterFee);
}

/**
 * Expected STABLE pool swap output, ported from `Giwater-Contracts/contracts/pools/Pool.sol`.
 *
 * Stable invariant in normalized 1e18 space:
 *   k = (x*y)*(x^2 + y^2) / 1e18^2  (see `_k` in Pool.sol)
 *
 * Output uses Newton iteration (`_get_y`) on f(x0, y) = k.
 *
 * Notes:
 * - Inputs reserves/amountIn are in raw token wei units.
 * - `decimals0/decimals1` are the token0/token1 decimal scales (e.g. 1e6, 1e18).
 * - `tokenInIsToken0` determines swap direction.
 * - Fee is applied on amountIn (same as Pool.sol `getAmountOut`).
 */
export function computeStableQuote(params: {
  reserve0: bigint;
  reserve1: bigint;
  decimals0: bigint;
  decimals1: bigint;
  feeBps: number;
  amountIn: bigint;
  tokenInIsToken0: boolean;
}): bigint {
  const {
    reserve0,
    reserve1,
    decimals0,
    decimals1,
    feeBps,
    amountIn,
    tokenInIsToken0,
  } = params;
  if (
    reserve0 === 0n ||
    reserve1 === 0n ||
    amountIn === 0n ||
    decimals0 === 0n ||
    decimals1 === 0n
  ) {
    return 0n;
  }

  const ONE = 1_000_000_000_000_000_000n; // 1e18
  const amountInAfterFee =
    (amountIn * BigInt(10_000 - feeBps)) / 10_000n;
  if (amountInAfterFee === 0n) return 0n;

  const k = stableK(reserve0, reserve1, decimals0, decimals1);
  if (k === 0n) return 0n;

  // Normalize reserves into 1e18 space, same as Pool.sol:
  const r0 = (reserve0 * ONE) / decimals0;
  const r1 = (reserve1 * ONE) / decimals1;

  const reserveA = tokenInIsToken0 ? r0 : r1;
  const reserveB = tokenInIsToken0 ? r1 : r0;
  const amountInNorm = tokenInIsToken0
    ? (amountInAfterFee * ONE) / decimals0
    : (amountInAfterFee * ONE) / decimals1;

  const y = reserveB - stableGetY(reserveA + amountInNorm, k, reserveB);
  if (y <= 0n) return 0n;

  // De-normalize output back to token units
  const out = tokenInIsToken0
    ? (y * decimals1) / ONE
    : (y * decimals0) / ONE;
  return out > 0n ? out : 0n;
}

function stableF(x0: bigint, y: bigint): bigint {
  const ONE = 1_000_000_000_000_000_000n;
  const a = (x0 * y) / ONE;
  const b = (x0 * x0) / ONE + (y * y) / ONE;
  return (a * b) / ONE;
}

function stableD(x0: bigint, y: bigint): bigint {
  const ONE = 1_000_000_000_000_000_000n;
  // Pool.sol:
  // (3 * x0 * ((y * y) / 1e18)) / 1e18 + ((((x0 * x0) / 1e18) * x0) / 1e18)
  const term1 = (3n * x0 * ((y * y) / ONE)) / ONE;
  const term2 = ((((x0 * x0) / ONE) * x0) / ONE);
  return term1 + term2;
}

function stableK(
  x: bigint,
  y: bigint,
  decimals0: bigint,
  decimals1: bigint,
): bigint {
  const ONE = 1_000_000_000_000_000_000n;
  const _x = (x * ONE) / decimals0;
  const _y = (y * ONE) / decimals1;
  const a = (_x * _y) / ONE;
  const b = ((_x * _x) / ONE) + ((_y * _y) / ONE);
  return (a * b) / ONE;
}

function stableGetY(x0: bigint, xy: bigint, y0: bigint): bigint {
  const ONE = 1_000_000_000_000_000_000n;
  let y = y0;
  for (let i = 0; i < 255; i++) {
    const k = stableF(x0, y);
    if (k < xy) {
      let dy = ((xy - k) * ONE) / stableD(x0, y);
      if (dy === 0n) {
        if (k === xy) return y;
        // Equivalent of Pool.sol `_k(x0, y + 1) > xy` check.
        // We reuse stableF as we are already in 1e18 normalized space.
        if (stableF(x0, y + 1n) > xy) return y + 1n;
        dy = 1n;
      }
      y = y + dy;
    } else {
      let dy = ((k - xy) * ONE) / stableD(x0, y);
      if (dy === 0n) {
        if (k === xy || stableF(x0, y - 1n) < xy) return y;
        dy = 1n;
      }
      y = y - dy;
    }
  }
  return 0n;
}

/**
 * Price impact in percent (non-negative): 1 − (execution rate / spot rate).
 */
export function computePriceImpact(
  output: bigint,
  spotOutput: bigint,
  quoteInput: bigint,
): number {
  return computePriceImpactWithSpotInput(
    output,
    spotOutput,
    quoteInput,
    SPOT_REF_AMOUNT,
  );
}

/**
 * Price impact in percent (non-negative): 1 − (execution rate / spot rate),
 * where `spotOutput` MUST correspond to swapping `spotInput` through the same pool.
 *
 * This allows callers to choose a spot reference size that avoids bigint truncation
 * for low-decimal tokens (e.g. USDC) while still approximating a “marginal” quote.
 */
export function computePriceImpactWithSpotInput(
  output: bigint,
  spotOutput: bigint,
  quoteInput: bigint,
  spotInput: bigint,
): number {
  if (
    output === 0n ||
    spotOutput === 0n ||
    quoteInput === 0n ||
    spotInput === 0n
  ) {
    return 0;
  }

  const execNumerator = output * spotInput;
  const execDenominator = quoteInput * spotOutput;
  if (execDenominator === 0n) return 0;

  const ratio =
    Number((execNumerator * BigInt(1e18)) / execDenominator) / 1e18;
  return Math.max(0, (1 - ratio) * 100);
}
