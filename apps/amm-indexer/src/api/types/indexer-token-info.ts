/**
 * Matches on-chain `IGiwaUniversalRouter.TokenInfo` for API responses
 * (GiwaUniversalRouter `PoolCreated` / `CLPoolCreated` tuple args).
 */
export interface IndexerTokenInfoJson {
  /** ERC-20 contract address. */
  token: `0x${string}`;
  /** `uint256` totalSupply as decimal string (JSON-safe). */
  totalSupply: string;
  /** `uint8` decimals. */
  decimals: number;
  name: string;
  symbol: string;
}

export function buildIndexerTokenInfoJson(args: {
  token: `0x${string}`;
  totalSupply: bigint | null | undefined;
  decimals: number | null | undefined;
  name: string | null | undefined;
  symbol: string | null | undefined;
}): IndexerTokenInfoJson {
  const d = args.decimals;
  return {
    token: args.token,
    totalSupply:
      args.totalSupply !== null && args.totalSupply !== undefined
        ? args.totalSupply.toString()
        : "0",
    decimals:
      typeof d === "number" && Number.isFinite(d) && d >= 0 && d <= 255
        ? Math.floor(d)
        : 0,
    name: args.name ?? "",
    symbol: args.symbol ?? "",
  };
}
