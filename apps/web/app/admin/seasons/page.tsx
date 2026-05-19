"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";
import { SeasonList, TriLayerOverview } from "@/components/admin/seasons";
import type { SeasonConfig, SeasonStatus, BasePointConfig } from "@/types/admin";
import toast from "react-hot-toast";

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<SeasonConfig[]>([]);
  const [basePointConfig, setBasePointConfig] = useState<BasePointConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSeasons = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [seasonsData, bpcData] = await Promise.all([
        adminApi.getSeasons(),
        adminApi.getBasePointConfigCurrent().catch(() => null),
      ]);
      setSeasons(seasonsData);
      setBasePointConfig(bpcData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load seasons");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons]);

  const handleStatusChange = async (id: number, status: SeasonStatus) => {
    try {
      await adminApi.updateSeasonStatus(id, { status });
      toast.success(`Season status updated to ${status}`);
      fetchSeasons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const activeSeason = seasons.find((s) => s.status === "active") || null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-ds-gray-1000">Season Management</h1>
        <p className="text-sm text-ds-gray-700">
          Manage point distribution seasons and the Tri-Layer allocation model
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-4 text-ds-red-400">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Tri-Layer Overview */}
      <TriLayerOverview
        activeSeason={activeSeason}
        basePointConfig={basePointConfig}
        isLoading={isLoading}
      />

      {/* Season List */}
      <SeasonList
        seasons={seasons}
        isLoading={isLoading}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
