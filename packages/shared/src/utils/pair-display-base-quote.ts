/**
 * Maps on-chain **token0 / token1** (address-sorted) to UI **display base / display quote**
 * (TradingView-style “BASE/QUOTE”). These are not the same concept.
 */

function lc(a: string): string {
  return a.trim().toLowerCase();
}

export type InferDisplayBaseQuoteOptions = {
  /**
   * Stablecoins whose address should be **display quote** when paired with a non-stable
   * (e.g. USDC, USDT). Matching is case-insensitive by hex address.
   */
  stableQuoteAddresses: readonly string[];
  /**
   * Wrapped native (e.g. WETH). When neither side is a configured stable, this token is
   * treated as **display quote** so the pair reads like “ALT/WETH” (price in ETH).
   */
  wrappedNativeAddress?: string;
  /**
   * When false, falls back to display base = token0, display quote = token1 if no stable.
   * Default true when `wrappedNativeAddress` is set.
   */
  wrappedNativeIsQuoteWhenNoStable?: boolean;
};

export type InferDisplayBaseQuoteResult = {
  /** Contract address of the asset shown as BASE in a BASE/QUOTE ticker. */
  displayBase: string;
  /** Contract address of the asset shown as QUOTE in a BASE/QUOTE ticker. */
  displayQuote: string;
};

/**
 * Infer display orientation from **token0** and **token1** (already sorted on-chain).
 *
 * Rules:
 * 1. If exactly one token is in `stableQuoteAddresses`, that token is **display quote**, the other **display base** (e.g. WETH/USDC).
 * 2. If both are stables, keep **token0 → display base**, **token1 → display quote** (arbitrary but stable).
 * 3. If neither is stable and `wrappedNativeAddress` matches one side and
 *    `wrappedNativeIsQuoteWhenNoStable` is true, wrapped native is **display quote**.
 * 4. Else **token0 → display base**, **token1 → display quote**.
 */
export function inferDisplayBaseQuote(
  token0: string,
  token1: string,
  options: InferDisplayBaseQuoteOptions,
): InferDisplayBaseQuoteResult {
  const t0 = lc(token0);
  const t1 = lc(token1);
  const stables = new Set(
    options.stableQuoteAddresses.map((a) => lc(a)).filter(Boolean),
  );
  const s0 = stables.has(t0);
  const s1 = stables.has(t1);

  if (s0 && s1) {
    return { displayBase: t0, displayQuote: t1 };
  }
  if (s0 && !s1) {
    return { displayBase: t1, displayQuote: t0 };
  }
  if (!s0 && s1) {
    return { displayBase: t0, displayQuote: t1 };
  }

  const w = options.wrappedNativeAddress?.trim();
  const wLc = w ? lc(w) : '';
  const nativeQuote = options.wrappedNativeIsQuoteWhenNoStable !== false;
  if (nativeQuote && wLc) {
    if (t0 === wLc) {
      return { displayBase: t1, displayQuote: t0 };
    }
    if (t1 === wLc) {
      return { displayBase: t0, displayQuote: t1 };
    }
  }

  return { displayBase: t0, displayQuote: t1 };
}

/**
 * Broker stores `spot_pairs.price` as **human token1 per token0** (quote column / base column
 * = on-chain token1 / token0). Convert to **display quote per 1 display base**.
 */
export function computeDisplayPriceFromToken1PerToken0(
  priceToken1PerToken0: number,
  token0: string,
  token1: string,
  displayBase: string,
  displayQuote: string,
): number {
  const t0 = lc(token0);
  const t1 = lc(token1);
  const db = lc(displayBase);
  const dq = lc(displayQuote);
  const p = priceToken1PerToken0;
  if (!Number.isFinite(p) || p < 0) {
    return 0;
  }
  if (db === t0 && dq === t1) {
    return p;
  }
  if (db === t1 && dq === t0) {
    return p === 0 ? 0 : 1 / p;
  }
  return p;
}
