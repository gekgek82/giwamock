import type { Abi, PublicClient } from "viem";
import {
  CLPoolAbi as CLPoolAbiRaw,
  PoolFactoryAbi as PoolFactoryAbiRaw,
  RouterAbi as RouterAbiRaw,
} from "@giwater/shared/abis";

import { DataSourceError, type Address } from "@/lib/datasources/types";
import {
  classifyPath,
  computeBasicQuote,
  computeCLMaxOutput,
  computeCLQuote,
  SPOT_REF_AMOUNT,
} from "@/lib/swap/math";
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
  SwapPoolSnapshot,
  SwapRoute,
} from "@/lib/datasources/swap/types";

const CLPoolAbi = CLPoolAbiRaw as Abi;
const RouterAbi = RouterAbiRaw as Abi;
const PoolFactoryAbi = PoolFactoryAbiRaw as Abi;

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

export interface SwapDataSourceAddresses {
  router?: Address;
  poolFactory?: Address;
}

const EMPTY_EVAL: SwapEvaluation = {
  output: 0n,
  spotOutput: 0n,
  path: null,
  isStable: false,
  isCL: false,
  isMixed: false,
  quoteInput: 0n,
  clMaxOutput: 0n,
  saturationBps: 0,
};

/**
 * Saturation (bps) = hopOutput / hopMaxOutput. Clamped to [0, 10000].
 * Returns 10000 ("fully saturated") when hopMaxOutput is 0 — a pool with
 * no reserve can't service any output.
 */
function hopSaturationBps(hopOutput: bigint, hopMaxOutput: bigint): number {
  if (hopMaxOutput <= 0n) return 10_000;
  if (hopOutput <= 0n) return 0;
  const ratio = Number((hopOutput * 10_000n) / hopMaxOutput);
  if (ratio >= 10_000) return 10_000;
  if (ratio < 0) return 0;
  return ratio;
}

type MulticallResults = ReadonlyArray<
  { status: "success"; result: unknown } | { status: "failure" }
>;

interface CandidateMeta {
  type: "BASIC" | "CL" | "MIXED";
  callCount: number;
  path: SwapRoute[];
}

/**
 * On-chain implementation of `SwapDataSource`. Batches all per-candidate
 * reads into a single `multicall`, then runs the same math helpers that
 * the (legacy) `useSwapQuote` hook used inline.
 */
export class WagmiSwapDataSource implements SwapDataSource {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly addresses: SwapDataSourceAddresses,
  ) {}

  async evaluateSwapPaths(input: EvaluateSwapInput): Promise<SwapEvaluation> {
    const {
      candidatePaths,
      pools,
      amountIn,
      stableFeeBps,
      volatileFeeBps,
    } = input;
    const router = this.addresses.router;
    const factory = this.addresses.poolFactory ?? ZERO_ADDRESS;

    if (!router || candidatePaths.length === 0 || amountIn === 0n) {
      return EMPTY_EVAL;
    }

    const { contracts, meta } = buildBatch(
      candidatePaths,
      router,
      factory,
      amountIn,
    );
    if (contracts.length === 0) {
      return EMPTY_EVAL;
    }

    const batchData = await this.publicClient.multicall({
      contracts,
      allowFailure: true,
    });

    return pickBestEvaluation({
      batchData,
      meta,
      amountIn,
      factory,
      pools,
      stableFeeBps,
      volatileFeeBps,
    });
  }

  async getDirectQuote(input: DirectQuoteInput): Promise<DirectQuote> {
    const { route, amountIn, poolAddress } = input;
    const router = this.addresses.router;
    const factory = this.addresses.poolFactory ?? ZERO_ADDRESS;
    if (amountIn === 0n) {
      return { output: 0n, spotOutput: 0n, quoteInput: 0n };
    }

    if (route.poolType === "CL") {
      if (!poolAddress) {
        return { output: 0n, spotOutput: 0n, quoteInput: 0n };
      }

      const results = await this.publicClient.multicall({
        contracts: [
          { address: poolAddress, abi: CLPoolAbi, functionName: "slot0" },
          { address: poolAddress, abi: CLPoolAbi, functionName: "liquidity" },
          { address: poolAddress, abi: CLPoolAbi, functionName: "fee" },
          { address: poolAddress, abi: CLPoolAbi, functionName: "token0" },
        ],
        allowFailure: true,
      });

      const parsed = parseCLHop(results, 0);
      if (!parsed) return { output: 0n, spotOutput: 0n, quoteInput: 0n };

      const { sqrtPriceX96, liquidity, fee, token0 } = parsed;
      const zeroForOne = route.from.toLowerCase() === token0.toLowerCase();
      const output = computeCLQuote(
        sqrtPriceX96,
        liquidity,
        fee,
        amountIn,
        zeroForOne,
      );
      const spotOutput = computeCLQuote(
        sqrtPriceX96,
        liquidity,
        fee,
        SPOT_REF_AMOUNT,
        zeroForOne,
      );
      return { output, spotOutput, quoteInput: amountIn };
    }

    // BASIC path — Router.getAmountsOut(quote + spot)
    if (!router || factory === ZERO_ADDRESS) {
      throw new DataSourceError(
        "router and poolFactory addresses are required for basic quotes",
        "NOT_READY",
      );
    }

    const routes = [
      {
        from: route.from,
        to: route.to,
        stable: route.stable,
        factory,
      },
    ];

    const [quoteData, spotData] = await this.publicClient.multicall({
      contracts: [
        {
          address: router,
          abi: RouterAbi,
          functionName: "getAmountsOut",
          args: [amountIn, routes],
        },
        {
          address: router,
          abi: RouterAbi,
          functionName: "getAmountsOut",
          args: [SPOT_REF_AMOUNT, routes],
        },
      ],
      allowFailure: true,
    });

    const quoteAmounts =
      quoteData.status === "success"
        ? (quoteData.result as readonly bigint[])
        : undefined;
    const spotAmounts =
      spotData.status === "success"
        ? (spotData.result as readonly bigint[])
        : undefined;

    return {
      output:
        quoteAmounts && quoteAmounts.length > 0
          ? quoteAmounts[quoteAmounts.length - 1]
          : 0n,
      quoteInput:
        quoteAmounts && quoteAmounts.length > 0 ? quoteAmounts[0] : 0n,
      spotOutput:
        spotAmounts && spotAmounts.length > 0
          ? spotAmounts[spotAmounts.length - 1]
          : 0n,
    };
  }

  async getAddLiquidityQuote(
    input: AddLiquidityQuoteInput,
  ): Promise<AddLiquidityQuote> {
    const { router, factory } = this.requireRouterAndFactory();

    const [amountA, amountB, liquidity] = (await this.publicClient.readContract(
      {
        address: router,
        abi: RouterAbi,
        functionName: "quoteAddLiquidity",
        args: [
          input.tokenA,
          input.tokenB,
          input.stable,
          factory,
          input.amountADesired,
          input.amountBDesired,
        ],
      },
    )) as readonly [bigint, bigint, bigint];

    return { amountA, amountB, liquidity };
  }

  async getRemoveLiquidityQuote(
    input: RemoveLiquidityQuoteInput,
  ): Promise<RemoveLiquidityQuote> {
    const { router, factory } = this.requireRouterAndFactory();

    const [amountA, amountB] = (await this.publicClient.readContract({
      address: router,
      abi: RouterAbi,
      functionName: "quoteRemoveLiquidity",
      args: [
        input.tokenA,
        input.tokenB,
        input.stable,
        factory,
        input.liquidity,
      ],
    })) as readonly [bigint, bigint];

    return { amountA, amountB };
  }

  async getFactoryDefaultFees(): Promise<FactoryDefaultFees> {
    const factory = this.addresses.poolFactory;
    if (!factory) {
      // Conservative defaults match the hook's legacy fallback.
      return { stableFeeBps: 5, volatileFeeBps: 30 };
    }

    const [stable, volatile] = await this.publicClient.multicall({
      contracts: [
        { address: factory, abi: PoolFactoryAbi, functionName: "stableFee" },
        {
          address: factory,
          abi: PoolFactoryAbi,
          functionName: "volatileFee",
        },
      ],
      allowFailure: true,
    });

    return {
      stableFeeBps:
        stable.status === "success" ? Number(stable.result) : 5,
      volatileFeeBps:
        volatile.status === "success" ? Number(volatile.result) : 30,
    };
  }

  private requireRouterAndFactory(): { router: Address; factory: Address } {
    const router = this.addresses.router;
    const factory = this.addresses.poolFactory;
    if (!router || !factory) {
      throw new DataSourceError(
        "router and poolFactory addresses are required",
        "NOT_READY",
      );
    }
    return { router, factory };
  }
}

interface ContractCall {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}

function buildBatch(
  candidatePaths: SwapRoute[][],
  router: Address,
  factory: Address,
  amountIn: bigint,
): { contracts: ContractCall[]; meta: CandidateMeta[] } {
  const contracts: ContractCall[] = [];
  const meta: CandidateMeta[] = [];

  for (const path of candidatePaths) {
    const type = classifyPath(path);

    if (type === "CL") {
      let callCount = 0;
      for (const route of path) {
        if (!route.poolAddress) continue;
        contracts.push(
          {
            address: route.poolAddress,
            abi: CLPoolAbi,
            functionName: "slot0",
          },
          {
            address: route.poolAddress,
            abi: CLPoolAbi,
            functionName: "liquidity",
          },
          {
            address: route.poolAddress,
            abi: CLPoolAbi,
            functionName: "fee",
          },
          {
            address: route.poolAddress,
            abi: CLPoolAbi,
            functionName: "token0",
          },
        );
        callCount += 4;
      }
      meta.push({ type: "CL", callCount, path });
    } else if (type === "MIXED") {
      let callCount = 0;
      for (const route of path) {
        if (route.poolType === "CL" && route.poolAddress) {
          contracts.push(
            {
              address: route.poolAddress,
              abi: CLPoolAbi,
              functionName: "slot0",
            },
            {
              address: route.poolAddress,
              abi: CLPoolAbi,
              functionName: "liquidity",
            },
            {
              address: route.poolAddress,
              abi: CLPoolAbi,
              functionName: "fee",
            },
            {
              address: route.poolAddress,
              abi: CLPoolAbi,
              functionName: "token0",
            },
          );
          callCount += 4;
        }
      }
      meta.push({ type: "MIXED", callCount, path });
    } else {
      const volatileRoutes = path.map((r) => ({
        from: r.from,
        to: r.to,
        stable: false,
        factory,
      }));
      const stableRoutes = path.map((r) => ({
        from: r.from,
        to: r.to,
        stable: true,
        factory,
      }));
      contracts.push(
        {
          address: router,
          abi: RouterAbi,
          functionName: "getAmountsOut",
          args: [amountIn, volatileRoutes],
        },
        {
          address: router,
          abi: RouterAbi,
          functionName: "getAmountsOut",
          args: [amountIn, stableRoutes],
        },
        {
          address: router,
          abi: RouterAbi,
          functionName: "getAmountsOut",
          args: [SPOT_REF_AMOUNT, volatileRoutes],
        },
        {
          address: router,
          abi: RouterAbi,
          functionName: "getAmountsOut",
          args: [SPOT_REF_AMOUNT, stableRoutes],
        },
      );
      meta.push({ type: "BASIC", callCount: 4, path });
    }
  }

  return { contracts, meta };
}

function parseCLHop(
  results: MulticallResults,
  offset: number,
): {
  sqrtPriceX96: bigint;
  liquidity: bigint;
  fee: bigint;
  token0: string;
} | null {
  const slot0Entry = results[offset];
  const liquidityEntry = results[offset + 1];
  const feeEntry = results[offset + 2];
  const token0Entry = results[offset + 3];

  if (
    !slot0Entry ||
    slot0Entry.status !== "success" ||
    !liquidityEntry ||
    liquidityEntry.status !== "success" ||
    !feeEntry ||
    feeEntry.status !== "success" ||
    !token0Entry ||
    token0Entry.status !== "success"
  ) {
    return null;
  }

  const slot0 = slot0Entry.result as readonly [bigint, number, ...unknown[]];
  return {
    sqrtPriceX96: slot0[0],
    liquidity: liquidityEntry.result as bigint,
    fee: BigInt(feeEntry.result as number | bigint),
    token0: token0Entry.result as string,
  };
}

function pickBestEvaluation(params: {
  batchData: MulticallResults;
  meta: CandidateMeta[];
  amountIn: bigint;
  factory: Address;
  pools: SwapPoolSnapshot[];
  stableFeeBps: number;
  volatileFeeBps: number;
}): SwapEvaluation {
  const {
    batchData,
    meta,
    amountIn,
    factory,
    pools,
    stableFeeBps,
    volatileFeeBps,
  } = params;

  let bestOutput = 0n;
  let best: SwapEvaluation = EMPTY_EVAL;
  let offset = 0;

  for (const candidate of meta) {
    if (candidate.type === "CL") {
      let currentAmount = amountIn;
      let currentSpotAmount = SPOT_REF_AMOUNT;
      let minMaxOutput = 0n;
      let maxSaturation = 0;
      let valid = true;

      for (let i = 0; i < candidate.path.length; i++) {
        const hop = parseCLHop(batchData, offset + i * 4);
        if (!hop) {
          valid = false;
          break;
        }

        const zeroForOne =
          candidate.path[i].from.toLowerCase() === hop.token0.toLowerCase();
        const hopMax = computeCLMaxOutput(
          hop.sqrtPriceX96,
          hop.liquidity,
          zeroForOne,
        );
        if (i === 0) {
          minMaxOutput = hopMax;
        } else if (hopMax < minMaxOutput) {
          minMaxOutput = hopMax;
        }

        currentAmount = computeCLQuote(
          hop.sqrtPriceX96,
          hop.liquidity,
          hop.fee,
          currentAmount,
          zeroForOne,
        );
        currentSpotAmount = computeCLQuote(
          hop.sqrtPriceX96,
          hop.liquidity,
          hop.fee,
          currentSpotAmount,
          zeroForOne,
        );
        if (currentAmount === 0n) {
          valid = false;
          break;
        }

        const sat = hopSaturationBps(currentAmount, hopMax);
        if (sat > maxSaturation) maxSaturation = sat;
      }

      offset += candidate.callCount;

      if (valid && currentAmount > bestOutput) {
        bestOutput = currentAmount;
        best = {
          output: currentAmount,
          spotOutput: currentSpotAmount,
          path: candidate.path.map((r) => ({ ...r, factory })),
          isStable: false,
          isCL: true,
          isMixed: false,
          quoteInput: amountIn,
          clMaxOutput: minMaxOutput,
          saturationBps: maxSaturation,
        };
      }
    } else if (candidate.type === "MIXED") {
      let currentAmount = amountIn;
      let currentSpotAmount = SPOT_REF_AMOUNT;
      let clReadOffset = offset;
      let maxSaturation = 0;
      let valid = true;

      for (const route of candidate.path) {
        let hopOutput: bigint;
        let hopMaxOut: bigint;

        if (route.poolType === "CL") {
          const hop = parseCLHop(batchData, clReadOffset);
          clReadOffset += 4;
          if (!hop) {
            valid = false;
            break;
          }
          const zeroForOne =
            route.from.toLowerCase() === hop.token0.toLowerCase();
          hopMaxOut = computeCLMaxOutput(
            hop.sqrtPriceX96,
            hop.liquidity,
            zeroForOne,
          );
          hopOutput = computeCLQuote(
            hop.sqrtPriceX96,
            hop.liquidity,
            hop.fee,
            currentAmount,
            zeroForOne,
          );
          currentAmount = hopOutput;
          currentSpotAmount = computeCLQuote(
            hop.sqrtPriceX96,
            hop.liquidity,
            hop.fee,
            currentSpotAmount,
            zeroForOne,
          );
        } else {
          const pool = pools.find(
            (p) =>
              p.address.toLowerCase() === route.poolAddress?.toLowerCase(),
          );
          if (!pool) {
            valid = false;
            break;
          }
          const fromLower = route.from.toLowerCase();
          const isToken0In = pool.token0.address.toLowerCase() === fromLower;
          const reserveIn = BigInt(isToken0In ? pool.reserve0 : pool.reserve1);
          const reserveOut = BigInt(isToken0In ? pool.reserve1 : pool.reserve0);

          const stableOut = computeBasicQuote(
            reserveIn,
            reserveOut,
            stableFeeBps,
            currentAmount,
          );
          const volatileOut = computeBasicQuote(
            reserveIn,
            reserveOut,
            volatileFeeBps,
            currentAmount,
          );
          hopOutput = stableOut > volatileOut ? stableOut : volatileOut;
          currentAmount = hopOutput;
          hopMaxOut = reserveOut;

          const stableSpot = computeBasicQuote(
            reserveIn,
            reserveOut,
            stableFeeBps,
            currentSpotAmount,
          );
          const volatileSpot = computeBasicQuote(
            reserveIn,
            reserveOut,
            volatileFeeBps,
            currentSpotAmount,
          );
          currentSpotAmount =
            stableSpot > volatileSpot ? stableSpot : volatileSpot;
        }

        if (currentAmount === 0n) {
          valid = false;
          break;
        }

        const sat = hopSaturationBps(hopOutput, hopMaxOut);
        if (sat > maxSaturation) maxSaturation = sat;
      }

      offset += candidate.callCount;

      if (valid && currentAmount > bestOutput) {
        bestOutput = currentAmount;
        best = {
          output: currentAmount,
          spotOutput: currentSpotAmount,
          path: candidate.path.map((r) => ({ ...r, factory })),
          isStable: false,
          isCL: false,
          isMixed: true,
          quoteInput: amountIn,
          clMaxOutput: 0n,
          saturationBps: maxSaturation,
        };
      }
    } else {
      // BASIC
      const volatileEntry = batchData[offset];
      const stableEntry = batchData[offset + 1];
      const spotVolatileEntry = batchData[offset + 2];
      const spotStableEntry = batchData[offset + 3];
      offset += 4;

      const volatileAmounts =
        volatileEntry?.status === "success"
          ? (volatileEntry.result as readonly bigint[])
          : undefined;
      const stableAmounts =
        stableEntry?.status === "success"
          ? (stableEntry.result as readonly bigint[])
          : undefined;
      const spotVolatileAmounts =
        spotVolatileEntry?.status === "success"
          ? (spotVolatileEntry.result as readonly bigint[])
          : undefined;
      const spotStableAmounts =
        spotStableEntry?.status === "success"
          ? (spotStableEntry.result as readonly bigint[])
          : undefined;

      const volatileOut =
        volatileAmounts && volatileAmounts.length > 0
          ? volatileAmounts[volatileAmounts.length - 1]
          : 0n;
      const stableOut =
        stableAmounts && stableAmounts.length > 0
          ? stableAmounts[stableAmounts.length - 1]
          : 0n;

      const isStable = stableOut > volatileOut;
      const basicBest = isStable ? stableOut : volatileOut;
      const winningAmounts = isStable ? stableAmounts : volatileAmounts;
      const quoteInput =
        winningAmounts && winningAmounts.length > 0 ? winningAmounts[0] : 0n;
      const spotOutput = isStable
        ? spotStableAmounts && spotStableAmounts.length > 0
          ? spotStableAmounts[spotStableAmounts.length - 1]
          : 0n
        : spotVolatileAmounts && spotVolatileAmounts.length > 0
          ? spotVolatileAmounts[spotVolatileAmounts.length - 1]
          : 0n;

      // Per-hop saturation: amounts[i+1] (output of hop i) vs. the matching
      // pool's reserveOut for that hop. Pools are looked up from the indexer
      // snapshot by (token0, token1, isStable).
      let maxSaturation = 0;
      if (winningAmounts && winningAmounts.length === candidate.path.length + 1) {
        for (let i = 0; i < candidate.path.length; i++) {
          const route = candidate.path[i];
          const fromLower = route.from.toLowerCase();
          const toLower = route.to.toLowerCase();
          const pool = pools.find((p) => {
            if (p.poolType && p.poolType !== "BASIC") return false;
            const t0 = p.token0.address.toLowerCase();
            const t1 = p.token1.address.toLowerCase();
            const matches =
              (t0 === fromLower && t1 === toLower) ||
              (t0 === toLower && t1 === fromLower);
            if (!matches) return false;
            return p.isStable === undefined ? true : p.isStable === isStable;
          });
          if (!pool) {
            // No matching snapshot — can't judge saturation; skip this hop.
            continue;
          }
          const isToken0Out = pool.token0.address.toLowerCase() === toLower;
          const reserveOut = BigInt(isToken0Out ? pool.reserve0 : pool.reserve1);
          const hopOut = winningAmounts[i + 1];
          const sat = hopSaturationBps(hopOut, reserveOut);
          if (sat > maxSaturation) maxSaturation = sat;
        }
      }

      if (basicBest > bestOutput) {
        bestOutput = basicBest;
        best = {
          output: basicBest,
          spotOutput,
          path: candidate.path.map((r) => ({
            ...r,
            stable: isStable,
            factory,
          })),
          isStable,
          isCL: false,
          isMixed: false,
          quoteInput,
          clMaxOutput: 0n,
          saturationBps: maxSaturation,
        };
      }
    }
  }

  return best;
}
