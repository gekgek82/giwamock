import type { Address, TokenMetadata } from "@/lib/datasources/types";
import type {
  LockDataSource,
  RawLock,
} from "@/lib/datasources/lock/types";
import type {
  Permit2DataSource,
  Permit2SubAllowance,
} from "@/lib/datasources/permit2/types";
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
import type {
  AddLiquidityQuote,
  AddLiquidityQuoteInput,
  DirectQuote,
  DirectQuoteInput,
  EvaluateSwapInput,
  FactoryDefaultFees,
  RemoveLiquidityQuote,
  RemoveLiquidityQuoteInput,
  SwapDataSource,
  SwapEvaluation,
} from "@/lib/datasources/swap/types";
import type { TokenDataSource } from "@/lib/datasources/token/types";
import type {
  GaugeData,
  GaugeInfo,
  PoolWeight,
  VoteDataSource,
} from "@/lib/datasources/vote/types";

const MOCK_GAUGE_ADDRESS =
  "0x0000000000000000000000000000000000000a01" as const;

function symbolFromAddress(address: Address): string {
  const suffix = address.slice(-4).toUpperCase();
  return `T${suffix}`;
}

function metadata(address: Address): TokenMetadata {
  const symbol = symbolFromAddress(address);
  return {
    address,
    symbol,
    name: `Mock ${symbol}`,
    decimals: 18,
  };
}

function applyFee(amount: bigint, feeBps: number): bigint {
  return (amount * BigInt(Math.max(0, 10_000 - feeBps))) / 10_000n;
}

export class MockTokenDataSource implements TokenDataSource {
  async getBalance(): Promise<bigint> {
    return 1_000_000n * 10n ** 18n;
  }

  async getAllowance(): Promise<bigint> {
    return 1_000_000n * 10n ** 18n;
  }

  async getMetadata(tokenAddress: Address): Promise<TokenMetadata | null> {
    return metadata(tokenAddress);
  }
}

export class MockPermit2DataSource implements Permit2DataSource {
  async getAllowance(): Promise<Permit2SubAllowance> {
    return {
      amount: 1_000_000n * 10n ** 18n,
      expiration: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      nonce: 1,
    };
  }
}

export class MockPoolDataSource implements PoolDataSource {
  async getInfo(poolAddress: Address): Promise<PoolInfo> {
    const a = poolAddress.slice(0, 38).padEnd(42, "1") as Address;
    const b = poolAddress.slice(0, 38).padEnd(42, "2") as Address;
    return {
      token0: metadata(a),
      token1: metadata(b),
    };
  }

  async getReserves(): Promise<PoolReserves> {
    return {
      reserve0: 1_000_000n * 10n ** 18n,
      reserve1: 1_000_000n * 10n ** 18n,
      blockTimestampLast: BigInt(Math.floor(Date.now() / 1000)),
    };
  }

  async getFee(
    _poolAddress: Address,
    isStable: boolean,
    _poolType: PoolType,
  ): Promise<PoolFee> {
    void _poolType;
    const feeBasisPoints = isStable ? 5 : 30;
    return {
      feeBasisPoints,
      baseFeeBasisPoints: feeBasisPoints,
      isDynamicFee: false,
    };
  }

  async getDefaultFees(): Promise<DefaultFees> {
    return {
      stableFeeBasisPoints: 5,
      volatileFeeBasisPoints: 30,
    };
  }

  async getCLSlot0(): Promise<CLSlot0> {
    return {
      sqrtPriceX96: 79_228_162_514_264_337_593_543_950_336n,
      tick: 0,
      observationIndex: 0,
      observationCardinality: 1,
      observationCardinalityNext: 1,
      unlocked: true,
      liquidity: 1_000_000n * 10n ** 18n,
    };
  }

  async checkExists(
    tokenA: Address,
    tokenB: Address,
    stable: boolean,
  ): Promise<PoolExistence> {
    const seed = `${tokenA.slice(2, 10)}${tokenB.slice(2, 10)}${stable ? "01" : "02"}`;
    return {
      poolAddress: `0x${seed.padEnd(40, "0")}` as Address,
      exists: true,
    };
  }
}

export class MockLockDataSource implements LockDataSource {
  async getNFTCount(): Promise<number> {
    return 2;
  }

  async getUserLocks(): Promise<RawLock[]> {
    const now = BigInt(Math.floor(Date.now() / 1000));
    return [
      {
        tokenId: 1n,
        amount: 5_000n * 10n ** 18n,
        endTimestamp: now + 180n * 24n * 60n * 60n,
        isPermanent: false,
        votingPower: 1_250n * 10n ** 18n,
      },
      {
        tokenId: 2n,
        amount: 12_000n * 10n ** 18n,
        endTimestamp: now + 365n * 24n * 60n * 60n,
        isPermanent: false,
        votingPower: 6_000n * 10n ** 18n,
      },
    ];
  }

  async getLockData(tokenId: bigint): Promise<RawLock | null> {
    const locks = await this.getUserLocks();
    return locks.find((lock) => lock.tokenId === tokenId) ?? null;
  }
}

export class MockVoteDataSource implements VoteDataSource {
  async getGauge(): Promise<GaugeInfo> {
    return {
      gaugeAddress: null,
      hasGauge: false,
      isAlive: false,
    };
  }

  async getGaugeData(): Promise<GaugeData> {
    return {
      rewardRate: 10n ** 18n,
      totalSupply: 1_000_000n * 10n ** 18n,
      periodFinish: BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60),
      rewardToken: MOCK_GAUGE_ADDRESS,
    };
  }

  async getPoolWeight(): Promise<PoolWeight> {
    return {
      weight: 125_000n * 10n ** 18n,
      totalWeight: 1_000_000n * 10n ** 18n,
    };
  }
}

export class MockSwapDataSource implements SwapDataSource {
  async evaluateSwapPaths(input: EvaluateSwapInput): Promise<SwapEvaluation> {
    const path = input.candidatePaths[0] ?? null;
    const feeBps = path?.some((hop) => hop.stable)
      ? input.stableFeeBps
      : input.volatileFeeBps;
    const output = applyFee(input.amountIn, feeBps || 30);
    return {
      output,
      spotOutput: input.amountIn,
      path,
      isStable: !!path?.some((hop) => hop.stable),
      isCL: !!path?.every((hop) => hop.poolType === "CL"),
      isMixed:
        !!path?.some((hop) => hop.poolType === "CL") &&
        !!path?.some((hop) => hop.poolType !== "CL"),
      quoteInput: input.amountIn,
      clMaxOutput: output * 10n,
      saturationBps: 500,
    };
  }

  async getDirectQuote(input: DirectQuoteInput): Promise<DirectQuote> {
    return {
      output: applyFee(input.amountIn, input.route.stable ? 5 : 30),
      spotOutput: input.amountIn,
      quoteInput: input.amountIn,
    };
  }

  async getAddLiquidityQuote(
    input: AddLiquidityQuoteInput,
  ): Promise<AddLiquidityQuote> {
    const liquidity =
      input.amountADesired < input.amountBDesired
        ? input.amountADesired
        : input.amountBDesired;
    return {
      amountA: input.amountADesired,
      amountB: input.amountBDesired,
      liquidity,
    };
  }

  async getRemoveLiquidityQuote(
    input: RemoveLiquidityQuoteInput,
  ): Promise<RemoveLiquidityQuote> {
    return {
      amountA: input.liquidity,
      amountB: input.liquidity,
    };
  }

  async getFactoryDefaultFees(): Promise<FactoryDefaultFees> {
    return {
      stableFeeBps: 5,
      volatileFeeBps: 30,
    };
  }
}
