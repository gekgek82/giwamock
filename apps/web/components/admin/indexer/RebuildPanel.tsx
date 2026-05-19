"use client";

import { useState } from "react";
import type {
  RebuildStatus,
  RebuildResponse,
  RebuildResult,
} from "@/types/admin";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Input,
} from "@/components/admin/ui";

interface RebuildPanelProps {
  rebuildStatus: RebuildStatus | null;
  isLoading: boolean;
  onRebuildLp: (batchSize: number) => Promise<RebuildResponse>;
  onRebuildLock: (batchSize: number) => Promise<RebuildResponse>;
  onRebuildVote: (batchSize: number) => Promise<RebuildResponse>;
  onRebuildAll: () => Promise<RebuildResponse>;
  onRefreshStatus: () => void;
}

type RebuildType = "lp" | "lock" | "vote" | "all";

/**
 * RebuildPanel
 * Panel for managing rebuild operations on state tables
 */
export function RebuildPanel({
  rebuildStatus,
  isLoading,
  onRebuildLp,
  onRebuildLock,
  onRebuildVote,
  onRebuildAll,
  onRefreshStatus,
}: RebuildPanelProps) {
  const [batchSize, setBatchSize] = useState(1000);
  const [isRebuilding, setIsRebuilding] = useState<RebuildType | null>(null);
  const [lastResult, setLastResult] = useState<RebuildResponse | null>(null);
  const [showConfirm, setShowConfirm] = useState<RebuildType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDisabled = rebuildStatus?.isRunning || isRebuilding !== null;

  const handleRebuild = async (type: RebuildType) => {
    setShowConfirm(null);
    setError(null);
    setIsRebuilding(type);
    setLastResult(null);

    try {
      let result: RebuildResponse;

      switch (type) {
        case "lp":
          result = await onRebuildLp(batchSize);
          break;
        case "lock":
          result = await onRebuildLock(batchSize);
          break;
        case "vote":
          result = await onRebuildVote(batchSize);
          break;
        case "all":
          result = await onRebuildAll();
          break;
      }

      setLastResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rebuild failed");
    } finally {
      setIsRebuilding(null);
      onRefreshStatus();
    }
  };

  const rebuildButtons: {
    type: RebuildType;
    label: string;
    description: string;
  }[] = [
    {
      type: "lp",
      label: "LP Positions",
      description: "MINT/BURN/Liquidity events",
    },
    {
      type: "lock",
      label: "Lock Positions",
      description: "VE Deposit/Withdraw events",
    },
    {
      type: "vote",
      label: "Vote Positions",
      description: "Voted/Abstained events",
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Rebuild Operations</CardTitle>
          <CardDescription>
            Rebuild state tables from blockchain events
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefreshStatus}
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

      <CardContent className="space-y-6">
        {/* Warning Banner */}
        <div className="bg-ds-yellow-700/10 border border-ds-yellow-700/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-4 h-4 text-ds-yellow-400 mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="text-sm text-ds-yellow-400">
              <p className="font-semibold">Caution</p>
              <p className="text-ds-yellow-400/80 mt-0.5">
                Rebuild operations may take several minutes and affect service
                performance. Only one rebuild can run at a time.
              </p>
            </div>
          </div>
        </div>

        {/* Rebuild Status */}
        {rebuildStatus && (
          <div>
            <Badge variant={rebuildStatus.isRunning ? "warning" : "success"}>
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  rebuildStatus.isRunning
                    ? "bg-ds-yellow-400 animate-pulse"
                    : "bg-ds-green-400"
                }`}
              />
              {rebuildStatus.isRunning ? "Rebuild in Progress" : "Idle"}
            </Badge>
          </div>
        )}

        {/* Batch Size Input */}
        <Input
          type="number"
          label="Batch Size"
          value={batchSize}
          onChange={(e) =>
            setBatchSize(Math.max(100, parseInt(e.target.value) || 1000))
          }
          disabled={isDisabled}
          min={100}
          max={10000}
          hint="Recommended: 500-2000. Higher values use more memory."
          className="font-geist-mono"
        />

        {/* Rebuild Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {rebuildButtons.map(({ type, label, description }) => (
            <button
              key={type}
              onClick={() => setShowConfirm(type)}
              disabled={isDisabled}
              className={`relative p-4 rounded-lg border text-left transition-colors duration-100 ${
                isDisabled
                  ? "bg-ds-gray-200 border-ds-gray-400 cursor-not-allowed opacity-50"
                  : "bg-ds-gray-200 border-ds-gray-400 hover:bg-ds-gray-100 hover:border-ds-gray-500"
              }`}
            >
              {isRebuilding === type && (
                <div className="absolute inset-0 flex items-center justify-center bg-ds-gray-200/80 rounded-lg">
                  <svg
                    className="w-5 h-5 text-ds-blue-700 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              )}
              <p className="font-medium text-ds-gray-1000 mb-1">{label}</p>
              <p className="text-xs text-ds-gray-700">{description}</p>
            </button>
          ))}
        </div>

        {/* Rebuild All Button */}
        <Button
          variant="danger"
          size="lg"
          onClick={() => setShowConfirm("all")}
          disabled={isDisabled}
          loading={isRebuilding === "all"}
          className="w-full"
        >
          {isRebuilding === "all" ? "Rebuilding All..." : "Rebuild All Tables"}
        </Button>

        {/* Result Display */}
        {lastResult && (
          <div
            className={`p-4 rounded-lg border ${
              lastResult.success
                ? "bg-ds-green-700/10 border-ds-green-700/20"
                : "bg-ds-red-700/10 border-ds-red-700/20"
            }`}
          >
            <p
              className={`font-semibold mb-2 text-sm ${
                lastResult.success ? "text-ds-green-400" : "text-ds-red-400"
              }`}
            >
              {lastResult.success ? "Rebuild Complete" : "Rebuild Failed"}
            </p>
            <p className="text-sm text-ds-gray-700">{lastResult.message}</p>
            {lastResult.result && "processed" in lastResult.result && (
              <ResultDetails result={lastResult.result} />
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-4 rounded-lg border bg-ds-red-700/10 border-ds-red-700/20">
            <p className="font-semibold text-ds-red-400 text-sm mb-1">Error</p>
            <p className="text-sm text-ds-red-400/80">{error}</p>
          </div>
        )}

        {/* Confirmation Dialog */}
        {showConfirm && (
          <ConfirmDialog
            type={showConfirm}
            onConfirm={() => handleRebuild(showConfirm)}
            onCancel={() => setShowConfirm(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Result Details Component
 */
function ResultDetails({ result }: { result: RebuildResult }) {
  return (
    <div className="mt-3 grid grid-cols-4 gap-3 text-center">
      <div>
        <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
          Processed
        </p>
        <p className="text-lg font-geist-mono text-ds-gray-1000">
          {result.processed}
        </p>
      </div>
      <div>
        <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
          Successful
        </p>
        <p className="text-lg font-geist-mono text-ds-green-400">
          {result.successful}
        </p>
      </div>
      <div>
        <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
          Failed
        </p>
        <p className="text-lg font-geist-mono text-ds-red-400">
          {result.failed}
        </p>
      </div>
      <div>
        <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
          Duration
        </p>
        <p className="text-lg font-geist-mono text-ds-gray-1000">
          {result.duration}ms
        </p>
      </div>
    </div>
  );
}

/**
 * Confirmation Dialog Component
 */
function ConfirmDialog({
  type,
  onConfirm,
  onCancel,
}: {
  type: RebuildType;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const typeLabels: Record<RebuildType, string> = {
    lp: "LP Positions",
    lock: "Lock Positions",
    vote: "Vote Positions",
    all: "All Tables",
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-ds-yellow-700/10 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-ds-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-ds-gray-1000">
              Confirm Rebuild
            </h4>
          </div>

          <p className="text-sm text-ds-gray-700 mb-6">
            Are you sure you want to rebuild{" "}
            <span className="font-medium text-ds-gray-1000">
              {typeLabels[type]}
            </span>
            ? This operation may take several minutes.
          </p>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onConfirm}
              className="flex-1"
            >
              Confirm
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
