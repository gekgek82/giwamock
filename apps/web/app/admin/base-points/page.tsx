"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";
import {
  CurrentConfigCard,
  RatioAdjustForm,
  ConfigHistoryTable,
} from "@/components/admin/base-points";
import type {
  BasePointConfig,
  UpdateBasePointConfigRequest,
} from "@/types/admin";
import toast from "react-hot-toast";

export default function BasePointsPage() {
  const [currentConfig, setCurrentConfig] = useState<BasePointConfig | null>(
    null
  );
  const [history, setHistory] = useState<BasePointConfig[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentConfig = useCallback(async () => {
    try {
      const data = await adminApi.getBasePointConfigCurrent();
      setCurrentConfig(data);
    } catch {
      // Current config may not exist yet
    }
  }, []);

  const fetchHistory = useCallback(async (offset: number = 0) => {
    try {
      const data = await adminApi.getBasePointConfigHistory(20, offset);
      setHistory(data.items);
      setPagination({ total: data.total, limit: 20, offset });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load config history"
      );
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      await Promise.all([fetchCurrentConfig(), fetchHistory()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchCurrentConfig, fetchHistory]);

  const handleUpdateConfig = async (data: UpdateBasePointConfigRequest) => {
    await adminApi.updateBasePointConfig(data);
    toast.success("Config updated successfully");
    await Promise.all([fetchCurrentConfig(), fetchHistory(pagination.offset)]);
  };

  const handlePageChange = (offset: number) => {
    fetchHistory(offset);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-ds-gray-1000">Base Point Config</h1>
        <p className="text-sm text-ds-gray-700">
          Manage LP/SWAP distribution ratio for the Base Layer (Tri-Layer Model)
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-4 text-ds-red-400">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5"
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

      {/* Top Row - Current Config + Ratio Adjust */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CurrentConfigCard config={currentConfig} isLoading={isLoading} />
        <RatioAdjustForm onSubmit={handleUpdateConfig} />
      </div>

      {/* Config History */}
      <ConfigHistoryTable
        items={history}
        isLoading={isLoading}
        pagination={pagination}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
