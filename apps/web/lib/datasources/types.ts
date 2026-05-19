/**
 * Common types for data sources.
 *
 * Data sources are the abstraction layer between the UI (hooks) and the
 * backend — whether that backend is the on-chain RPC (via wagmi/viem) today
 * or a gateway REST API tomorrow. Each domain (pool, token, vote, ...) has
 * its own interface and multiple implementations.
 */

export type Address = `0x${string}`;

/**
 * ERC-20 token metadata shared across domains. `decimals` defaults to 18 when
 * the contract doesn't expose it (non-compliant tokens).
 */
export interface TokenMetadata {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
}

/**
 * Error raised by a data source implementation. Callers may inspect the
 * `code` to distinguish "not ready" (e.g. missing contract address) from
 * actual fetch failures.
 */
export class DataSourceError extends Error {
  public code:
    | "NOT_READY"
    | "NETWORK"
    | "DECODE"
    | "UNKNOWN";
  public cause?: unknown;

  constructor(
    message: string,
    code: DataSourceError["code"] = "UNKNOWN",
    cause?: unknown,
  ) {
    super(message);
    this.name = "DataSourceError";
    this.code = code;
    this.cause = cause;
  }
}
