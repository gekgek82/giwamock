"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, Badge } from "@/components/admin/ui";
import type { LeaderboardEntry } from "@/types/admin";

interface LeaderboardPreviewProps {
  entries: LeaderboardEntry[];
  isLoading: boolean;
}

export function LeaderboardPreview({
  entries,
  isLoading,
}: LeaderboardPreviewProps) {
  const formatAddress = (address: string): string => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatPoints = (points: string): string => {
    const n = parseFloat(points);
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-4 bg-ds-gray-300 rounded w-24 animate-pulse" />
        </CardHeader>
        <div className="px-6 pb-4 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-10 bg-ds-gray-200 rounded animate-pulse"
            />
          ))}
        </div>
      </Card>
    );
  }

  const rankVariant = (rank: number) => {
    if (rank === 1) return "warning";
    if (rank === 2) return "default";
    if (rank === 3) return "cyan";
    return undefined;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Top Users</CardTitle>
          <Link
            href="/admin/points"
            className="text-xs text-ds-gray-700 hover:text-ds-gray-1000 transition-colors"
          >
            View All &rarr;
          </Link>
        </div>
      </CardHeader>

      {entries.length === 0 ? (
        <div className="text-center text-ds-gray-600 py-12">
          <p className="text-sm">No data available</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ds-gray-400 bg-ds-gray-100">
                <th className="text-left px-6 py-2.5 text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                  Rank
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                  Address
                </th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                  Total Points
                </th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                  LP
                </th>
                <th className="text-right px-6 py-2.5 text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                  Trading
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ds-gray-400">
              {entries.slice(0, 10).map((entry) => {
                const variant = rankVariant(entry.rank);
                return (
                  <tr
                    key={entry.address}
                    className="hover:bg-ds-gray-100 transition-colors duration-100"
                  >
                    <td className="px-6 py-3">
                      {variant ? (
                        <Badge variant={variant}>{entry.rank}</Badge>
                      ) : (
                        <span className="text-xs text-ds-gray-600 font-geist-mono pl-1.5">
                          {entry.rank}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-geist-mono text-[13px] text-ds-gray-900">
                        {formatAddress(entry.address)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[13px] font-medium text-ds-gray-1000 font-geist-mono">
                        {formatPoints(entry.totalPoints)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[13px] text-ds-gray-700 font-geist-mono">
                        {entry.lpPoints
                          ? formatPoints(entry.lpPoints)
                          : "-"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="text-[13px] text-ds-gray-700 font-geist-mono">
                        {entry.tradingPoints
                          ? formatPoints(entry.tradingPoints)
                          : "-"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
