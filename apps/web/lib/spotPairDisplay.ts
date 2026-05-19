import type { AdminPoolInfo } from "@/types/admin";

type PoolPick = Pick<
  AdminPoolInfo,
  | "baseSymbol"
  | "quoteSymbol"
  | "baseAddress"
  | "quoteAddress"
  | "token0Address"
  | "token1Address"
  | "token0Symbol"
  | "token1Symbol"
>;

function trimStr(s: string | undefined | null): string {
  return typeof s === "string" ? s.trim() : "";
}

/**
 * Human-readable **BASE / QUOTE** labels aligned with `SpotPairRecordDto`:
 * use `baseSymbol` / `quoteSymbol` when present; otherwise resolve from
 * `base` / `quote` addresses vs on-chain `token0` / `token1` slot symbols.
 *
 * Do **not** use `token0Symbol`–`token1Symbol` alone for pair display — when
 * base is token1, slot order is reversed vs ticker orientation (see API docs on DTO).
 */
export function spotPairBaseQuoteLabels(pool: PoolPick): {
  baseSymbol: string;
  quoteSymbol: string;
} {
  let baseSymbol = trimStr(pool.baseSymbol);
  let quoteSymbol = trimStr(pool.quoteSymbol);

  const t0 = trimStr(pool.token0Address).toLowerCase();
  const t1 = trimStr(pool.token1Address).toLowerCase();
  const b = trimStr(pool.baseAddress).toLowerCase();
  const q = trimStr(pool.quoteAddress).toLowerCase();

  const symAt = (addr: string): string => {
    if (!addr || !t0 || !t1) return "";
    if (addr === t0) return trimStr(pool.token0Symbol);
    if (addr === t1) return trimStr(pool.token1Symbol);
    return "";
  };

  if (!baseSymbol && b) baseSymbol = symAt(b);
  if (!quoteSymbol && q) quoteSymbol = symAt(q);

  return { baseSymbol, quoteSymbol };
}
