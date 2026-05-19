"use client";

/**
 * Global Stats Card Component
 *
 * Displays protocol-wide statistics including TVL, volume, and fees.
 * Data is fetched from the GiwaTer Indexer API.
 *
 * @example
 * ```tsx
 * import { GlobalStatsCard } from '@/components/stats/GlobalStatsCard';
 *
 * function Dashboard() {
 *   return (
 *     <div>
 *       <h1>Protocol Overview</h1>
 *       <GlobalStatsCard />
 *     </div>
 *   );
 * }
 * ```
 */

import { useTranslations } from "next-intl";
import { useGlobalStats, formatUSD } from "@/hooks/useIndexerStats";

interface StatItemProps {
  label: string;
  value: string;
  isLoading?: boolean;
}

function StatItem({ label, value, isLoading }: StatItemProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-gray-400">{label}</span>
      {isLoading ? (
        <div className="h-7 w-24 animate-pulse rounded bg-gray-700" />
      ) : (
        <span className="text-xl font-bold text-white">{value}</span>
      )}
    </div>
  );
}

export function GlobalStatsCard() {
  const { data: stats, isLoading, error } = useGlobalStats();
  const t = useTranslations();

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
        <p className="text-red-400">
          {t("stats.failedToLoadGlobalStats")}: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#1a1b23] p-6">
      <h2 className="mb-6 text-lg font-semibold text-white">
        {t("stats.protocolOverview")}
      </h2>

      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
        <StatItem
          label={t("stats.totalTVL")}
          value={formatUSD(stats?.totalTVL)}
          isLoading={isLoading}
        />
        <StatItem
          label={t("pool.volume24h")}
          value={formatUSD(stats?.totalVolume24h)}
          isLoading={isLoading}
        />
        <StatItem
          label={t("stats.volume7d")}
          value={formatUSD(stats?.totalVolume7d)}
          isLoading={isLoading}
        />
        <StatItem
          label={t("pool.fees24h")}
          value={formatUSD(stats?.totalFees24h)}
          isLoading={isLoading}
        />
        <StatItem
          label={t("stats.fees7d")}
          value={formatUSD(stats?.totalFees7d)}
          isLoading={isLoading}
        />
        <StatItem
          label={t("stats.totalPools")}
          value={stats?.poolCount?.toString() ?? "-"}
          isLoading={isLoading}
        />
      </div>

      {stats?.updatedAt && (
        <p className="mt-4 text-xs text-gray-500">
          {t("stats.lastUpdated")}: {new Date(stats.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

export default GlobalStatsCard;
