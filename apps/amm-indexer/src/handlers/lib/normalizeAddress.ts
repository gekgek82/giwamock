const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/**
 * Canonical lowercase hex for DB + broker (matches broker `lc()` on addresses).
 * Invalid / missing values fall back to zero address with a warning so handlers never throw here.
 */
export function lcAddr(addr: unknown): `0x${string}` {
  const s = typeof addr === "string" ? addr.trim() : "";
  if (!ADDR_RE.test(s)) {
    console.warn(
      `[amm-indexer] lcAddr: invalid EVM address ${JSON.stringify(addr)} → ${ZERO_ADDR}`,
    );
    return ZERO_ADDR as `0x${string}`;
  }
  return s.toLowerCase() as `0x${string}`;
}
