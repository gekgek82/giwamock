import type { Address } from "@/lib/datasources/types";

/**
 * Result of `Permit2.allowance(owner, token, spender)`: the sub-allowance
 * granted by the user to `spender` through Permit2, with the associated
 * deadline (`expiration`) and the monotonic `nonce` required for the next
 * PermitSingle signature.
 */
export interface Permit2SubAllowance {
  amount: bigint;
  expiration: number;
  nonce: number;
}

/**
 * Permit2 read-only queries. The one-time ERC-20→Permit2 allowance is NOT
 * here — it's a plain ERC-20 allowance and lives on `TokenDataSource`.
 */
export interface Permit2DataSource {
  getAllowance(
    permit2Address: Address,
    tokenAddress: Address,
    owner: Address,
    spender: Address,
  ): Promise<Permit2SubAllowance>;
}
