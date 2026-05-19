"use client";

import type { SyncStatus } from "@/types/admin";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
} from "@/components/admin/ui";

interface SyncStatusCardProps {
  status: SyncStatus | null;
  isLoading: boolean;
  onRefresh: () => void;
}

/**
 * SyncStatusCard
 * Displays blockchain event sync status with progress bar
 */
export function SyncStatusCard({
  status,
  isLoading,
  onRefresh,
}: SyncStatusCardProps) {
  // Calculate sync progress percentage
  const progressPercent =
    status && status.currentBlock > 0
      ? Math.min(
          100,
          ((status.currentBlock - status.blocksRemaining) /
            status.currentBlock) *
            100
        )
      : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Sync Status</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5! h-auto!"
        >
          <svg
            className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </Button>
      </CardHeader>

      <CardContent>
        {/* Loading State */}
        {isLoading && !status && (
          <div className="space-y-4">
            <div className="h-6 bg-ds-gray-300 rounded animate-pulse" />
            <div className="h-4 bg-ds-gray-300 rounded animate-pulse w-3/4" />
            <div className="h-2 bg-ds-gray-300 rounded-full animate-pulse" />
          </div>
        )}

        {/* Content */}
        {status && (
          <div className="space-y-4">
            {/* Sync Badge */}
            <div className="flex items-center gap-2">
              <Badge variant={status.isSynced ? "success" : "warning"}>
                <span
                  className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                    status.isSynced
                      ? "bg-ds-green-400"
                      : "bg-ds-yellow-400 animate-pulse"
                  }`}
                />
                {status.isSynced ? "Synced" : "Syncing..."}
              </Badge>
            </div>

            {/* Block Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">
                  Last Synced Block
                </p>
                <p className="text-lg font-geist-mono font-semibold text-ds-gray-1000">
                  {status.lastBlock.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">
                  Current Block
                </p>
                <p className="text-lg font-geist-mono font-semibold text-ds-gray-1000">
                  {status.currentBlock.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-2">
                <span>Sync Progress</span>
                <span className="font-geist-mono">{progressPercent.toFixed(2)}%</span>
              </div>
              <div className="h-1.5 bg-ds-gray-300 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    status.isSynced ? "bg-ds-green-400" : "bg-ds-blue-700"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Blocks Remaining */}
            {!status.isSynced && status.blocksRemaining > 0 && (
              <div className="bg-ds-gray-200 rounded-lg p-3 border border-ds-gray-400">
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                  Blocks Remaining
                </p>
                <p className="text-xl font-geist-mono font-semibold text-ds-yellow-400">
                  {status.blocksRemaining.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error/Empty State */}
        {!isLoading && !status && (
          <div className="text-center text-ds-gray-700 py-8">
            <svg
              className="w-10 h-10 mx-auto mb-3 text-ds-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm">Failed to load sync status</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
