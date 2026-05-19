"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";
import type {
  ReferralOverview,
  ReferrerListItem,
  ReferrerDetail,
  ReferralTier,
} from "@/types/admin";
import toast from "react-hot-toast";
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/admin/ui";

// ============================================================================
// Helper Components
// ============================================================================

function TierBadge({ tier }: { tier: ReferralTier }) {
  const config = {
    GENERAL: { label: "General", variant: "default" as const },
    KOL_TIER1: { label: "KOL Tier 1", variant: "blue" as const },
    KOL_TIER2: { label: "KOL Tier 2", variant: "purple" as const },
  }[tier];

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-semibold text-ds-gray-1000">{value}</p>
        {sub && <p className="text-xs text-ds-gray-600 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function formatNumber(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function ReferralsPage() {
  // Overview state
  const [overview, setOverview] = useState<ReferralOverview | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);

  // List state
  const [referrers, setReferrers] = useState<ReferrerListItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listTotal, setListTotal] = useState(0);
  const [listOffset, setListOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"ALL" | ReferralTier>("ALL");
  const listLimit = 20;

  // Detail state
  const [selectedDetail, setSelectedDetail] = useState<ReferrerDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isUpdatingTier, setIsUpdatingTier] = useState(false);

  // Provision state
  const [showProvision, setShowProvision] = useState(false);
  const [provisionAddress, setProvisionAddress] = useState("");
  const [provisionTier, setProvisionTier] = useState<"KOL_TIER1" | "KOL_TIER2" | "NONE">("NONE");
  const [isProvisioning, setIsProvisioning] = useState(false);

  // ============================================================================
  // Data fetching
  // ============================================================================

  const fetchOverview = useCallback(async () => {
    try {
      const data = await adminApi.getReferralOverview();
      setOverview(data);
    } catch (err) {
      console.error("Failed to fetch overview:", err);
    } finally {
      setIsLoadingOverview(false);
    }
  }, []);

  const fetchReferrerList = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const data = await adminApi.getReferrerList({
        limit: listLimit,
        offset: listOffset,
        search: searchQuery || undefined,
        tierFilter,
      });
      setReferrers(data.items);
      setListTotal(data.total);
    } catch (err) {
      console.error("Failed to fetch referrer list:", err);
      toast.error("Failed to load referrer list");
    } finally {
      setIsLoadingList(false);
    }
  }, [listOffset, searchQuery, tierFilter]);

  const fetchDetail = useCallback(async (address: string) => {
    setIsLoadingDetail(true);
    try {
      const data = await adminApi.getReferrerDetail(address);
      setSelectedDetail(data);
    } catch (err) {
      console.error("Failed to fetch detail:", err);
      toast.error("Failed to load referrer detail");
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    fetchReferrerList();
  }, [fetchReferrerList]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setListOffset(0);
    fetchReferrerList();
  };

  const handleTierChange = async (
    address: string,
    newTier: "KOL_TIER1" | "KOL_TIER2" | "NONE"
  ) => {
    setIsUpdatingTier(true);
    try {
      await adminApi.updateKolTier(address, { badgeType: newTier });
      toast.success(
        `Tier updated to ${newTier === "NONE" ? "General" : newTier}`
      );
      // Refresh data
      await Promise.all([
        fetchOverview(),
        fetchReferrerList(),
        selectedDetail?.address === address.toLowerCase()
          ? fetchDetail(address)
          : Promise.resolve(),
      ]);
    } catch (err) {
      console.error("Failed to update tier:", err);
      toast.error("Failed to update KOL tier");
    } finally {
      setIsUpdatingTier(false);
    }
  };

  const handleCloseDetail = () => setSelectedDetail(null);

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provisionAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast.error("Invalid Ethereum address");
      return;
    }
    setIsProvisioning(true);
    try {
      const result = await adminApi.provisionReferrer({
        address: provisionAddress,
        badgeType: provisionTier,
      });
      toast.success(
        `Provisioned! Code: ${result.referralCode}, Tier: ${result.tier}`
      );
      setProvisionAddress("");
      setProvisionTier("NONE");
      setShowProvision(false);
      await Promise.all([fetchOverview(), fetchReferrerList()]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to provision referrer";
      toast.error(message);
    } finally {
      setIsProvisioning(false);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ds-gray-1000">Referral Management</h1>
          <p className="text-sm text-ds-gray-700 mt-1">
            Manage referral tiers, view referral stats, and upgrade/downgrade KOL tiers
          </p>
        </div>
        <Button
          variant={showProvision ? "outline" : "primary"}
          size="md"
          onClick={() => setShowProvision(!showProvision)}
        >
          {showProvision ? "Cancel" : "+ Provision Referrer"}
        </Button>
      </div>

      {/* Provision Form */}
      {showProvision && (
        <Card className="border-ds-blue-700/30">
          <CardContent>
            <form onSubmit={handleProvision} className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-ds-gray-1000">
                  Provision New Referrer
                </p>
                <p className="text-xs text-ds-gray-700 mt-0.5">
                  Pre-assign tier and generate referral code for an address
                </p>
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    type="text"
                    value={provisionAddress}
                    onChange={(e) => setProvisionAddress(e.target.value)}
                    placeholder="0x... wallet address"
                    className="font-geist-mono"
                  />
                </div>
                <Select
                  value={provisionTier}
                  onChange={(e) =>
                    setProvisionTier(e.target.value as "KOL_TIER1" | "KOL_TIER2" | "NONE")
                  }
                  options={[
                    { value: "NONE", label: "General (10%)" },
                    { value: "KOL_TIER1", label: "KOL Tier 1 (15%)" },
                    { value: "KOL_TIER2", label: "KOL Tier 2 (20%)" },
                  ]}
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={isProvisioning}
                  disabled={!provisionAddress}
                >
                  {isProvisioning ? "Provisioning..." : "Provision"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Overview Stats */}
      {isLoadingOverview ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent>
                <div className="h-16 bg-ds-gray-300 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total Referrers" value={overview.totalReferrers} />
          <StatCard label="Total Referees" value={overview.totalReferees} />
          <StatCard
            label="Rewards Distributed"
            value={formatNumber(overview.totalRewardsDistributed)}
            sub="points"
          />
          <StatCard
            label="General"
            value={overview.generalCount}
            sub={`${(overview.rates.general * 100).toFixed(0)}% rate`}
          />
          <StatCard
            label="KOL Tier 1"
            value={overview.kolTier1Count}
            sub={`${(overview.rates.kolTier1 * 100).toFixed(0)}% rate`}
          />
          <StatCard
            label="KOL Tier 2"
            value={overview.kolTier2Count}
            sub={`${(overview.rates.kolTier2 * 100).toFixed(0)}% rate`}
          />
        </div>
      ) : null}

      {/* Search & Filter */}
      <Card>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex gap-3 flex-1">
              <div className="flex-1">
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by address or referral code..."
                  className="font-geist-mono"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={isLoadingList}
              >
                Search
              </Button>
            </form>
            <Select
              value={tierFilter}
              onChange={(e) => {
                setTierFilter(e.target.value as "ALL" | ReferralTier);
                setListOffset(0);
              }}
              options={[
                { value: "ALL", label: "All Tiers" },
                { value: "GENERAL", label: "General" },
                { value: "KOL_TIER1", label: "KOL Tier 1" },
                { value: "KOL_TIER2", label: "KOL Tier 2" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Referrer List */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Address</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead className="text-right">Referees</TableHead>
            <TableHead className="text-right">Rewards Earned</TableHead>
            <TableHead className="text-center">Actions</TableHead>
            <TableHead>Applied at</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoadingList ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={8}>
                  <div className="h-4 bg-ds-gray-300 rounded animate-pulse" />
                </TableCell>
              </TableRow>
            ))
          ) : referrers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12 text-ds-gray-700">
                No referrers found
              </TableCell>
            </TableRow>
          ) : (
            referrers.map((r) => (
              <TableRow key={r.address}>
                <TableCell>
                  <button
                    onClick={() => fetchDetail(r.address)}
                    className="font-geist-mono text-sm text-ds-blue-400 hover:text-ds-blue-700 transition-colors duration-100"
                  >
                    {shortenAddress(r.address)}
                  </button>
                </TableCell>
                <TableCell className="font-geist-mono text-sm">{r.referralCode}</TableCell>
                <TableCell>
                  <TierBadge tier={r.tier} />
                </TableCell>
                <TableCell className="text-right text-sm">
                  {(r.referralRate * 100).toFixed(0)}%
                </TableCell>
                <TableCell className="text-right text-sm">
                  {r.activeReferees}/{r.totalReferees}
                </TableCell>
                <TableCell className="text-right text-sm font-geist-mono">
                  {formatNumber(r.totalRewardsEarned)}
                </TableCell>
                <TableCell className="text-center">
                  <TierDropdown
                    currentTier={r.tier}
                    onChangeTier={(tier) => handleTierChange(r.address, tier)}
                    disabled={isUpdatingTier}
                  />
                </TableCell>
                <TableCell className="text-sm text-ds-gray-700 whitespace-nowrap">
                  {r.tierAppliedAt
                    ? new Date(r.tierAppliedAt).toLocaleDateString()
                    : "\u2014"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {listTotal > listLimit && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-ds-gray-700">
            Showing {listOffset + 1}-{Math.min(listOffset + listLimit, listTotal)} of {listTotal}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setListOffset(Math.max(0, listOffset - listLimit))}
              disabled={listOffset === 0}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setListOffset(listOffset + listLimit)}
              disabled={listOffset + listLimit >= listTotal}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Detail Panel (Slide-over) */}
      {selectedDetail && (
        <DetailPanel
          detail={selectedDetail}
          isLoading={isLoadingDetail}
          isUpdatingTier={isUpdatingTier}
          onClose={handleCloseDetail}
          onChangeTier={handleTierChange}
        />
      )}
    </div>
  );
}

// ============================================================================
// Tier Dropdown Component
// ============================================================================

function TierDropdown({
  currentTier,
  onChangeTier,
  disabled,
}: {
  currentTier: ReferralTier;
  onChangeTier: (tier: "KOL_TIER1" | "KOL_TIER2" | "NONE") => void;
  disabled: boolean;
}) {
  return (
    <select
      value={currentTier === "GENERAL" ? "NONE" : currentTier}
      onChange={(e) =>
        onChangeTier(e.target.value as "KOL_TIER1" | "KOL_TIER2" | "NONE")
      }
      disabled={disabled}
      className="h-8 px-2 rounded-md border border-ds-gray-400 hover:border-ds-gray-500 bg-ds-background-100 text-sm text-ds-gray-900 appearance-none transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="NONE">General</option>
      <option value="KOL_TIER1">KOL Tier 1</option>
      <option value="KOL_TIER2">KOL Tier 2</option>
    </select>
  );
}

// ============================================================================
// Detail Panel Component
// ============================================================================

function DetailPanel({
  detail,
  isLoading,
  isUpdatingTier,
  onClose,
  onChangeTier,
}: {
  detail: ReferrerDetail;
  isLoading: boolean;
  isUpdatingTier: boolean;
  onClose: () => void;
  onChangeTier: (address: string, tier: "KOL_TIER1" | "KOL_TIER2" | "NONE") => void;
}) {
  const [activeTab, setActiveTab] = useState<"referees" | "rewards">("referees");

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="ml-auto relative w-full max-w-2xl bg-ds-background-200 border-l border-ds-gray-400 overflow-y-auto">
        {isLoading && (
          <div className="absolute inset-0 bg-ds-background-200/80 flex items-center justify-center z-10">
            <div className="animate-spin w-8 h-8 border-2 border-ds-blue-700 border-t-transparent rounded-full" />
          </div>
        )}

        {/* Header */}
        <div className="sticky top-0 bg-ds-background-200 border-b border-ds-gray-400 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ds-gray-1000">Referrer Detail</h2>
            <p className="font-geist-mono text-xs text-ds-gray-700 mt-0.5">{detail.address}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-ds-gray-200 rounded-md transition-colors duration-100"
          >
            <svg className="w-5 h-5 text-ds-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info Section */}
        <div className="p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent>
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Referral Code</p>
                <p className="text-lg font-semibold font-geist-mono text-ds-gray-1000">{detail.referralCode}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Tier & Rate</p>
                <div className="flex items-center gap-2">
                  <TierBadge tier={detail.tier} />
                  <span className="text-ds-gray-1000 font-semibold">{(detail.referralRate * 100).toFixed(0)}%</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Referees</p>
                <p className="text-lg font-semibold text-ds-gray-1000">
                  {detail.activeReferees}
                  <span className="text-sm font-normal text-ds-gray-600">
                    {" "}/ {detail.totalReferees} total
                  </span>
                </p>
                {detail.invalidReferees > 0 && (
                  <p className="text-xs text-ds-red-400 mt-1">
                    {detail.invalidReferees} invalidated
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Total Rewards</p>
                <p className="text-lg font-semibold font-geist-mono text-ds-gray-1000">
                  {formatNumber(detail.totalRewardsEarned)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tier Management */}
          <Card>
            <CardContent>
              <p className="text-sm font-semibold text-ds-gray-1000 mb-3">Change KOL Tier</p>
              <div className="flex gap-2">
                {(["NONE", "KOL_TIER1", "KOL_TIER2"] as const).map((tier) => {
                  const isActive =
                    (tier === "NONE" && detail.tier === "GENERAL") ||
                    tier === detail.tier;
                  const labels = {
                    NONE: "General (10%)",
                    KOL_TIER1: "KOL Tier 1 (15%)",
                    KOL_TIER2: "KOL Tier 2 (20%)",
                  };
                  return (
                    <Button
                      key={tier}
                      variant={isActive ? "primary" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => onChangeTier(detail.address, tier)}
                      disabled={isActive || isUpdatingTier}
                    >
                      {labels[tier]}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Badge Info */}
          {detail.badge && (
            <Card>
              <CardContent>
                <p className="text-sm font-semibold text-ds-gray-1000 mb-2">Active Badge</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-ds-gray-600">Type: </span>
                    <span className="text-ds-gray-1000">{detail.badge.badgeType}</span>
                  </div>
                  <div>
                    <span className="text-ds-gray-600">Active: </span>
                    <span className={detail.badge.isActive ? "text-ds-green-400" : "text-ds-red-400"}>
                      {detail.badge.isActive ? "Yes" : "No"}
                    </span>
                  </div>
                  <div>
                    <span className="text-ds-gray-600">Granted: </span>
                    <span className="text-ds-gray-1000">{new Date(detail.badge.grantedAt).toLocaleDateString()}</span>
                  </div>
                  {detail.badge.expiresAt && (
                    <div>
                      <span className="text-ds-gray-600">Expires: </span>
                      <span className="text-ds-gray-1000">{new Date(detail.badge.expiresAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <div className="border-b border-ds-gray-400">
            <div className="flex gap-4">
              {(["referees", "rewards"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors duration-100 ${
                    activeTab === tab
                      ? "border-ds-gray-1000 text-ds-gray-1000"
                      : "border-transparent text-ds-gray-600 hover:text-ds-gray-1000"
                  }`}
                >
                  {tab === "referees" ? `Referees (${detail.referees.length})` : `Recent Rewards (${detail.recentRewards.length})`}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "referees" ? (
            <div className="space-y-2">
              {detail.referees.length === 0 ? (
                <p className="text-ds-gray-700 text-sm py-4 text-center">No referees</p>
              ) : (
                detail.referees.map((ref) => (
                  <div
                    key={ref.address}
                    className="bg-ds-gray-100 rounded-lg p-3 flex items-center justify-between border border-ds-gray-400"
                  >
                    <div>
                      <p className="font-geist-mono text-sm text-ds-gray-1000">{shortenAddress(ref.address)}</p>
                      <p className="text-xs text-ds-gray-600">
                        Joined {new Date(ref.createdAt).toLocaleDateString()}
                        {ref.fundingSource && (
                          <span> | Source: {shortenAddress(ref.fundingSource)}</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-geist-mono text-ds-gray-1000">{formatNumber(ref.rewardsGenerated)} pts</p>
                      <span
                        className={`text-xs ${
                          ref.isValid ? "text-ds-green-400" : "text-ds-red-400"
                        }`}
                      >
                        {ref.isValid ? "Valid" : ref.invalidationReason || "Invalid"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {detail.recentRewards.length === 0 ? (
                <p className="text-ds-gray-700 text-sm py-4 text-center">No rewards yet</p>
              ) : (
                detail.recentRewards.map((reward, i) => (
                  <div
                    key={i}
                    className="bg-ds-gray-100 rounded-lg p-3 flex items-center justify-between border border-ds-gray-400"
                  >
                    <div>
                      <p className="font-geist-mono text-xs text-ds-gray-700">
                        Referee: {shortenAddress(reward.refereeAddress)}
                      </p>
                      <p className="text-xs text-ds-gray-600">
                        {reward.date} | Rate: {(parseFloat(reward.rewardRate) * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-geist-mono text-ds-gray-1000">{formatNumber(reward.rewardPoints)} pts</p>
                      <p className="text-xs text-ds-gray-600">
                        base: {formatNumber(reward.basePoints)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
