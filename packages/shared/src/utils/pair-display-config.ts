import { DEFAULT_GIWA_STABLE_QUOTE_ADDRESSES } from '../config/stable-quote-addresses';
import { WGIWA_ADDRESS } from '../constants/contracts';

export interface PairDisplayConfig {
  stableQuoteAddresses: string[];
  wrappedNativeAddress: string;
  wrappedNativeIsQuoteWhenNoStable: boolean;
}

export interface DexUsdQuoteAddressConfig {
  /** Stable token treated as USD quote (e.g. USDT/USDC). */
  usdtToken: string;
  /** Wrapped native token used as bridge quote (e.g. WETH/WGIWA). */
  wethToken: string;
}

/** Same as {@link DEFAULT_GIWA_STABLE_QUOTE_ADDRESSES}; kept for existing broker imports. */
export const PAIR_DISPLAY_STABLE_QUOTE_ADDRESSES = DEFAULT_GIWA_STABLE_QUOTE_ADDRESSES;

/**
 * Shared source-of-truth for broker display orientation (no env parsing).
 */
export const PAIR_DISPLAY_CONFIG_DEFAULT: PairDisplayConfig = {
  stableQuoteAddresses: [...PAIR_DISPLAY_STABLE_QUOTE_ADDRESSES],
  wrappedNativeAddress: WGIWA_ADDRESS,
  wrappedNativeIsQuoteWhenNoStable: true,
};

/**
 * Shared source-of-truth for broker USD quote routing addresses.
 * Keep this aligned with deployed stable/native quote tokens.
 */
export const DEX_USD_QUOTE_ADDRESS_CONFIG_DEFAULT: DexUsdQuoteAddressConfig = {
  usdtToken: PAIR_DISPLAY_STABLE_QUOTE_ADDRESSES[0] ?? '',
  wethToken: PAIR_DISPLAY_CONFIG_DEFAULT.wrappedNativeAddress,
};

