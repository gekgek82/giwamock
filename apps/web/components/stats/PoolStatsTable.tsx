"use client";

/**
 * Pool stats table — rows from gateway broker `spot_pairs` (same source as `usePools`).
 */

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { usePools, type PoolInfo } from "@/hooks/usePools";
import { formatUSD, formatAPR, formatTxCount } from "@/hooks/useIndexerStats";

interface PoolStatsTableProps {
  /** Maximum number of pools to display */
  limit?: number;
  /** Initial sort field */
  initialSortBy?: SortField;
  /** Initial sort order */
  initialSortOrder?: "asc" | "desc";
}

type SortField = "tvl" | "volume24h" | "fees24h" | "apr";

const SORT_LABELS: Record<SortField, string> = {
  tvl: "TVL",
  volume24h: "24h Volume",
  fees24h: "24h Fees",
  apr: "APR",
};

function sortPools(
  pools: PoolInfo[],
  sortBy: SortField,
  sortOrder: "asc" | "desc",
): PoolInfo[] {
  const out = [...pools];
  const dir = sortOrder === "desc" ? -1 : 1;
  out.sort((a, b) => {
    const ga = a.gateway;
    const gb = b.gateway;
    let va = 0;
    let vb = 0;
    switch (sortBy) {
      case "tvl":
        va = ga?.tvlDisplayUsd ?? 0;
        vb = gb?.tvlDisplayUsd ?? 0;
        break;
      case "volume24h":
        va = ga?.volume24hUsd ?? 0;
        vb = gb?.volume24hUsd ?? 0;
        break;
      case "fees24h":
        va = ga?.feesDayUsd ?? 0;
        vb = gb?.feesDayUsd ?? 0;
        break;
      case "apr":
        va = ga?.swapAprApprox ?? 0;
        vb = gb?.swapAprApprox ?? 0;
        break;
      default:
        break;
    }
    if (va === vb) return a.address.localeCompare(b.address) * dir;
    return va < vb ? -dir : dir;
  });
  return out;
}

export function PoolStatsTable({
  limit = 100,
  initialSortBy = "tvl",
  initialSortOrder = "desc",
}: PoolStatsTableProps) {
  const [sortBy, setSortBy] = useState<SortField>(initialSortBy);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialSortOrder);
  const t = useTranslations();
  const { pools, isLoading, error } = usePools();

  const sorted = useMemo(
    () => sortPools(pools, sortBy, sortOrder).slice(0, limit),
    [pools, sortBy, sortOrder, limit],
  );

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 text-sm font-medium transition-colors hover:text-white ${
        sortBy === field ? "text-white" : "text-gray-400"
      }`}
    >
      {children}
      {sortBy === field && (
        <span className="text-xs">{sortOrder === "desc" ? "↓" : "↑"}</span>
      )}
    </button>
  );

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
        <p className="text-red-400">
          {t("stats.failedToLoadPools")}: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#1a1b23] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">
                {t("pool.pools")}
              </th>
              <th className="px-6 py-4 text-right">
                <SortButton field="tvl">{t("pool.tvl")}</SortButton>
              </th>
              <th className="px-6 py-4 text-right">
                <SortButton field="volume24h">{t("pool.volume24h")}</SortButton>
              </th>
              <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">
                {t("stats.volume7d")}
              </th>
              <th className="px-6 py-4 text-right">
                <SortButton field="fees24h">{t("pool.fees24h")}</SortButton>
              </th>
              <th className="px-6 py-4 text-right">
                <SortButton field="apr">{t("pool.apr")}</SortButton>
              </th>
              <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">
                {t("stats.txs24h")}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="px-6 py-4">
                    <div className="h-5 w-24 animate-pulse rounded bg-gray-700" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="ml-auto h-5 w-20 animate-pulse rounded bg-gray-700" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="ml-auto h-5 w-20 animate-pulse rounded bg-gray-700" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="ml-auto h-5 w-20 animate-pulse rounded bg-gray-700" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="ml-auto h-5 w-16 animate-pulse rounded bg-gray-700" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="ml-auto h-5 w-16 animate-pulse rounded bg-gray-700" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="ml-auto h-5 w-12 animate-pulse rounded bg-gray-700" />
                  </td>
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  {t("pool.noPoolsCreated")}
                </td>
              </tr>
            ) : (
              sorted.map((pool) => {
                const g = pool.gateway;
                const label = `${pool.token0.symbol}/${pool.token1.symbol}`;
                return (
                  <tr
                    key={pool.address}
                    className="border-b border-white/5 transition-colors hover:bg-white/5"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{label}</span>
                        <span className="text-xs text-gray-500">
                          {pool.address.slice(0, 6)}...
                          {pool.address.slice(-4)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-white">
                      {g?.tvlDisplayUsd
                        ? formatUSD(String(g.tvlDisplayUsd))
                        : formatUSD("0")}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-300">
                      {g?.volume24hUsd
                        ? formatUSD(String(g.volume24hUsd))
                        : formatUSD("0")}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-300">-</td>
                    <td className="px-6 py-4 text-right text-gray-300">
                      {formatUSD(String(g?.feesDayUsd ?? 0))}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-medium text-green-400">
                        {g?.swapAprApprox
                          ? formatAPR(String(g.swapAprApprox))
                          : formatAPR("0")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-400">
                      {formatTxCount(0)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
        <span className="text-sm text-gray-400">
          {t("stats.showing")} {sorted.length} {t("stats.of")}{" "}
          {pools.length} {t("pool.pools").toLowerCase()}
        </span>
        <span className="text-xs text-gray-500">
          {t("stats.sortedBy")} {SORT_LABELS[sortBy]} (
          {sortOrder === "desc"
            ? t("stats.highestFirst")
            : t("stats.lowestFirst")}
          )
        </span>
      </div>
    </div>
  );
}

export default PoolStatsTable;
