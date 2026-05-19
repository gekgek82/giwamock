import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseUnits } from "viem";
import type { SpotPairRecordDto } from "@giwater/shared";
import { isIndexerConfigured } from "@/lib/indexerApi";
import { gatewayBrokerApi } from "@/lib/gatewayBrokerApi";
import {
  buildGatewayPoolMetricsFromSpotPair,
  inferClTickSpacingFromFeeBps,
  clTickSpacingToFeeBps,
  type PoolGatewayMetrics,
} from "@/lib/gatewayPoolMetrics";

/**
 * Pool information interface
 * Compatible with existing components while adding new fields from API v1.1
 */
/** Token leg used for UI copy (icons, “BASE — QUOTE” labels). */
export type PoolTokenLeg = {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
};

export interface PoolInfo {
  address: `0x${string}`;
  token0: PoolTokenLeg;
  token1: PoolTokenLeg;
  /**
   * Broker canonical BASE·QUOTE orientation for display (gateway `spot_pairs`).
   * When missing (indexer-only list), UI falls back to `token0` / `token1`.
   */
  displayBase?: PoolTokenLeg;
  displayQuote?: PoolTokenLeg;
  name: string;
  /** Pool type: true for Stable, false for Volatile (v1.1) */
  isStable: boolean;
  /** Pool type: "BASIC" or "CL" (Concentrated Liquidity) */
  poolType: string;
  /** Tick spacing for CL pools (1, 10, 50, 100, 200) */
  tickSpacing?: number | null;
  /** Whether the pool has an active gauge (for Incentivized filter) */
  hasGauge: boolean;
  /** Token0 reserve in the pool (raw string from indexer or broker-derived wei string) */
  reserve0: string;
  /** Token1 reserve in the pool */
  reserve1: string;
  /**
   * When the pool list is loaded from the gateway broker `spot_pairs` row, static fee in bps (optional).
   */
  effectiveFeeBps?: number | null;
  /** Broker `spot_pairs` day-bucket USD metrics (volume / fee / rough APR). */
  gateway?: PoolGatewayMetrics;
  /** Pool grade from admin meta: 1=Verified, 2=Rising, 3=Unknown. */
  grade?: number;
}

const GATEWAY_POOLS_KEY = ["gateway", "spot-pairs", "recently-created"] as const;

const POOLS_STALE_MS = 60 * 1000;

function normalizeAddr(id: string): `0x${string}` {
  const s = id.trim().toLowerCase();
  const hex = s.startsWith("0x") ? s.slice(2) : s;
  return `0x${hex}` as `0x${string}`;
}

function liquidityHumanToWei(human: number, decimals: number): string {
  const d = Math.min(77, Math.max(0, Math.floor(decimals)));
  if (!Number.isFinite(human) || human <= 0) return "0";
  try {
    const fixed = human.toFixed(d);
    return parseUnits(fixed, d).toString();
  } catch {
    return "0";
  }
}

/**
 * Map broker `spot_pairs` row → PoolInfo (on-chain token0/token1 order preserved).
 */
function convertSpotPairRecordToPoolInfo(row: SpotPairRecordDto): PoolInfo {
  const t0 = normalizeAddr(row.token0 || row.id);
  const t1 = normalizeAddr(row.token1 || row.id);
  const baseLc = (row.base || "").trim().toLowerCase();
  const quoteLc = (row.quote || "").trim().toLowerCase();
  const t0Lc = t0.toLowerCase();

  let reserve0 = "0";
  let reserve1 = "0";
  const baseHuman = row.baseLiquidity ?? 0;
  const quoteHuman = row.quoteLiquidity ?? 0;
  const bDec = row.bDecimal > 0 ? row.bDecimal : 18;
  const qDec = row.qDecimal > 0 ? row.qDecimal : 18;

  if (baseLc && quoteLc) {
    if (t0Lc === baseLc) {
      reserve0 = liquidityHumanToWei(baseHuman, bDec);
      reserve1 = liquidityHumanToWei(quoteHuman, qDec);
    } else if (t0Lc === quoteLc) {
      reserve0 = liquidityHumanToWei(quoteHuman, qDec);
      reserve1 = liquidityHumanToWei(baseHuman, bDec);
    }
  }

  const hasDisplayOrientation =
    baseLc.length > 0 &&
    quoteLc.length > 0 &&
    baseLc !== quoteLc;

  const displayBase: PoolTokenLeg | undefined = hasDisplayOrientation
    ? {
        address: normalizeAddr(row.base),
        symbol: row.baseSymbol || "?",
        name: row.baseName || row.baseSymbol || "?",
        decimals: row.bDecimal > 0 ? row.bDecimal : 18,
      }
    : undefined;

  const displayQuote: PoolTokenLeg | undefined = hasDisplayOrientation
    ? {
        address: normalizeAddr(row.quote),
        symbol: row.quoteSymbol || "?",
        name: row.quoteName || row.quoteSymbol || "?",
        decimals: row.qDecimal > 0 ? row.qDecimal : 18,
      }
    : undefined;

  const pairDisplayName =
    displayBase && displayQuote
      ? `${displayBase.symbol} / ${displayQuote.symbol}`
      : row.symbol || `${row.token0Symbol}-${row.token1Symbol}`;

  const derivedFeeBps =
    row.effectiveFeeBps ??
    (row.isConcentratedLiquidity ? clTickSpacingToFeeBps(row.clTickSpacing) : null);

  return {
    address: normalizeAddr(row.id),
    token0: {
      address: t0,
      symbol: row.token0Symbol || "?",
      name: row.token0Name || row.token0Symbol || "?",
      decimals:
        Number.isFinite(row.token0Decimals) && row.token0Decimals >= 0
          ? row.token0Decimals
          : 18,
    },
    token1: {
      address: t1,
      symbol: row.token1Symbol || "?",
      name: row.token1Name || row.token1Symbol || "?",
      decimals:
        Number.isFinite(row.token1Decimals) && row.token1Decimals >= 0
          ? row.token1Decimals
          : 18,
    },
    displayBase,
    displayQuote,
    name: pairDisplayName,
    isStable: row.type === "stable",
    poolType: row.isConcentratedLiquidity ? "CL" : "BASIC",
    tickSpacing: row.isConcentratedLiquidity
      ? (row.clTickSpacing ?? inferClTickSpacingFromFeeBps(row.effectiveFeeBps))
      : null,
    hasGauge: false,
    reserve0,
    reserve1,
    effectiveFeeBps: derivedFeeBps,
    grade: row.grade,
    gateway: buildGatewayPoolMetricsFromSpotPair({
      baseLiquidity: row.baseLiquidity,
      quoteLiquidity: row.quoteLiquidity,
      displayPrice: row.displayPrice,
      dayBaseVolumeUSD: row.dayBaseVolumeUSD,
      dayQuoteVolumeUSD: row.dayQuoteVolumeUSD,
      dayBaseTvlUSD: row.dayBaseTvlUSD,
      dayQuoteTvlUSD: row.dayQuoteTvlUSD,
      effectiveFeeBps: derivedFeeBps,
      totalTvlUsd: row.totalTvlUsd ?? null,
      totalSwapFeesUsd: row.totalSwapFeesUsd ?? 0,
      daySwapFeesUsd: row.daySwapFeesUsd ?? 0,
    }),
  };
}

/**
 * Curated pool list for user-facing pages: broker `spot_pairs` via same-origin
 * `GET /api/gateway/spot-pairs/recently-created` (proxies to the configured gateway).
 * Does not call indexer `GET /pools/stats`.
 */
export function usePools() {
  const gatewayQuery = useQuery({
    queryKey: [...GATEWAY_POOLS_KEY, { listed: true, limit: 500 }] as const,
    queryFn: () =>
      gatewayBrokerApi.listSpotPairsRecentlyCreated({
        listed: true,
        limit: 500,
      }),
    staleTime: POOLS_STALE_MS,
  });

  const indexerConfigured = isIndexerConfigured();

  const pools = useMemo(() => {
    const items = gatewayQuery.data?.items ?? [];
    return items.map(convertSpotPairRecordToPoolInfo);
  }, [gatewayQuery.data]);

  const poolCount = gatewayQuery.data?.total ?? pools.length;

  const { isLoading, error, refetch, data } = gatewayQuery;

  return {
    pools,
    isLoading,
    poolCount,
    rawResponse: data,
    isIndexerConfigured: indexerConfigured,
    /** Pool rows always come from gateway broker `spot_pairs` parity. */
    pairsFromGateway: true,
    error,
    refetch,
  };
}

/**
 * Hook to get a single pool by address
 *
 * @param poolAddress - The pool contract address
 * @returns Pool info or undefined if not found
 */
export function usePool(poolAddress?: `0x${string}`) {
  const { pools, isLoading } = usePools();

  const pool = useMemo(() => {
    if (!poolAddress || !pools.length) return undefined;

    return pools.find(
      (p) => p.address.toLowerCase() === poolAddress.toLowerCase(),
    );
  }, [pools, poolAddress]);

  return {
    pool,
    isLoading,
  };
}

/**
 * Hook to find a pool by token pair
 *
 * @param token0Address - Token0 contract address
 * @param token1Address - Token1 contract address
 * @returns Pool info or undefined if not found
 */
export function usePoolByTokens(
  token0Address?: `0x${string}`,
  token1Address?: `0x${string}`,
) {
  const { pools, isLoading } = usePools();

  const pool = useMemo(() => {
    if (!token0Address || !token1Address || !pools.length) return undefined;

    const token0Lower = token0Address.toLowerCase();
    const token1Lower = token1Address.toLowerCase();

    return pools.find(
      (p) =>
        (p.token0.address.toLowerCase() === token0Lower &&
          p.token1.address.toLowerCase() === token1Lower) ||
        (p.token0.address.toLowerCase() === token1Lower &&
          p.token1.address.toLowerCase() === token0Lower),
    );
  }, [pools, token0Address, token1Address]);

  return {
    pool,
    isLoading,
  };
}
