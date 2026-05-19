/**
 * Broker swap routing API (token graph over pool edges).
 */

export interface SwapRouteHopDto {
  /** Pool (pair) contract address for this hop */
  pairAddress: string;
  /** Token paid in on this hop (checksummed or lower-case hex) */
  tokenIn: string;
  /** Optional logo URL for `tokenIn` (spot_tokens.logoURI) */
  inputTokenLogo?: string | null;
  /** Token received out on this hop */
  tokenOut: string;
  /** Optional logo URL for `tokenOut` (spot_tokens.logoURI) */
  outputTokenLogo?: string | null;
  /**
   * Display fee in basis points (1e-4) when the read model has a single static value.
   * `null` for CL pools in full dynamic-fee mode (`feeSource === 'cl_module_dynamic'`);
   * actual swap fee then follows on-chain `getFee` / TWAP (see CL dynamic-fee read model).
   */
  effectiveFeeBps: number | null;
  /**
   * **Swap fee in basis points (bps)** for this hop — always a non-negative integer.
   * Same value used for `feeOnInputWei` / price-impact estimates when `amountIn` is set.
   * When `effectiveFeeBps` is unknown (`null`), this falls back to factory tier defaults
   * or **30** (volatile / CL) / **5** (stable) — see `resolveSwapRouteHopFeeBps` in this package.
   */
  feeBps: number;
  /**
   * Origin of `effectiveFeeBps`: `factory_tier` | `factory_custom` | `cl_module_fixed` | `cl_module_dynamic`.
   * Empty when the pair row is missing or not yet materialized.
   */
  feeSource: string;
  /** Routing edge classification: classic volatile/stable pool vs concentrated liquidity */
  poolKind: 'volatile' | 'stable' | 'cl';
  /**
   * For CL hops: tick spacing (int24) needed to build UniversalGiwaRouter mixed/CL calldata.
   * For non-CL hops: 0.
   */
  tickSpacing?: number;
  /**
   * Estimated price impact for this hop (%), `computePriceImpact` on a **proxy AMM**
   * built from `spot_pairs.baseLiquidity` / `quoteLiquidity` proxy reserves (not on-chain).
   * `null` when `amountIn` is omitted, depth proxy is zero, or the hop path cannot
   * be mapped to base/quote TVL columns.
   */
  priceImpactPercent: number | null;
  /**
   * Estimated swap fee on this hop’s input (wei, integer string), `input * feeBps / 10000`.
   * Uses {@link feeBps}.
   * `null` when `amountIn` is not provided.
   */
  feeOnInputWei: string | null;
}

export interface SwapRouteResponseDto {
  /** Resolved input token address */
  fromToken: string;
  /** Resolved output token address */
  toToken: string;

  /** Optional token icon URL for `fromToken` (spot_tokens.logoURI) */
  fromTokenIconUrl?: string | null;
  /** Optional token icon URL for `toToken` (spot_tokens.logoURI) */
  toTokenIconUrl?: string | null;
  /** Echo of `amountIn` query when provided (wei integer string, `from` token) */
  amountInWei?: string;

  /**
   * When `amountIn` is provided: estimated output amount (wei, integer string) by walking the route
   * using broker proxy reserves (`spot_pairs.baseLiquidity/quoteLiquidity`) and hop `feeBps`.
   *
   * **Note:** This is an off-chain estimate for UX; for execution-accurate quotes, call the router on-chain.
   */
  amountOutWei?: string;

  /**
   * When `amountIn` is provided: estimated exchange rate = **from-token human / to-token human**
   * (input per output). Preferentially from proxy-reserve ratios; if those cannot be derived,
   * falls back to the sized quote `amountInWei`/`amountOutWei` when decimals are known.
   * **`null`** if neither path applies or decimals are unusable.
   */
  exchangeRate?: number | null;
  /**
   * Sum of each hop’s swap fee valued in USD (`feeOnInputWei` × spot USD/token for that hop’s `tokenIn`).
   * Present when `amountIn` was provided; **`null`** if any hop’s fee token lacks a broker USD price.
   */
  totalFeeUsd?: number | null;
  /**
   * Arithmetic mean of hop `feeBps` across the route (basis points).
   * Present when `amountIn` was provided and `hops.length > 0`; **`null`** if there are no hops.
   */
  averageFeeBps?: number | null;
  /**
   * Route-level price impact (%): `1 − Π(1 − hop.priceImpactPercent/100)` over all hops.
   * Present when `amountIn` was provided; **`null`** if any hop lacks `priceImpactPercent` (e.g. proxy reserves missing mid-route).
   */
  routePriceImpactPercent?: number | null;
  /** Ordered hops; empty when from === to */
  hops: SwapRouteHopDto[];

  /**
   * Optional: pre-built transaction for UniversalGiwaRouter.
   * Present only when the caller requests calldata-building and provides
   * the required inputs (amountInWei, amountOutMinWei, recipient, deadline).
   */
  tx?: {
    /** Router contract address (target for the transaction) */
    to: string;
    /** Calldata hex string (0x...) */
    data: string;
    /** ETH value to send (wei string). For token->token swaps this is "0". */
    valueWei: string;
    /** Method selector name used to build calldata (for UX/debug) */
    method: string;
  };
}
