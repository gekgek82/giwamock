"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";
import { BlacklistTable, AddBlacklistForm } from "@/components/admin/blacklist";
import type { BlacklistEntry, AddBlacklistRequest, SeasonConfig } from "@/types/admin";
import toast from "react-hot-toast";
import { Button, Card, CardContent, Badge } from "@/components/admin/ui";

export default function BlacklistPage() {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [currentSeason, setCurrentSeason] = useState<SeasonConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [blacklistData, seasonData] = await Promise.allSettled([
        adminApi.getBlacklist(),
        adminApi.getCurrentSeason(),
      ]);

      if (blacklistData.status === "fulfilled") {
        setEntries(blacklistData.value);
      }

      if (seasonData.status === "fulfilled") {
        setCurrentSeason(seasonData.value);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load blacklist");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = async (data: AddBlacklistRequest) => {
    await adminApi.addToBlacklist(data);
    toast.success("User added to blacklist");
    fetchData();
  };

  const handleRemove = async (address: string, seasonId: number) => {
    if (!confirm(`Are you sure you want to remove ${address.slice(0, 10)}... from the blacklist?`)) {
      return;
    }

    try {
      await adminApi.removeFromBlacklist(address, seasonId);
      toast.success("User removed from blacklist");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove from blacklist");
    }
  };

  // Calculate summary stats
  const activeEntries = entries.filter((e) => e.isActive);
  const totalForfeited = entries.reduce((sum, e) => sum + parseFloat(e.forfeitedPoints || "0"), 0);
  const reasonCounts = entries.reduce((acc, e) => {
    acc[e.reason] = (acc[e.reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ds-gray-1000">Blacklist Management</h1>
          <p className="text-sm text-ds-gray-700 mt-1">Manage banned users and forfeited points</p>
        </div>
        <Button
          variant="danger"
          size="md"
          onClick={() => setIsFormOpen(true)}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          Add to Blacklist
        </Button>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Total Blacklisted</p>
            <p className="text-2xl font-semibold text-ds-gray-1000">{entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Currently Active</p>
            <p className="text-2xl font-semibold text-ds-red-400">{activeEntries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Total Forfeited</p>
            <p className="text-2xl font-semibold text-ds-gray-1000">{totalForfeited.toLocaleString()} Pts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">By Reason</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(reasonCounts).slice(0, 3).map(([reason, count]) => (
                <Badge key={reason} variant="default">
                  {reason.split("_")[0]}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blacklist Table */}
      <BlacklistTable
        entries={entries}
        isLoading={isLoading}
        onRemove={handleRemove}
      />

      {/* Add Form Modal */}
      <AddBlacklistForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleAdd}
        currentSeasonId={currentSeason?.id || 1}
      />
    </div>
  );
}
