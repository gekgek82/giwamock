"use client";

import { Card, CardContent, Badge } from "@/components/admin/ui";
import type { DashboardStats } from "@/types/admin";

// ── Skeleton ──
function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="h-3.5 bg-ds-gray-300 rounded w-24 mb-4 animate-pulse" />
        <div className="h-7 bg-ds-gray-300 rounded w-32 animate-pulse" />
      </CardContent>
    </Card>
  );
}

// ── Stat Card ──
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  badge?: string;
  trend?: { value: number; isPositive: boolean };
}

function StatCard({ title, value, icon, badge, trend }: StatCardProps) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ds-gray-700">{title}</span>
            {badge && <Badge>{badge}</Badge>}
          </div>
          <span className="text-ds-gray-600">{icon}</span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-xl font-semibold text-ds-gray-1000 tracking-tight">
            {value}
          </span>
          {trend && (
            <span
              className={`text-xs font-medium ${
                trend.isPositive ? "text-ds-green-400" : "text-ds-red-400"
              }`}
            >
              {trend.isPositive ? "+" : "-"}
              {trend.value}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ──
interface QuickStatsProps {
  stats: DashboardStats | null;
  isLoading: boolean;
}

export function QuickStats({ stats, isLoading }: QuickStatsProps) {
  const formatUsd = (val: string | undefined): string => {
    if (!val) return "$0.00";
    const n = parseFloat(val);
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  };

  const formatPoints = (val: string | undefined): string => {
    if (!val) return "0";
    const n = parseFloat(val);
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const isBribesZero =
    !stats?.totalProtocolBribes ||
    parseFloat(stats.totalProtocolBribes) === 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <StatCard
        title="Total Value Locked"
        value={formatUsd(stats?.totalTvl)}
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        }
      />

      <StatCard
        title="Cumulative Volume"
        value={formatUsd(stats?.cumulativeVolume)}
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        }
      />

      <StatCard
        title="Cumulative Fees"
        value={formatUsd(stats?.cumulativeFees)}
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
          </svg>
        }
      />

      <StatCard
        title="Distributed Points"
        value={`${formatPoints(stats?.totalDistributed)} Pts`}
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />

      <StatCard
        title="Protocol Bribes"
        value={formatUsd(stats?.totalProtocolBribes)}
        badge={isBribesZero ? "Coming Soon" : undefined}
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
        }
      />
    </div>
  );
}
