/**
 * PoolCreated / CLPoolCreated may pass `address` (legacy PoolFactory) or
 * `TokenInfo` struct `{ token, totalSupply, decimals, name, symbol }` (GiwaUniversalRouter).
 */
export type ParsedTokenSide = {
  address: `0x${string}`;
  decimals?: number;
  name?: string;
  symbol?: string;
  totalSupply?: bigint;
};

function parseTotalSupply(v: unknown): bigint | undefined {
  if (typeof v === "bigint") return v;
  if (typeof v === "string" && v.length > 0) {
    try {
      return BigInt(v);
    } catch {
      return undefined;
    }
  }
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return BigInt(Math.floor(v));
  }
  return undefined;
}

export function parseAddressOrTokenInfo(arg: unknown): ParsedTokenSide | null {
  if (typeof arg === "string" && /^0x[a-fA-F0-9]{40}$/.test(arg)) {
    return { address: arg.toLowerCase() as `0x${string}` };
  }
  if (arg && typeof arg === "object" && "token" in arg) {
    const o = arg as Record<string, unknown>;
    const token = o.token;
    if (typeof token === "string" && /^0x[a-fA-F0-9]{40}$/.test(token)) {
      const out: ParsedTokenSide = {
        address: token.toLowerCase() as `0x${string}`,
      };
      const dec = o.decimals;
      if (typeof dec === "number" && Number.isFinite(dec) && dec >= 0 && dec <= 255) {
        out.decimals = Math.floor(dec);
      } else if (typeof dec === "bigint") {
        const n = Number(dec);
        if (n >= 0 && n <= 255) out.decimals = n;
      }
      if (typeof o.name === "string") out.name = o.name;
      if (typeof o.symbol === "string") out.symbol = o.symbol;
      const ts = parseTotalSupply(o.totalSupply);
      if (ts !== undefined) out.totalSupply = ts;
      return out;
    }
  }
  return null;
}
