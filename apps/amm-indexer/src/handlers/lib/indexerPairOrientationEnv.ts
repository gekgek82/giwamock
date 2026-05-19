import type { InferIndexerPairPriceOrientationOptions } from "@giwater/shared";
import { PAIR_INDEXER_ORIENTATION_PRESET_WGIWA } from "@giwater/shared";

/**
 * Env (optional overrides; when unset, uses `PAIR_INDEXER_ORIENTATION_PRESET_WGIWA` from `@giwater/shared`):
 * - `INDEXER_PAIR_STABLE_ADDRESSES` — comma-separated 0x… (USDC, USDT, …)
 * - `INDEXER_PAIR_NETWORK_QUOTE_TOKEN` — wrapped native / network quote; when in the pair and no stable, used as display quote
 */
export function getIndexerPairOrientationOptions(): InferIndexerPairPriceOrientationOptions {
  const preset = PAIR_INDEXER_ORIENTATION_PRESET_WGIWA;
  const raw = process.env.INDEXER_PAIR_STABLE_ADDRESSES ?? "";
  const fromEnv = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const stableAddresses =
    fromEnv.length > 0
      ? fromEnv
      : preset.stableAddresses.map((a) => a.trim().toLowerCase()).filter(Boolean);

  const n = (process.env.INDEXER_PAIR_NETWORK_QUOTE_TOKEN ?? "").trim();
  const networkQuoteTokenAddress = n
    ? n.toLowerCase()
    : preset.networkQuoteTokenAddress?.trim().toLowerCase();

  return { stableAddresses, networkQuoteTokenAddress };
}
