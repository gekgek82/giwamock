"use client";

import type { BackfillStatus } from "@/types/admin";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
} from "@/components/admin/ui";

interface BackfillStatusCardProps {
  status: BackfillStatus | null;
  isLoading: boolean;
  onRefresh: () => void;
}

/**
 * Truncate address for display
 */
function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * BackfillStatusCard
 * Displays backfill queue status and pending jobs
 */
export function BackfillStatusCard({
  status,
  isLoading,
  onRefresh,
}: BackfillStatusCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Backfill Status</CardTitle>
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
            <div className="h-20 bg-ds-gray-300 rounded animate-pulse" />
          </div>
        )}

        {/* Content */}
        {status && (
          <div className="space-y-4">
            {/* Queue Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-ds-gray-200 rounded-lg p-3 border border-ds-gray-400">
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">
                  Queue Size
                </p>
                <p className="text-2xl font-geist-mono font-semibold text-ds-gray-1000">
                  {status.size}
                </p>
              </div>
              <div className="bg-ds-gray-200 rounded-lg p-3 border border-ds-gray-400">
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">
                  Processing
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      status.isProcessing
                        ? "bg-ds-green-400 animate-pulse"
                        : "bg-ds-gray-600"
                    }`}
                  />
                  <span
                    className={`text-lg font-medium ${
                      status.isProcessing
                        ? "text-ds-green-400"
                        : "text-ds-gray-700"
                    }`}
                  >
                    {status.isProcessing ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>

            {/* Jobs List */}
            {status.jobs.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-2">
                  Pending Jobs
                </p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {status.jobs.map((job, index) => (
                    <div
                      key={`${job.poolAddress}-${job.fromBlock}`}
                      className="flex items-center justify-between bg-ds-gray-200 rounded-lg px-3 py-2 hover:bg-ds-gray-100 transition-colors duration-100 border border-ds-gray-400"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-ds-gray-600 font-geist-mono">
                          #{index + 1}
                        </span>
                        <code className="text-sm text-ds-gray-1000 font-geist-mono">
                          {truncateAddress(job.poolAddress)}
                        </code>
                      </div>
                      <span className="text-xs text-ds-gray-700">
                        from block{" "}
                        <span className="font-geist-mono text-ds-gray-1000">
                          {job.fromBlock.toLocaleString()}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-ds-gray-700 py-4">
                <svg
                  className="w-8 h-8 mx-auto mb-2 text-ds-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm">No pending backfill jobs</p>
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
            <p className="text-sm">Failed to load backfill status</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
