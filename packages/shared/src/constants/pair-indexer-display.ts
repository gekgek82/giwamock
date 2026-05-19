/**
 * **AMM indexer** pair-price **display** orientation — canonical addresses for Giwa Sepolia (91342).
 *
 * Stable addresses default from {@link DEFAULT_GIWA_STABLE_QUOTE_ADDRESSES} (`packages/shared` config).
 * `apps/amm-indexer` can override via `INDEXER_PAIR_STABLE_ADDRESSES` / `INDEXER_PAIR_NETWORK_QUOTE_TOKEN`
 * when non-empty.
 *
 * Logic lives in `inferIndexerPairPriceOrientation` (`@giwater/shared`).
 */

import {
  DEFAULT_GIWA_STABLE_QUOTE_ADDRESSES,
  type StableQuoteAddress,
} from '../config/stable-quote-addresses';
import type { InferIndexerPairPriceOrientationOptions } from '../utils/pair-indexer-price-orientation';
import { TER_TOKEN_ADDRESS, WGIWA_ADDRESS } from './contracts';

type Address = StableQuoteAddress;

/**
 * Wrapped native on Giwa — rule **(ii)**: when neither token is a configured stable but one side
 * is this address, the pair is represented as **X / GIWA** (this token is **display quote**).
 */
export const PAIR_INDEXER_NETWORK_QUOTE_TOKEN_WGIWA: Address = WGIWA_ADDRESS;

/**
 * Alternative “network” quote token (e.g. governance TER) if your product uses **X / TER**
 * instead of wrapped native. Pick **one** convention for `INDEXER_PAIR_NETWORK_QUOTE_TOKEN`.
 */
export const PAIR_INDEXER_NETWORK_QUOTE_TOKEN_TER: Address = TER_TOKEN_ADDRESS;

/**
 * Stablecoins (USDC, USDT, …) — rule **(i)**. Sourced from shared {@link DEFAULT_GIWA_STABLE_QUOTE_ADDRESSES}.
 */
export const PAIR_INDEXER_STABLE_ADDRESSES: readonly Address[] =
  DEFAULT_GIWA_STABLE_QUOTE_ADDRESSES;

/**
 * Default preset matching typical Giwa setup: stables from {@link PAIR_INDEXER_STABLE_ADDRESSES},
 * network quote = wrapped GIWA.
 */
export const PAIR_INDEXER_ORIENTATION_PRESET_WGIWA: InferIndexerPairPriceOrientationOptions =
  {
    stableAddresses: PAIR_INDEXER_STABLE_ADDRESSES,
    networkQuoteTokenAddress: PAIR_INDEXER_NETWORK_QUOTE_TOKEN_WGIWA,
  };
