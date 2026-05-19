"use client";

import { useState } from "react";
import type { SyncTriggerResponse, SyncResetResponse } from "@/types/admin";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
} from "@/components/admin/ui";

interface SyncControlPanelProps {
  onTriggerSync: () => Promise<SyncTriggerResponse>;
  onResetSync: (fromBlock: number) => Promise<SyncResetResponse>;
  onRefresh: () => void;
}

/**
 * SyncControlPanel
 * Panel for sync control operations (trigger and reset)
 */
export function SyncControlPanel({
  onTriggerSync,
  onResetSync,
  onRefresh,
}: SyncControlPanelProps) {
  const [resetBlock, setResetBlock] = useState("");
  const [isTriggerLoading, setIsTriggerLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [result, setResult] = useState<{
    type: "trigger" | "reset";
    success: boolean;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTriggerSync = async () => {
    setError(null);
    setResult(null);
    setIsTriggerLoading(true);

    try {
      const response = await onTriggerSync();
      setResult({
        type: "trigger",
        success: response.success,
        message: response.message,
      });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger sync");
    } finally {
      setIsTriggerLoading(false);
    }
  };

  const handleResetSync = async () => {
    setShowResetConfirm(false);
    setError(null);
    setResult(null);

    const blockNumber = parseInt(resetBlock);
    if (isNaN(blockNumber) || blockNumber < 0) {
      setError("Please enter a valid block number");
      return;
    }

    setIsResetLoading(true);

    try {
      const response = await onResetSync(blockNumber);
      setResult({
        type: "reset",
        success: response.success,
        message: response.message,
      });
      setResetBlock("");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset sync");
    } finally {
      setIsResetLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Control</CardTitle>
        <CardDescription>
          Manual sync trigger and reset operations
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Trigger Sync Section */}
        <div className="pb-6 border-b border-ds-gray-400">
          <h4 className="text-xs font-semibold text-ds-gray-1000 mb-1">
            Manual Sync Trigger
          </h4>
          <p className="text-xs text-ds-gray-600 mb-4">
            Immediately run event synchronization regardless of the scheduler.
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={handleTriggerSync}
            disabled={isTriggerLoading || isResetLoading}
            loading={isTriggerLoading}
            className="w-full"
          >
            {isTriggerLoading ? (
              "Syncing..."
            ) : (
              <>
                <svg
                  className="w-4 h-4"
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
                Trigger Sync Now
              </>
            )}
          </Button>
        </div>

        {/* Reset Sync Section */}
        <div>
          <h4 className="text-xs font-semibold text-ds-gray-1000 mb-1">
            Sync Reset
          </h4>

          {/* Warning */}
          <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-4 h-4 text-ds-red-400 mt-0.5 shrink-0"
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
              <div className="text-sm text-ds-red-400">
                <p className="font-semibold">Warning: Dangerous Operation</p>
                <p className="text-ds-red-400/80 mt-0.5">
                  Resetting sync will re-process all events from the specified
                  block. This can take a long time and incur significant network
                  costs.
                </p>
              </div>
            </div>
          </div>

          {/* Block Input */}
          <div className="mb-4">
            <Input
              type="number"
              label="Reset to Block Number"
              value={resetBlock}
              onChange={(e) => setResetBlock(e.target.value)}
              placeholder="e.g., 10000000"
              disabled={isResetLoading || isTriggerLoading}
              min={0}
              className="font-geist-mono"
            />
          </div>

          {/* Reset Button */}
          <Button
            variant="danger"
            size="lg"
            onClick={() => setShowResetConfirm(true)}
            disabled={!resetBlock || isResetLoading || isTriggerLoading}
            loading={isResetLoading}
            className="w-full"
          >
            {isResetLoading ? (
              "Resetting..."
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z"
                  />
                </svg>
                Reset Sync
              </>
            )}
          </Button>
        </div>

        {/* Result Display */}
        {result && (
          <div
            className={`p-4 rounded-lg border ${
              result.success
                ? "bg-ds-green-700/10 border-ds-green-700/20"
                : "bg-ds-red-700/10 border-ds-red-700/20"
            }`}
          >
            <p
              className={`font-semibold text-sm ${
                result.success ? "text-ds-green-400" : "text-ds-red-400"
              }`}
            >
              {result.success ? "Success" : "Failed"}
            </p>
            <p className="text-sm text-ds-gray-700 mt-1">{result.message}</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-4 rounded-lg border bg-ds-red-700/10 border-ds-red-700/20">
            <p className="font-semibold text-ds-red-400 text-sm">Error</p>
            <p className="text-sm text-ds-red-400/80 mt-1">{error}</p>
          </div>
        )}

        {/* Reset Confirmation Dialog */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="max-w-md mx-4">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-ds-red-700/10 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-ds-red-400"
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
                    Confirm Reset
                  </h4>
                </div>

                <p className="text-sm text-ds-gray-700 mb-2">
                  Are you sure you want to reset sync to block{" "}
                  <span className="font-geist-mono font-medium text-ds-gray-1000">
                    {parseInt(resetBlock).toLocaleString()}
                  </span>
                  ?
                </p>
                <p className="text-xs text-ds-gray-600 mb-6">
                  This will re-process all events from this block to the current
                  block. This operation cannot be undone.
                </p>

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onClick={handleResetSync}
                    className="flex-1"
                  >
                    Confirm Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
