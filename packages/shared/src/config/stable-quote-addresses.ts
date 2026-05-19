/**
 * Canonical ERC-20 addresses treated as **USD-ish stable quote** tokens on Giwa Sepolia (chain 91342).
 *
 * Single source for:
 * - Broker pair display (`PAIR_DISPLAY_CONFIG_DEFAULT`)
 * - AMM indexer `inferIndexerPairPriceOrientation` defaults (`PAIR_INDEXER_ORIENTATION_PRESET_WGIWA`)
 *
 * Add USDT and other stables here when deployed; env overrides remain supported in `apps/amm-indexer`.
 */

export type StableQuoteAddress = `0x${string}`;

export const DEFAULT_GIWA_STABLE_QUOTE_ADDRESSES: readonly StableQuoteAddress[] = [
  '0xD5B2213490b06fCA88C928564cDb2091f45a401c', // USDC
  '0x964Cf18C541efF12669a289B6E38686F5824475A', // USDT
];
