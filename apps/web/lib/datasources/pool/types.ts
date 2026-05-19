import type { Address, TokenMetadata } from "@/lib/datasources/types";

export type { TokenMetadata };

/**
 * Pool token metadata — token0/token1 address, symbol, name, decimals.
 * Returned by `PoolDataSource.getInfo`.
 */
export interface PoolInfo {
  token0: TokenMetadata;
  token1: TokenMetadata;
}

/**
 * Pool reserves. For basic (Velodrome v1) pools, `reserve0` and `reserve1`
 * come from `Pool.getReserves()`. Decimals are not yet applied — callers
 * format using the matching `PoolInfo.tokenN.decimals`.
 */
export interface PoolReserves {
  reserve0: bigint;
  reserve1: bigint;
  blockTimestampLast: bigint;
}

/**
 * Pool fee data. `feeBasisPoints` is the fee in bps (e.g. 30 → 0.30%).
 * For CL pools with a dynamic fee module, `baseFeeBasisPoints` is the
 * pool's configured base fee and `feeBasisPoints` is the currently active
 * (possibly dynamic) fee.
 */
export interface PoolFee {
  feeBasisPoints: number;
  baseFeeBasisPoints: number;
  isDynamicFee: boolean;
}

export interface DefaultFees {
  stableFeeBasisPoints: number;
  volatileFeeBasisPoints: number;
}

/**
 * CL pool slot0 state (current price / tick / observation cursor) plus
 * active liquidity. Source: `CLPool.slot0()` + `CLPool.liquidity()`.
 */
export interface CLSlot0 {
  sqrtPriceX96: bigint;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  unlocked: boolean;
  liquidity: bigint;
}

/**
 * Result of `checkExists(tokenA, tokenB, stable)` on a basic pool factory.
 * `exists` is `false` when the factory returns the zero address.
 */
export interface PoolExistence {
  poolAddress: Address | null;
  exists: boolean;
}

export type PoolType = "BASIC" | "CL";

/**
 * The read-only interface every pool data source must implement.
 *
 * Today this is backed by `WagmiPoolDataSource` (direct RPC via viem).
 * A future `GatewayPoolDataSource` will return the same shapes from the
 * gateway's REST endpoints — hooks never need to change.
 */
export interface PoolDataSource {
  getInfo(poolAddress: Address): Promise<PoolInfo>;
  getReserves(poolAddress: Address): Promise<PoolReserves>;
  getFee(
    poolAddress: Address,
    isStable: boolean,
    poolType: PoolType,
  ): Promise<PoolFee>;
  getDefaultFees(): Promise<DefaultFees>;
  getCLSlot0(poolAddress: Address): Promise<CLSlot0>;
  checkExists(
    tokenA: Address,
    tokenB: Address,
    stable: boolean,
  ): Promise<PoolExistence>;
}
