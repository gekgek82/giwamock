import { createConfig } from "ponder";
import {
  BribeVotingRewardAbi,
  CLFactoryAbi,
  CLGaugeAbi,
  CL_POOL_FACTORY_ADDRESS,
  CONTRACT_START_BLOCKS,
  DYNAMIC_SWAP_FEE_MODULE_ADDRESS,
  DynamicSwapFeeModuleAbi,
  FeesVotingRewardAbi,
  GaugeAbi,
  GiwaUniversalRouterAbi,
  NFT_POSITION_MANAGER_ADDRESS,
  NonfungiblePositionManagerAbi,
  POOL_FACTORY_ADDRESS,
  POOL_REWARD_REGISTRY_ADDRESS,
  PoolFactoryAbi,
  PoolRewardRegistryAbi,
  UNIVERSAL_ROUTER_ADDRESS,
  VOTER_ADDRESS,
  VoterAbi,
  VOTING_ESCROW_ADDRESS,
  VotingEscrowAbi,
} from "@giwater/shared";
import { getAbiItem, http, fallback, type Abi, type Transport, type EIP1193RequestFn } from "viem";

const REQUEST_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[rpc] timeout after ${ms}ms — ${label}`)), ms),
    ),
  ]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rate-limit a Transport to maxRps requests/second (for Nodit fallback).
 * Controlled via PONDER_RPC_MAX_RPS env var.
 */
function rateLimitTransport(transport: Transport, maxRps: number): Transport {
  const rps = Number.isFinite(maxRps) && maxRps > 0 ? maxRps : 5;
  const minIntervalMs = Math.ceil(1000 / rps);
  let lastAtMs = 0;
  let queue: Promise<void> = Promise.resolve();
  let pendingCount = 0;

  return (opts) => {
    const inner = transport(opts);
    return {
      ...inner,
      request: (((args: any) => {
        pendingCount++;
        const startPromise = queue.then(async () => {
          const now = Date.now();
          const waitMs = Math.max(0, lastAtMs + minIntervalMs - now);
          if (waitMs > 0) await sleep(waitMs);
          lastAtMs = Date.now();
        });
        queue = startPromise.then(() => undefined, () => undefined);
        const responsePromise = startPromise.then(async () => {
          try {
            return await withTimeout(inner.request(args) as Promise<unknown>, REQUEST_TIMEOUT_MS, args.method);
          } catch (err: any) {
            const status = err?.status ?? err?.code;
            if (err?.message?.startsWith("[rpc] timeout")) {
              console.error(err.message);
            } else if (status === 429) {
              console.error(`[rpc] 429 on fallback — ${args.method}. Lower PONDER_RPC_MAX_RPS (currently ${rps})`);
            } else {
              console.error(`[rpc] fallback error — ${args.method} status=${status} msg=${err?.message ?? String(err)}`);
            }
            throw err;
          } finally {
            pendingCount--;
          }
        });
        return responsePromise as any;
      }) as unknown) as EIP1193RequestFn,
    };
  };
}

const mask = (url: string) => url.replace(/\/([^/]{4})[^/]+$/, "/$1****");
console.log(`[rpc] primary:  ${mask(process.env.PONDER_RPC_URL_1 ?? "(not set)")}`);
console.log(`[rpc] fallback: ${process.env.PONDER_RPC_URL_2 ? mask(process.env.PONDER_RPC_URL_2) : "(not set)"}`);
console.log(`[rpc] WSS:      ${process.env.PONDER_RPC_WSS_URL_1 ? mask(process.env.PONDER_RPC_WSS_URL_1) : "(not set)"}`);
console.log(`[rpc] fallback rate limit: ${process.env.PONDER_RPC_MAX_RPS ? `${process.env.PONDER_RPC_MAX_RPS} RPS` : "disabled"}`);

const START_BLOCK = CONTRACT_START_BLOCKS;

const ZERO = "0x0000000000000000000000000000000000000000";

const poolRewardRegistryAddr = (
  process.env.PONDER_POOL_REWARD_REGISTRY_ADDRESS ?? POOL_REWARD_REGISTRY_ADDRESS
).toLowerCase();

const includePoolRewardRegistry =
  poolRewardRegistryAddr.startsWith("0x") &&
  poolRewardRegistryAddr.length === 42 &&
  poolRewardRegistryAddr !== ZERO.toLowerCase();

const contracts = {
  GiwaUniversalRouter: {
    chain: "mainnet" as const,
    abi: GiwaUniversalRouterAbi as Abi,
    address: UNIVERSAL_ROUTER_ADDRESS,
    startBlock: START_BLOCK.giwaUniversalRouter,
  },
  CLFactory: {
    chain: "mainnet" as const,
    abi: CLFactoryAbi as Abi,
    address: CL_POOL_FACTORY_ADDRESS,
    startBlock: START_BLOCK.clPoolFactory,
  },
  NonfungiblePositionManager: {
    chain: "mainnet" as const,
    abi: NonfungiblePositionManagerAbi as Abi,
    address: NFT_POSITION_MANAGER_ADDRESS,
    startBlock: START_BLOCK.nftPositionManager,
  },
  PoolFactory: {
    chain: "mainnet" as const,
    abi: PoolFactoryAbi as Abi,
    address: POOL_FACTORY_ADDRESS,
    startBlock: START_BLOCK.poolFactory,
  },
  DynamicSwapFeeModule: {
    chain: "mainnet" as const,
    abi: DynamicSwapFeeModuleAbi as Abi,
    address: DYNAMIC_SWAP_FEE_MODULE_ADDRESS,
    startBlock: START_BLOCK.dynamicSwapFeeModule,
  },
  
  Voter: {
    chain: "mainnet" as const,
    abi: VoterAbi as Abi,
    address: VOTER_ADDRESS,
    startBlock: Number(
      process.env.PONDER_START_BLOCK_VOTER ?? START_BLOCK.poolFactory,
    ),
  },
  VotingEscrow: {
    chain: "mainnet" as const,
    abi: VotingEscrowAbi as Abi,
    address: VOTING_ESCROW_ADDRESS,
    startBlock: Number(
      process.env.PONDER_START_BLOCK_VOTING_ESCROW ?? START_BLOCK.poolFactory,
    ),
  },
  ...(includePoolRewardRegistry
    ? {
        PoolRewardRegistry: {
          chain: "mainnet" as const,
          abi: PoolRewardRegistryAbi as Abi,
          address: poolRewardRegistryAddr as `0x${string}`,
          startBlock: Number(
            process.env.PONDER_START_BLOCK_POOL_REWARD_REGISTRY ??
              START_BLOCK.poolFactory,
          ),
        },
      }
    : {}),
  BasicGauge: {
    chain: "mainnet" as const,
    abi: GaugeAbi as Abi,
    factory: {
      address: VOTER_ADDRESS,
      event: getAbiItem({ abi: VoterAbi as Abi, name: "GaugeCreated" }) as any,
      parameter: "gauge",
    },
    startBlock: Number(
      process.env.PONDER_START_BLOCK_VOTER ?? START_BLOCK.poolFactory,
    ),
  },
  CLGauge: {
    chain: "mainnet" as const,
    abi: CLGaugeAbi as Abi,
    factory: {
      address: VOTER_ADDRESS,
      event: getAbiItem({ abi: VoterAbi as Abi, name: "GaugeCreated" }) as any,
      parameter: "gauge",
    },
    startBlock: Number(
      process.env.PONDER_START_BLOCK_VOTER ?? START_BLOCK.poolFactory,
    ),
  },
  FeeVotingReward: {
    chain: "mainnet" as const,
    abi: FeesVotingRewardAbi as Abi,
    factory: {
      address: VOTER_ADDRESS,
      event: getAbiItem({ abi: VoterAbi as Abi, name: "GaugeCreated" }) as any,
      parameter: "feeVotingReward",
    },
    startBlock: Number(
      process.env.PONDER_START_BLOCK_VOTER ?? START_BLOCK.poolFactory,
    ),
  },
  BribeVotingReward: {
    chain: "mainnet" as const,
    abi: BribeVotingRewardAbi as Abi,
    factory: {
      address: VOTER_ADDRESS,
      event: getAbiItem({ abi: VoterAbi as Abi, name: "GaugeCreated" }) as any,
      parameter: "bribeVotingReward",
    },
    startBlock: Number(
      process.env.PONDER_START_BLOCK_VOTER ?? START_BLOCK.poolFactory,
    ),
  },
  
};

export default createConfig({
  chains: {
    mainnet: {
      id: 91342,
      rpc: (() => {
        const makeTransport = (url: string, rateLimit?: number) =>
          rateLimit ? rateLimitTransport(http(url), rateLimit) : http(url);

        const rps = process.env.PONDER_RPC_MAX_RPS ? Number(process.env.PONDER_RPC_MAX_RPS) : undefined;

        if (!process.env.PONDER_RPC_URL_2) {
          // Single RPC — apply rate limit to URL_1 if set
          return makeTransport(process.env.PONDER_RPC_URL_1!, rps);
        }
        // Dual RPC — primary is unlimited (own node), fallback is rate-limited (Nodit)
        return fallback([
          http(process.env.PONDER_RPC_URL_1!),
          makeTransport(process.env.PONDER_RPC_URL_2, rps),
        ]);
      })(),
      ethGetLogsBlockRange: Number(process.env.PONDER_ETH_GET_LOGS_BLOCK_RANGE ?? "1000"),
      ...(process.env.PONDER_RPC_WSS_URL_1 ? { ws: process.env.PONDER_RPC_WSS_URL_1 } : {}),
    },
  },
  contracts,
});
