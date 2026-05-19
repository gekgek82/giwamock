/**
 * Conversions from indexer wire format (decimal `bigint` strings) to JavaScript `number`
 * for `double precision` OHLCV columns and chart UIs.
 *
 * - Integer magnitudes in `Number.MIN_SAFE_INTEGER` … `Number.MAX_SAFE_INTEGER` round-trip exactly.
 * - Larger wei-style values become IEEE doubles: fine for **display / charts**, wrong for **settlement**.
 * - Callers may pass `logPrecisionLoss` to surface rare overflow to logs (e.g. debug).
 */

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);

export function parseWireBigInt(s: string): bigint {
  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
}

/**
 * Converts a `bigint` to a finite `number` for persistence and UI.
 * Non-finite `Number(bigint)` results are clamped to ±`Number.MAX_VALUE` so JSON/DB stay finite.
 */
export function bigintToUiDouble(
  value: bigint,
  logPrecisionLoss?: (message: string) => void,
  label?: string,
): number {
  if (value !== 0n && (value > MAX_SAFE || value < MIN_SAFE)) {
    logPrecisionLoss?.(
      `BigInt→number exceeds safe integer range (display/chart use only)${
        label ? `: ${label}` : ''
      }`,
    );
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return value > 0n
      ? Number.MAX_VALUE
      : value < 0n
        ? -Number.MAX_VALUE
        : 0;
  }
  return n;
}
