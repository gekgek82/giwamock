/**
 * AMM **indexer** rules for how a pool’s “pair price” should be **represented**
 * (distinct from raw on-chain token0/token1 sorting).
 */

function lc(a: string): string {
  return a.trim().toLowerCase();
}

/** Stored / communicated numeric convention for this pool row. */
export type IndexerPairPriceAxis =
  | 'token1_per_token0'
  | 'display_quote_per_display_base';

export type InferIndexerPairPriceOrientationOptions = {
  /** Stablecoin addresses (USDC, USDT, …): case-insensitive hex. */
  stableAddresses: readonly string[];
  /**
   * Network “native” ERC-20 (e.g. GIWA): when the pair has **no** stable and this
   * address is one side, it becomes **display quote** → **X / NETWORK** tickers.
   */
  networkQuoteTokenAddress?: string;
};

/** Same convention as broker payloads: canonical checksummed/lowercase hex from the node. */
export type PairOrientationAddress = `0x${string}`;

export type InferIndexerPairPriceOrientationResult = {
  base: PairOrientationAddress;
  quote: PairOrientationAddress;
  /**
   * - `token1_per_token0` — rule (iii): canonical on-chain ratio (no stable, no network quote token).
   * - `display_quote_per_display_base` — rules (i)(ii): interpret stored UX price as **display quote per 1 display base**.
   */
  pairPriceAxis: IndexerPairPriceAxis;
};

/**
 * i) If token0 or token1 is a configured **stable**, pair is shown as **X / STABLE** (stable = quote).
 * ii) Otherwise if **networkQuoteTokenAddress** is one side, pair is **X / NETWORK** (network = quote).
 * iii) Otherwise store **token1 / token0** (display base = token0, display quote = token1).
 */
export function inferIndexerPairPriceOrientation(
  token0: string,
  token1: string,
  options: InferIndexerPairPriceOrientationOptions,
): InferIndexerPairPriceOrientationResult {
  const t0 = lc(token0);
  const t1 = lc(token1);
  const stables = new Set(
    options.stableAddresses.map((a) => lc(a)).filter(Boolean),
  );
  const s0 = stables.has(t0);
  const s1 = stables.has(t1);

  /** Always return lowercase hex so indexer DB / broker keys match `lc()` everywhere. */
  const a0 = t0 as PairOrientationAddress;
  const a1 = t1 as PairOrientationAddress;

  if (s0 && s1) {
    return {
      base: a0,
      quote: a1,
      pairPriceAxis: 'token1_per_token0',
    };
  }
  if (s0 && !s1) {
    return {
      base: a1,
      quote: a0,
      pairPriceAxis: 'display_quote_per_display_base',
    };
  }
  if (!s0 && s1) {
    return {
      base: a0,
      quote: a1,
      pairPriceAxis: 'display_quote_per_display_base',
    };
  }

  const net = options.networkQuoteTokenAddress?.trim();
  const n = net ? lc(net) : '';
  if (n && (t0 === n || t1 === n)) {
    if (t0 === n) {
      return {
        base: a1,
        quote: a0,
        pairPriceAxis: 'display_quote_per_display_base',
      };
    }
    return {
      base: a0,
      quote: a1,
      pairPriceAxis: 'display_quote_per_display_base',
    };
  }

  return {
    base: a0,
    quote: a1,
    pairPriceAxis: 'token1_per_token0',
  };
}
