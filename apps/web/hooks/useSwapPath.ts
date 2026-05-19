import { useMemo } from 'react';
import { usePools, type PoolInfo } from './usePools';

export interface Route {
  from: `0x${string}`;
  to: `0x${string}`;
  stable: boolean;
  factory: `0x${string}`;
  /** Pool type: "BASIC" or "CL" */
  poolType?: string;
  /** Tick spacing for CL pools */
  tickSpacing?: number;
  /** Actual on-chain pool address (needed for CL pool state reads) */
  poolAddress?: `0x${string}`;
}

interface PathNode {
  token: `0x${string}`;
  route: Route[];
  visited: Set<string>;
}

/**
 * BFS helper that finds the shortest path using only pools of the given type.
 * When poolTypeFilter is undefined every pool is considered (used only for
 * the legacy fallback — callers should always supply a filter).
 */
function bfsFind(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  poolsByToken: Map<string, PoolInfo[]>,
  maxHops: number,
  poolTypeFilter?: "BASIC" | "CL",
): Route[] | null {
  const tokenInLower = tokenIn.toLowerCase();
  const tokenOutLower = tokenOut.toLowerCase();

  const queue: PathNode[] = [
    {
      token: tokenIn,
      route: [],
      visited: new Set([tokenInLower]),
    },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.route.length >= maxHops) continue;

    const currentPools = poolsByToken.get(current.token.toLowerCase()) || [];

    for (const pool of currentPools) {
      // Filter by pool type if specified
      if (poolTypeFilter === "BASIC" && pool.poolType === "CL") continue;
      if (poolTypeFilter === "CL" && pool.poolType !== "CL") continue;

      const token0Lower = pool.token0.address.toLowerCase();
      const token1Lower = pool.token1.address.toLowerCase();
      const currentLower = current.token.toLowerCase();

      const nextToken = token0Lower === currentLower
        ? pool.token1.address
        : pool.token0.address;
      const nextTokenLower = nextToken.toLowerCase();

      if (current.visited.has(nextTokenLower)) continue;

      const newRoute: Route = {
        from: current.token,
        to: nextToken,
        stable: false,
        factory: pool.address as `0x${string}`,
        poolType: pool.poolType,
        tickSpacing: pool.tickSpacing ?? undefined,
        poolAddress: pool.address as `0x${string}`,
      };

      if (nextTokenLower === tokenOutLower) {
        return [...current.route, newRoute];
      }

      const newVisited = new Set(current.visited);
      newVisited.add(nextTokenLower);
      queue.push({
        token: nextToken,
        route: [...current.route, newRoute],
        visited: newVisited,
      });
    }
  }

  return null;
}

/**
 * Find optimal swap path between two tokens using BFS
 */
export function useSwapPath(
  tokenIn: `0x${string}` | undefined,
  tokenOut: `0x${string}` | undefined,
  maxHops: number = 3
) {
  const { pools, isLoading } = usePools();

  const result = useMemo(() => {
    if (!tokenIn || !tokenOut || !pools || pools.length === 0) {
      return null;
    }

    if (tokenIn === tokenOut) {
      return null;
    }

    // Build pool index by token
    const poolsByToken = new Map<string, PoolInfo[]>();
    for (const pool of pools) {
      const token0 = pool.token0.address.toLowerCase();
      const token1 = pool.token1.address.toLowerCase();

      if (!poolsByToken.has(token0)) {
        poolsByToken.set(token0, []);
      }
      if (!poolsByToken.has(token1)) {
        poolsByToken.set(token1, []);
      }
      poolsByToken.get(token0)!.push(pool);
      poolsByToken.get(token1)!.push(pool);
    }

    const tokenInLower = tokenIn.toLowerCase();
    const tokenOutLower = tokenOut.toLowerCase();

    // Collect ALL direct pools for the token pair (Basic + CL, all tickSpacings)
    const candidates: Route[][] = [];
    const allDirectPools = poolsByToken.get(tokenInLower) || [];
    for (const pool of allDirectPools) {
      const token0Lower = pool.token0.address.toLowerCase();
      const token1Lower = pool.token1.address.toLowerCase();

      if (
        (token0Lower === tokenInLower && token1Lower === tokenOutLower) ||
        (token0Lower === tokenOutLower && token1Lower === tokenInLower)
      ) {
        candidates.push([{
          from: tokenIn,
          to: tokenOut,
          stable: false, // Will be determined by useSwapQuote for Basic pools
          factory: pool.address as `0x${string}`,
          poolType: pool.poolType,
          tickSpacing: pool.tickSpacing ?? undefined,
          poolAddress: pool.address as `0x${string}`,
        }]);
      }
    }

    // If no direct pools, try BFS multi-hop (separate Basic and CL passes)
    if (candidates.length === 0) {
      const basicPath = bfsFind(tokenIn, tokenOut, poolsByToken, maxHops, "BASIC");
      const clPath = bfsFind(tokenIn, tokenOut, poolsByToken, maxHops, "CL");
      if (basicPath) candidates.push(basicPath);
      if (clPath) candidates.push(clPath);

      // Mixed-type BFS: find paths crossing both BASIC and CL pools
      const mixedPath = bfsFind(tokenIn, tokenOut, poolsByToken, maxHops, undefined);
      if (mixedPath) {
        const mixedKey = mixedPath.map((r) => r.poolAddress).join(",");
        const isDuplicate = candidates.some(
          (c) => c.map((r) => r.poolAddress).join(",") === mixedKey,
        );
        if (!isDuplicate) candidates.push(mixedPath);
      }
    }

    return candidates.length > 0 ? candidates : null;
  }, [tokenIn, tokenOut, pools, maxHops]);

  return {
    /** All candidate paths (direct pools + BFS results) for quoting */
    candidatePaths: result,
    /** First candidate path (backward compat) */
    path: result?.[0] ?? null,
    isLoading,
    hasPath: result !== null,
    hopCount: result?.[0]?.length ?? 0,
    /** All pools data (for reserve lookups) */
    pools,
  };
}

