import type { PoolInfo } from "@/hooks/usePools";
import type { LaunchPoolRowMetrics } from "./types";

export const CL_TICK_SPACINGS = [
  { tickSpacing: 1, name: "CL1", fee: "0.01%" },
  { tickSpacing: 10, name: "CL10", fee: "0.05%" },
  { tickSpacing: 50, name: "CL50", fee: "0.30%" },
  { tickSpacing: 100, name: "CL100", fee: "1.00%" },
  { tickSpacing: 200, name: "CL200", fee: "2.00%" },
];

export function normalizeTokenPair(
  addr0: string,
  addr1: string,
): [string, string] {
  const a = addr0.toLowerCase();
  const b = addr1.toLowerCase();
  return a < b ? [a, b] : [b, a];
}

export function buildPoolKey(
  token0: string,
  token1: string,
  poolType: "CL" | "BASIC",
  config: number | boolean,
): string {
  const [a, b] = normalizeTokenPair(token0, token1);
  return `${a}-${b}-${poolType}-${config}`;
}

export function poolInfoToLaunchMetrics(pool: PoolInfo): LaunchPoolRowMetrics {
  const g = pool.gateway;
  const tvl = g?.tvlDisplayUsd ? String(g.tvlDisplayUsd) : "0";
  const apr = g?.swapAprApprox ? String(g.swapAprApprox) : "0";
  return { tvl, apr7d: apr };
}

export function launchMapKeyForPool(pool: PoolInfo): string {
  const tickOrStable =
    pool.poolType === "CL" ? (pool.tickSpacing ?? 0) : pool.isStable;
  return buildPoolKey(
    pool.token0.address,
    pool.token1.address,
    pool.poolType as "CL" | "BASIC",
    tickOrStable,
  );
}
