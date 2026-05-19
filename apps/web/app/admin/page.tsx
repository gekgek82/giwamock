"use client";

import { useState, useEffect } from "react";
import { adminApi } from "@/lib/adminApi";
import {
  SeasonOverview,
  QuickStats,
  LeaderboardPreview,
  ProtocolCharts,
} from "@/components/admin/dashboard";
import type {
  SeasonConfig,
  LeaderboardEntry,
  DashboardStats,
} from "@/types/admin";

export default function AdminDashboardPage() {
  const [currentSeason, setCurrentSeason] = useState<SeasonConfig | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [seasonData, leaderboardData, statsData] =
          await Promise.allSettled([
            adminApi.getCurrentSeason(),
            adminApi.getLeaderboard({ limit: 10 }),
            adminApi.getDashboardStats(),
          ]);

        if (seasonData.status === "fulfilled") {
          setCurrentSeason(seasonData.value);
        }

        if (leaderboardData.status === "fulfilled") {
          setLeaderboard(leaderboardData.value.entries);
        }

        if (statsData.status === "fulfilled") {
          setDashboardStats(statsData.value);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load dashboard data"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ds-gray-1000">
            Dashboard
          </h1>
          <p className="text-sm text-ds-gray-700 mt-0.5">Protocol Overview</p>
        </div>
        <span className="text-xs text-ds-gray-600 font-geist-mono">
          {new Date().toLocaleString()}
        </span>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg px-4 py-3 flex items-center gap-2.5">
          <svg
            className="w-4 h-4 text-ds-red-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm text-ds-red-400">{error}</span>
        </div>
      )}

      {/* Quick Stats — 5 protocol-level boxes */}
      <QuickStats stats={dashboardStats} isLoading={isLoading} />

      {/* Season Overview — full width */}
      <SeasonOverview season={currentSeason} isLoading={isLoading} />

      {/* Protocol Charts — TVL, Volume, Fees bar chart (full width) */}
      <ProtocolCharts />

      {/* Leaderboard Preview */}
      <LeaderboardPreview entries={leaderboard} isLoading={isLoading} />
    </div>
  );
}
