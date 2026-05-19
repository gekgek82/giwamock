"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";
import {
  SyncStatusCard,
  BackfillStatusCard,
  RebuildPanel,
  SyncControlPanel,
} from "@/components/admin/indexer";
import { Button } from "@/components/admin/ui";
import type { SyncStatus, BackfillStatus, RebuildStatus } from "@/types/admin";

/**
 * IndexerPage
 * Admin page for managing blockchain indexer operations
 */
export default function IndexerPage() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [backfillStatus, setBackfillStatus] = useState<BackfillStatus | null>(
    null
  );
  const [rebuildStatus, setRebuildStatus] = useState<RebuildStatus | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all status data
  const fetchAllStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [syncData, backfillData, rebuildData] = await Promise.allSettled([
        adminApi.getSyncStatus(),
        adminApi.getBackfillStatus(),
        adminApi.getRebuildStatus(),
      ]);

      if (syncData.status === "fulfilled") {
        setSyncStatus(syncData.value);
      }

      if (backfillData.status === "fulfilled") {
        setBackfillStatus(backfillData.value);
      }

      if (rebuildData.status === "fulfilled") {
        setRebuildStatus(rebuildData.value);
      }

      // Check if all requests failed
      if (
        syncData.status === "rejected" &&
        backfillData.status === "rejected" &&
        rebuildData.status === "rejected"
      ) {
        setError("Failed to load indexer status. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch individual status functions
  const fetchSyncStatus = useCallback(async () => {
    try {
      const data = await adminApi.getSyncStatus();
      setSyncStatus(data);
    } catch (err) {
      console.error("Failed to fetch sync status:", err);
    }
  }, []);

  const fetchBackfillStatus = useCallback(async () => {
    try {
      const data = await adminApi.getBackfillStatus();
      setBackfillStatus(data);
    } catch (err) {
      console.error("Failed to fetch backfill status:", err);
    }
  }, []);

  const fetchRebuildStatus = useCallback(async () => {
    try {
      const data = await adminApi.getRebuildStatus();
      setRebuildStatus(data);
    } catch (err) {
      console.error("Failed to fetch rebuild status:", err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAllStatus();
  }, [fetchAllStatus]);

  // Rebuild handlers
  const handleRebuildLp = async (batchSize: number) => {
    return adminApi.rebuildLpPositions(batchSize);
  };

  const handleRebuildLock = async (batchSize: number) => {
    return adminApi.rebuildLockPositions(batchSize);
  };

  const handleRebuildVote = async (batchSize: number) => {
    return adminApi.rebuildVotePositions(batchSize);
  };

  const handleRebuildAll = async () => {
    return adminApi.rebuildAll();
  };

  // Sync control handlers
  const handleTriggerSync = async () => {
    return adminApi.triggerSync();
  };

  const handleResetSync = async (fromBlock: number) => {
    return adminApi.resetSync(fromBlock);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ds-gray-1000">
            Indexer Management
          </h1>
          <p className="text-sm text-ds-gray-700 mt-1">
            Blockchain event sync & state table rebuild
          </p>
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={fetchAllStatus}
          loading={isLoading}
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
          Refresh All
        </Button>
      </div>

      {/* Global Error Alert */}
      {error && (
        <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-4 text-ds-red-400">
          <div className="flex items-center gap-2">
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
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Status Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SyncStatusCard
          status={syncStatus}
          isLoading={isLoading}
          onRefresh={fetchSyncStatus}
        />
        <BackfillStatusCard
          status={backfillStatus}
          isLoading={isLoading}
          onRefresh={fetchBackfillStatus}
        />
      </div>

      {/* Rebuild Panel */}
      <RebuildPanel
        rebuildStatus={rebuildStatus}
        isLoading={isLoading}
        onRebuildLp={handleRebuildLp}
        onRebuildLock={handleRebuildLock}
        onRebuildVote={handleRebuildVote}
        onRebuildAll={handleRebuildAll}
        onRefreshStatus={fetchRebuildStatus}
      />

      {/* Sync Control Panel */}
      <SyncControlPanel
        onTriggerSync={handleTriggerSync}
        onResetSync={handleResetSync}
        onRefresh={fetchSyncStatus}
      />
    </div>
  );
}
