"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { adminApi } from "@/lib/adminApi";
import { gatewayBrokerApi } from "@/lib/gatewayBrokerApi";
import { PoolTable } from "@/components/admin/pools";
import type { AdminPoolInfo } from "@/types/admin";
import toast from "react-hot-toast";
import { Button, Card, CardContent, Input } from "@/components/admin/ui";

const RISING_GROUP_ID = "giwater_rising_pairs";

const GRADE_NAMES: Record<number, string> = {
  1: "Verified",
  2: "Rising",
  3: "Unknown",
};

type FilterType = "all" | "verified" | "rising" | "unknown";

export default function PoolsPage() {
  const [pools, setPools] = useState<AdminPoolInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [risingSet, setRisingSet] = useState<Set<string>>(new Set());

  const fetchPools = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [poolsResponse, risingMembers] = await Promise.all([
        adminApi.getPools(),
        gatewayBrokerApi
          .listGroupPairs({ groupId: RISING_GROUP_ID, offset: 0, limit: 500 })
          .catch(() => ({ items: [] } as any)),
      ]);
      setPools(poolsResponse.pools);
      setRisingSet(
        new Set(
          (risingMembers.items ?? []).map((m: any) =>
            String(m.pairId ?? "").toLowerCase(),
          ),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pools");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  // Toggle voting enabled status
  const handleToggleVoting = async (address: string, isVotingEnabled: boolean) => {
    try {
      await adminApi.updatePoolVoting(address, isVotingEnabled);
      toast.success(
        isVotingEnabled ? "Voting enabled for pool" : "Voting disabled for pool",
      );
      setPools((prev) =>
        prev.map((pool) =>
          pool.address === address ? { ...pool, isVotingEnabled } : pool,
        ),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update voting status",
      );
      throw err;
    }
  };

  const handleToggleListed = async (address: string, listed: boolean) => {
    try {
      await adminApi.updatePoolListed(address, { listed });
      toast.success(listed ? "Pool listed" : "Pool unlisted");
      setPools((prev) =>
        prev.map((pool) =>
          pool.address === address ? { ...pool, listed } : pool,
        ),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update listed");
      throw err;
    }
  };

  const handleToggleRising = async (address: string, inRising: boolean) => {
    const addr = address.toLowerCase();
    try {
      if (inRising) {
        try {
          await gatewayBrokerApi.addPairToGroup(RISING_GROUP_ID, {
            pairAddress: address,
          });
        } catch {
          await gatewayBrokerApi.createSpotPairGroup({
            id: RISING_GROUP_ID,
            name: "Rising Pairs",
            description: "Admin-curated rising pair list",
          });
          await gatewayBrokerApi.addPairToGroup(RISING_GROUP_ID, {
            pairAddress: address,
          });
        }
        setRisingSet((prev) => new Set(prev).add(addr));
        toast.success("Added to rising pairs");
      } else {
        await gatewayBrokerApi.removePairFromGroup({
          groupId: RISING_GROUP_ID,
          pairAddress: address,
        });
        setRisingSet((prev) => {
          const next = new Set(prev);
          next.delete(addr);
          return next;
        });
        toast.success("Removed from rising pairs");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to toggle rising",
      );
      throw err;
    }
  };

  // Change pool grade (labeling)
  const handleChangeGrade = async (address: string, grade: 1 | 2 | 3) => {
    try {
      await adminApi.updatePoolGrade(address, { grade, isManualOverride: true });
      toast.success(`Pool labeling updated to ${GRADE_NAMES[grade]}`);
      const isVotingEnabled = grade === 1;
      setPools((prev) =>
        prev.map((pool) =>
          pool.address === address
            ? { ...pool, grade, isGradeManualOverride: true, isVotingEnabled }
            : pool,
        ),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update labeling",
      );
      throw err;
    }
  };

  // Filter and search pools
  const filteredPools = useMemo(() => {
    return pools.filter((pool) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        q === "" ||
        pool.token0Symbol.toLowerCase().includes(q) ||
        pool.token1Symbol.toLowerCase().includes(q) ||
        pool.token0Name?.toLowerCase().includes(q) ||
        pool.token1Name?.toLowerCase().includes(q) ||
        pool.address.toLowerCase().includes(q);

      let matchesFilter = true;
      if (filter === "verified") matchesFilter = pool.grade === 1;
      if (filter === "rising") matchesFilter = pool.grade === 2;
      if (filter === "unknown") matchesFilter = pool.grade === 3;

      return matchesSearch && matchesFilter;
    });
  }, [pools, searchQuery, filter]);

  // Calculate summary stats
  const basicPoolCount = pools.filter((p) => p.poolType !== "CL").length;
  const clPoolCount = pools.filter((p) => p.poolType === "CL").length;
  const verifiedCount = pools.filter((p) => p.grade === 1).length;
  const risingCount = pools.filter((p) => p.grade === 2).length;
  const unknownCount = pools.filter((p) => p.grade === 3).length;

  const filterTabs: { key: FilterType; label: string; count: number }[] = [
    { key: "all", label: "All", count: pools.length },
    { key: "verified", label: "Verified", count: verifiedCount },
    { key: "rising", label: "Rising", count: risingCount },
    { key: "unknown", label: "Unknown", count: unknownCount },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ds-gray-1000">Pool Management</h1>
          <p className="text-sm text-ds-gray-700 mt-1">
            Manage pool labeling and voting status
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={fetchPools}
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
          Refresh
        </Button>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">
              Total Pools
            </p>
            <p className="text-2xl font-semibold text-ds-gray-1000">
              {pools.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">
              Verified Pools
            </p>
            <p className="text-2xl font-semibold text-ds-blue-400">
              {verifiedCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">
              Rising Pools
            </p>
            <p className="text-2xl font-semibold text-ds-gray-900">{risingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">
              Unknown Pools
            </p>
            <p className="text-2xl font-semibold text-ds-yellow-400">
              {unknownCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">
              Basic Pools
            </p>
            <p className="text-2xl font-semibold text-ds-yellow-400">
              {basicPoolCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">
              CL Pools
            </p>
            <p className="text-2xl font-semibold text-ds-green-400">{clPoolCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Filter Tabs */}
        <div className="flex gap-1 p-1 bg-ds-gray-200 rounded-lg border border-ds-gray-400">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-100 ${
                filter === tab.key
                  ? "bg-ds-background-200 text-ds-gray-1000 shadow-sm"
                  : "text-ds-gray-700 hover:text-ds-gray-900"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Search by token symbol, name, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Pool Table (existing UI) */}
      <PoolTable
        pools={filteredPools}
        isLoading={isLoading}
        onToggleListed={handleToggleListed}
        onToggleVoting={handleToggleVoting}
        onChangeGrade={handleChangeGrade}
        risingSet={risingSet}
        onToggleRising={handleToggleRising}
      />
    </div>
  );
}
