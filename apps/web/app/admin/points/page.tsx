"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";
import { TriLayerOverview } from "@/components/admin/seasons";
import {
  DistributionTrigger,
  UserPointSearch,
  LeaderboardTable,
  MiningRatesTable,
  BaseLayerSection,
  SeasonLayerSection,
} from "@/components/admin/points";
import type {
  SeasonConfig,
  BasePointConfig,
  LeaderboardEntry,
  MiningRate,
  PointBalance,
  DistributionSummary,
} from "@/types/admin";
import toast from "react-hot-toast";

export default function PointsPage() {
  // Overview data
  const [activeSeason, setActiveSeason] = useState<SeasonConfig | null>(null);
  const [basePointConfig, setBasePointConfig] = useState<BasePointConfig | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Leaderboard & mining rates
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [miningRates, setMiningRates] = useState<MiningRate[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const [seasons, bpc] = await Promise.all([
        adminApi.getSeasons(),
        adminApi.getBasePointConfigCurrent().catch(() => null),
      ]);
      setActiveSeason(seasons.find((s: SeasonConfig) => s.status === "active") || null);
      setBasePointConfig(bpc);
    } catch {
      // silent
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const fetchLeaderboard = useCallback(async (offset: number = 0) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi.getLeaderboard({ limit: 20, offset });
      setLeaderboard(data.entries);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMiningRates = useCallback(async () => {
    try {
      const data = await adminApi.getMiningRates();
      setMiningRates(data);
    } catch {
      // optional
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    fetchLeaderboard();
    fetchMiningRates();
  }, [fetchOverview, fetchLeaderboard, fetchMiningRates]);

  const handleTriggerDistribution = async (date?: string): Promise<DistributionSummary> => {
    const result = await adminApi.triggerDistribution(date ? { date } : undefined);
    toast.success("Distribution completed successfully");
    fetchLeaderboard();
    fetchOverview();
    return result;
  };

  const handleSearchUser = async (address: string): Promise<PointBalance> => {
    return await adminApi.getPointBalance(address);
  };

  const handlePageChange = (offset: number) => {
    fetchLeaderboard(offset);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-ds-gray-1000">Points Distribution</h1>
        <p className="text-sm text-ds-gray-700">
          Manage point allocation across Base and Season layers
        </p>
      </div>

      {/* Distribution Overview (Bar Graph) */}
      <TriLayerOverview
        activeSeason={activeSeason}
        basePointConfig={basePointConfig}
        isLoading={overviewLoading}
      />

      {/* Base Layer Section */}
      <BaseLayerSection />

      {/* Season Layer Section */}
      <SeasonLayerSection />

      {/* Distribution Tools */}
      <div className="pt-4 border-t border-ds-gray-400">
        <h2 className="text-sm font-semibold text-ds-gray-1000 mb-4">Distribution Tools</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DistributionTrigger onTrigger={handleTriggerDistribution} />
          <UserPointSearch onSearch={handleSearchUser} />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-4 text-ds-red-400">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <LeaderboardTable
        entries={leaderboard}
        isLoading={isLoading}
        pagination={pagination}
        onPageChange={handlePageChange}
      />

      {/* Mining Rates */}
      <MiningRatesTable rates={miningRates} isLoading={false} />
    </div>
  );
}
