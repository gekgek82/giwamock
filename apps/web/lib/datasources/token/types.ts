import type { Address, TokenMetadata } from "@/lib/datasources/types";

export type { TokenMetadata };

/**
 * Read-only interface for ERC-20 token queries.
 *
 * `getMetadata` returns `null` when the given address is not a valid ERC-20
 * (e.g. calls revert, symbol returns empty). Callers use this signal to
 * distinguish "fetching" from "confirmed invalid".
 */
export interface TokenDataSource {
  getBalance(tokenAddress: Address, walletAddress: Address): Promise<bigint>;
  getAllowance(
    tokenAddress: Address,
    owner: Address,
    spender: Address,
  ): Promise<bigint>;
  getMetadata(tokenAddress: Address): Promise<TokenMetadata | null>;
}
