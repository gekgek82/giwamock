"use client";

import type { LeaderboardEntry } from "@/types/admin";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Button,
} from "@/components/admin/ui";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  isLoading: boolean;
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
  onPageChange: (offset: number) => void;
}

/**
 * Full Leaderboard Table
 *
 * Shows all leaderboard entries with pagination.
 */
export function LeaderboardTable({
  entries,
  isLoading,
  pagination,
  onPageChange,
}: LeaderboardTableProps) {
  const formatAddress = (address: string): string => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatPoints = (points: string | undefined): string => {
    if (!points) return "-";
    const n = parseFloat(points);
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="h-12 bg-ds-gray-300 rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        <CardDescription>{pagination.total.toLocaleString()} total users</CardDescription>
      </CardHeader>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ds-gray-100">
              <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Rank</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Address</th>
              <th className="h-10 px-4 text-right text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Total</th>
              <th className="h-10 px-4 text-right text-xs font-medium text-ds-gray-700 uppercase tracking-wider">LP</th>
              <th className="h-10 px-4 text-right text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Trading</th>
              <th className="h-10 px-4 text-right text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Referral</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ds-gray-400">
            {entries.map((entry) => (
              <tr key={entry.address} className="hover:bg-ds-gray-100 transition-colors duration-100">
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      entry.rank === 1
                        ? "warning"
                        : entry.rank === 2
                        ? "default"
                        : entry.rank === 3
                        ? "warning"
                        : "default"
                    }
                    className={entry.rank === 2 ? "bg-ds-gray-200 text-ds-gray-700 border-ds-gray-400" : entry.rank > 3 ? "bg-ds-gray-200 text-ds-gray-700 border-ds-gray-400" : ""}
                  >
                    {entry.rank}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="font-geist-mono text-sm text-ds-gray-1000">
                    {formatAddress(entry.address)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-semibold text-ds-gray-1000 font-geist-mono">
                    {formatPoints(entry.totalPoints)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-ds-gray-700 font-geist-mono">
                    {formatPoints(entry.lpPoints)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-ds-gray-700 font-geist-mono">
                    {formatPoints(entry.tradingPoints)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-ds-gray-700 font-geist-mono">
                    {formatPoints(entry.referralPoints)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <CardFooter className="justify-between">
          <p className="text-sm text-ds-gray-700">
            Showing {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(Math.max(0, pagination.offset - pagination.limit))}
              disabled={pagination.offset === 0}
            >
              Previous
            </Button>
            <span className="text-sm text-ds-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(pagination.offset + pagination.limit)}
              disabled={pagination.offset + pagination.limit >= pagination.total}
            >
              Next
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
