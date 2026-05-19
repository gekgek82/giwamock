export const PAIR_OHLCV_EVENT = 'pair.ohlcv' as const;

export interface PairOhlcvUpdateDto {
  /** Lowercase 0x pool address. */
  pool: string;
  /** Block timestamp of the triggering swap (unix seconds). */
  ts: number;
  /** Current price — quote tokens per 1 base token (human units). */
  price: number;
  /** UTC-day open price. */
  open: number;
  /** UTC-day high price. */
  high: number;
  /** UTC-day low price. */
  low: number;
  /** UTC-day cumulative base token volume (human units). */
  baseVolume: number;
  /** UTC-day cumulative quote token volume (human units). */
  quoteVolume: number;
}
