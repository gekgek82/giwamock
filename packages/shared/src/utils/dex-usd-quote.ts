/**
 * DEX-oriented USD **hints** from on-chain spot rows (`spot_pairs.price` semantics).
 *
 * **Convention (matches broker `SwapOhlcvAggregationService.pairPrice`):**
 * `price` = **human** quote-token per 1 human base-token (`wei` amounts scaled by each token’s `decimals`),
 * i.e. aligned with on-chain token1/token0 economics when `base`/`quote` are broker `token0`/`token1`.
 *
 * The **amm-indexer** does not compute USD; the broker stores last swap ratios on pairs/tokens.
 * These helpers combine that graph with configured **USDT** and **WETH** quote addresses to estimate
 * “USD per token” for aggregators (TVL/volume notional, charts). This is **not** a certified oracle.
 */

export type DexUsdQuoteConfig = {
  /** USDT (or other $1 stable used as USD) token address, lowercased hex. */
  usdtToken: string;
  /** Wrapped native / canonical ETH token address, lowercased hex. */
  wethToken: string;
};

/** Minimal pair row (e.g. from `spot_pairs`). */
export type DexPairPriceInput = {
  /** Optional pool id for deterministic ordering when multiple pools exist. */
  poolAddress?: string;
  base: string;
  quote: string;
  /** Quote per 1 base; must be finite and > 0 when used. */
  price: number;
};

function lc(addr: string): string {
  return addr.trim().toLowerCase();
}

function isPositiveFinite(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function sortPairsStable(
  pairs: readonly DexPairPriceInput[],
): DexPairPriceInput[] {
  return [...pairs].sort((a, b) => {
    const pa = a.poolAddress ?? '';
    const pb = b.poolAddress ?? '';
    const c = pa.localeCompare(pb);
    if (c !== 0) return c;
    return `${a.base}/${a.quote}`.localeCompare(`${b.base}/${b.quote}`);
  });
}

/**
 * USD (USDT) per 1 WETH from `WETH/USDT` or `USDT/WETH` rows.
 */
export function resolveWethUsdPrice(
  pairs: readonly DexPairPriceInput[],
  cfg: DexUsdQuoteConfig,
): number | null {
  const u = lc(cfg.usdtToken);
  const w = lc(cfg.wethToken);
  for (const p of sortPairsStable(pairs)) {
    const b = lc(p.base);
    const q = lc(p.quote);
    if (!isPositiveFinite(p.price)) continue;
    if (b === w && q === u) return p.price;
    if (b === u && q === w) return 1 / p.price;
  }
  return null;
}

/**
 * Estimates **USD per 1 token** using:
 *
 * 1. **Direct** — `TOKEN/USDT` (base = token, quote = USDT): `usd = price`.
 *    Or `USDT/TOKEN`: `usd = 1 / price`.
 * 2. **Via WETH** — `usd = (TOKEN/WETH in quote-per-base) * (WETH/USDT in USD per WETH)`,
 *    including inverted `WETH/TOKEN` and `USDT/WETH` legs as above.
 *
 * Returns `null` if no positive route. **USDT** is treated as **1 USD** when `token === usdtToken`.
 */
export function resolveDexTokenUsdPrice(
  tokenAddress: string,
  pairs: readonly DexPairPriceInput[],
  cfg: DexUsdQuoteConfig,
): number | null {
  const t = lc(tokenAddress);
  const u = lc(cfg.usdtToken);
  const w = lc(cfg.wethToken);
  if (!u || !w) return null;
  if (t === u) return 1;

  for (const p of sortPairsStable(pairs)) {
    if (!isPositiveFinite(p.price)) continue;
    const b = lc(p.base);
    const q = lc(p.quote);
    if (b === t && q === u) return p.price;
    if (b === u && q === t) return 1 / p.price;
  }

  const ethUsd = resolveWethUsdPrice(pairs, cfg);
  if (ethUsd === null || !isPositiveFinite(ethUsd)) return null;

  for (const p of sortPairsStable(pairs)) {
    if (!isPositiveFinite(p.price)) continue;
    const b = lc(p.base);
    const q = lc(p.quote);
    if (b === t && q === w) return p.price * ethUsd;
    if (b === w && q === t) return (1 / p.price) * ethUsd;
  }

  return null;
}

export function parseWeiDecimalString(weiStr: string): bigint {
  const s = weiStr.trim().split('.')[0] ?? '';
  if (!s) return 0n;
  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
}

/**
 * Converts integer wei (or smallest-unit) string to a UI `number` using `decimals`.
 * Display / aggregation use only (precision limits of `number` apply).
 */
export function tokenWeiToUiAmount(weiStr: string, decimals: number): number {
  const wei = parseWeiDecimalString(weiStr);
  if (wei === 0n) return 0;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 80) return 0;
  const scale = 10n ** BigInt(decimals);
  const whole = wei / scale;
  const frac = wei % scale;
  return Number(whole) + Number(frac) / Number(scale);
}

/** `amountUi * usdPerToken` when both are finite. */
export function usdNotionalFromTokenUiAmount(
  amountUi: number,
  usdPerToken: number,
): number {
  if (!Number.isFinite(amountUi) || !Number.isFinite(usdPerToken)) return 0;
  return amountUi * usdPerToken;
}

/** Converts token wei + decimals to UI amount, then multiplies by USD-per-token. */
export function usdNotionalFromTokenWei(
  weiStr: string,
  decimals: number,
  usdPerToken: number,
): number {
  return usdNotionalFromTokenUiAmount(
    tokenWeiToUiAmount(weiStr, decimals),
    usdPerToken,
  );
}

/**
 * TVL-style notional: `baseUi * usdPerBase + quoteUi * usdPerQuote`.
 */
export function pairReservesUsdNotional(args: {
  baseAmountUi: number;
  quoteAmountUi: number;
  usdPerBase: number;
  usdPerQuote: number;
}): number {
  const { baseAmountUi, quoteAmountUi, usdPerBase, usdPerQuote } = args;
  if (
    !Number.isFinite(baseAmountUi) ||
    !Number.isFinite(quoteAmountUi) ||
    !Number.isFinite(usdPerBase) ||
    !Number.isFinite(usdPerQuote)
  ) {
    return 0;
  }
  return baseAmountUi * usdPerBase + quoteAmountUi * usdPerQuote;
}
