function lc(a: string): string {
  return a.trim().toLowerCase();
}

export type EffectiveErc20DecimalsOptions = {
  /**
   * Stable / fiat-pegged quote tokens from broker env (`DEX_PAIR_DISPLAY_STABLES`,
   * `DEX_USD_QUOTE_USDT`, …). Used only when `spot_tokens.decimals` is missing.
   */
  stableQuoteAddresses: readonly string[];
};

/**
 * ERC-20 `decimals` for converting wei → human amounts. Prefer DB when present.
 * When a token row is missing (common right before metadata backfill), configured
 * stable addresses default to **6** so USDC/USDT mint ratios do not blow up as if
 * they were 18 decimals.
 */
export function effectiveErc20Decimals(
  tokenAddress: string,
  dbDecimals: number | undefined | null,
  options: EffectiveErc20DecimalsOptions,
): number {
  const d = dbDecimals;
  // In this codebase, 0 is often an "unset default" from DB rows.
  // Treat 0 as missing so we can still apply stable/native fallbacks.
  if (typeof d === 'number' && Number.isFinite(d) && d > 0 && d <= 255) {
    return d;
  }
  const t = lc(tokenAddress);
  for (const s of options.stableQuoteAddresses) {
    if (s && lc(s) === t) {
      return 6;
    }
  }
  return 18;
}
