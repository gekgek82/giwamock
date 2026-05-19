import type { PublicClient } from "viem";
import {
  CLFactoryAbi,
  CLPoolAbi,
  ERC20Abi,
  PoolAbi,
  PoolFactoryAbi,
  SwapFeeModuleAbi,
} from "@giwater/shared/abis";

import { DataSourceError, type Address } from "@/lib/datasources/types";
import type {
  CLSlot0,
  DefaultFees,
  PoolDataSource,
  PoolExistence,
  PoolFee,
  PoolInfo,
  PoolReserves,
  PoolType,
} from "@/lib/datasources/pool/types";

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

/**
 * Addresses this data source needs to resolve factory-level reads. These
 * come from the indexer's `/contracts` endpoint via `useContractAddresses`
 * and are forwarded by `DataSourceProvider`.
 */
export interface PoolDataSourceAddresses {
  poolFactory?: Address;
  clPoolFactory?: Address;
}

/**
 * On-chain implementation of `PoolDataSource`. Reads are performed via
 * viem's `publicClient`. Multiple related reads are batched with
 * `multicall` where possible to match the behaviour of the original
 * wagmi `useReadContracts` hooks.
 */
export class WagmiPoolDataSource implements PoolDataSource {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly addresses: PoolDataSourceAddresses,
  ) {}

  async getInfo(poolAddress: Address): Promise<PoolInfo> {
    const [token0Raw, token1Raw] = await this.publicClient.multicall({
      contracts: [
        { address: poolAddress, abi: PoolAbi, functionName: "token0" },
        { address: poolAddress, abi: PoolAbi, functionName: "token1" },
      ],
      allowFailure: false,
    });
    const token0Addr = token0Raw as Address;
    const token1Addr = token1Raw as Address;

    const [sym0, name0, dec0, sym1, name1, dec1] =
      await this.publicClient.multicall({
        contracts: [
          { address: token0Addr, abi: ERC20Abi, functionName: "symbol" },
          { address: token0Addr, abi: ERC20Abi, functionName: "name" },
          { address: token0Addr, abi: ERC20Abi, functionName: "decimals" },
          { address: token1Addr, abi: ERC20Abi, functionName: "symbol" },
          { address: token1Addr, abi: ERC20Abi, functionName: "name" },
          { address: token1Addr, abi: ERC20Abi, functionName: "decimals" },
        ],
        allowFailure: true,
      });

    return {
      token0: {
        address: token0Addr,
        symbol: (sym0.result as string | undefined) ?? "UNKNOWN",
        name: (name0.result as string | undefined) ?? "Unknown Token",
        decimals: Number(dec0.result ?? 18),
      },
      token1: {
        address: token1Addr,
        symbol: (sym1.result as string | undefined) ?? "UNKNOWN",
        name: (name1.result as string | undefined) ?? "Unknown Token",
        decimals: Number(dec1.result ?? 18),
      },
    };
  }

  async getReserves(poolAddress: Address): Promise<PoolReserves> {
    const data = (await this.publicClient.readContract({
      address: poolAddress,
      abi: PoolAbi,
      functionName: "getReserves",
    })) as readonly [bigint, bigint, bigint];

    return {
      reserve0: data[0],
      reserve1: data[1],
      blockTimestampLast: data[2],
    };
  }

  async getFee(
    poolAddress: Address,
    isStable: boolean,
    poolType: PoolType,
  ): Promise<PoolFee> {
    if (poolType === "CL") {
      return this.getCLFee(poolAddress);
    }
    return this.getBasicFee(poolAddress, isStable);
  }

  private async getBasicFee(
    poolAddress: Address,
    isStable: boolean,
  ): Promise<PoolFee> {
    const factory = this.addresses.poolFactory;
    if (!factory) {
      throw new DataSourceError(
        "poolFactory address is not available",
        "NOT_READY",
      );
    }

    const feeBps = (await this.publicClient.readContract({
      address: factory,
      abi: PoolFactoryAbi,
      functionName: "getFee",
      args: [poolAddress, isStable],
    })) as bigint;

    const bps = Number(feeBps);
    return {
      feeBasisPoints: bps,
      baseFeeBasisPoints: bps,
      isDynamicFee: false,
    };
  }

  private async getCLFee(poolAddress: Address): Promise<PoolFee> {
    const clFactory = this.addresses.clPoolFactory;
    if (!clFactory) {
      throw new DataSourceError(
        "clPoolFactory address is not available",
        "NOT_READY",
      );
    }

    const [baseFeeRaw, swapFeeModule] = await this.publicClient.multicall({
      contracts: [
        { address: poolAddress, abi: CLPoolAbi, functionName: "fee" },
        {
          address: clFactory,
          abi: CLFactoryAbi,
          functionName: "swapFeeModule",
        },
      ],
      allowFailure: false,
    });

    // CLPool.fee() is uint24 in 1e6 units — divide by 100 to get bps.
    const baseBps = Math.round(Number(baseFeeRaw) / 100);
    const hasModule =
      !!swapFeeModule && (swapFeeModule as Address) !== ZERO_ADDRESS;

    if (!hasModule) {
      return {
        feeBasisPoints: baseBps,
        baseFeeBasisPoints: baseBps,
        isDynamicFee: false,
      };
    }

    const dynamicFeeRaw = (await this.publicClient.readContract({
      address: swapFeeModule as Address,
      abi: SwapFeeModuleAbi,
      functionName: "getFee",
      args: [poolAddress],
    })) as bigint;

    const currentBps = Math.round(Number(dynamicFeeRaw) / 100);
    return {
      feeBasisPoints: currentBps,
      baseFeeBasisPoints: baseBps,
      isDynamicFee: true,
    };
  }

  async getDefaultFees(): Promise<DefaultFees> {
    const factory = this.addresses.poolFactory;
    if (!factory) {
      throw new DataSourceError(
        "poolFactory address is not available",
        "NOT_READY",
      );
    }

    const [stableFee, volatileFee] = await this.publicClient.multicall({
      contracts: [
        { address: factory, abi: PoolFactoryAbi, functionName: "stableFee" },
        {
          address: factory,
          abi: PoolFactoryAbi,
          functionName: "volatileFee",
        },
      ],
      allowFailure: false,
    });

    return {
      stableFeeBasisPoints: Number(stableFee),
      volatileFeeBasisPoints: Number(volatileFee),
    };
  }

  async getCLSlot0(poolAddress: Address): Promise<CLSlot0> {
    const [slot0, liquidity] = await this.publicClient.multicall({
      contracts: [
        { address: poolAddress, abi: CLPoolAbi, functionName: "slot0" },
        { address: poolAddress, abi: CLPoolAbi, functionName: "liquidity" },
      ],
      allowFailure: false,
    });

    const tuple = slot0 as readonly [
      bigint,
      number,
      number,
      number,
      number,
      boolean,
    ];

    return {
      sqrtPriceX96: tuple[0],
      tick: Number(tuple[1]),
      observationIndex: Number(tuple[2]),
      observationCardinality: Number(tuple[3]),
      observationCardinalityNext: Number(tuple[4]),
      unlocked: Boolean(tuple[5]),
      liquidity: liquidity as bigint,
    };
  }

  async checkExists(
    tokenA: Address,
    tokenB: Address,
    stable: boolean,
  ): Promise<PoolExistence> {
    const factory = this.addresses.poolFactory;
    if (!factory) {
      throw new DataSourceError(
        "poolFactory address is not available",
        "NOT_READY",
      );
    }

    const result = (await this.publicClient.readContract({
      address: factory,
      abi: PoolFactoryAbi,
      functionName: "getPool",
      args: [tokenA, tokenB, stable],
    })) as Address;

    const exists = result !== ZERO_ADDRESS;
    return {
      poolAddress: exists ? result : null,
      exists,
    };
  }
}
