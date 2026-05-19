"use client";

import { useState, useEffect } from "react";
import { adminApi } from "@/lib/adminApi";
import { BadgeList } from "@/components/admin/badges";
import { SeasonBadgeSection } from "@/components/admin/badges/SeasonBadgeSection";
import { CustomBadgeSection } from "@/components/admin/badges/CustomBadgeSection";
import { Button } from "@/components/admin/ui";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/admin/ui";
import type { UserBadge, SeasonConfig } from "@/types/admin";

type Tab = "season" | "custom";

export default function BadgesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("season");
  const [seasons, setSeasons] = useState<SeasonConfig[]>([]);

  // User badge search state
  const [searchAddress, setSearchAddress] = useState("");
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearched, setIsSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getSeasons()
      .then(setSeasons)
      .catch(() => {});
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchAddress) return;

    setIsSearchLoading(true);
    setSearchError(null);
    setIsSearched(true);

    try {
      const data = await adminApi.getUserBadges(searchAddress);
      setBadges(data);
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : "Failed to fetch badges",
      );
      setBadges([]);
    } finally {
      setIsSearchLoading(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "season", label: "Season Badges" },
    { key: "custom", label: "Custom Badges" },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-ds-gray-1000">Badge Management</h1>
        <p className="text-sm text-ds-gray-700">
          Manage season and custom badge definitions
        </p>
      </div>

      {/* User Badge Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search User Badges</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              placeholder="Enter wallet address (0x...)"
              className="flex-1 h-9 px-3 bg-ds-background-100 border border-ds-gray-400 rounded-md text-sm text-ds-gray-900 placeholder:text-ds-gray-600 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 font-geist-mono"
            />
            <Button
              type="submit"
              disabled={isSearchLoading || !searchAddress}
              loading={isSearchLoading}
            >
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Search Error */}
      {searchError && (
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
            <span className="text-sm">{searchError}</span>
          </div>
        </div>
      )}

      {/* Search Results */}
      {isSearched && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ds-gray-1000">
              Badges for{" "}
              <span className="font-geist-mono">
                {searchAddress.slice(0, 6)}...
                {searchAddress.slice(-4)}
              </span>
            </h3>
            <span className="text-sm text-ds-gray-700">
              {badges.length} badge(s)
            </span>
          </div>
          <BadgeList badges={badges} isLoading={isSearchLoading} />
        </div>
      )}

      {/* Pill Tab Navigation */}
      <div className="inline-flex bg-ds-gray-200 rounded-md p-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-[5px] transition-colors duration-150 ${
              activeTab === tab.key
                ? "bg-ds-gray-1000 text-ds-background-100"
                : "text-ds-gray-700 hover:text-ds-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "season" && <SeasonBadgeSection seasons={seasons} />}
      {activeTab === "custom" && <CustomBadgeSection />}
    </div>
  );
}
