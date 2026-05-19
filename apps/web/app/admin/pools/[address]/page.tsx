"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { adminApi } from "@/lib/adminApi";
import type { AdminPoolDetailInfo, AdminPoolInfo, AdminPoolStats, AdminPoolTimeBucketDto } from "@/types/admin";
import { TokenPairIcon } from "@/components/common/TokenIcon";
import toast from "react-hot-toast";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Toggle,
} from "@/components/admin/ui";
import { PoolBalanceBar, CreateGaugeModal, PoolBucketsChart } from "@/components/admin/pools";
import {
  AdminFunctionForm,
  AddressInput,
  type TxStatus,
} from "@/components/admin/contracts";
import { useContractAddresses } from "@/hooks/useContractAddresses";
import { ABIs } from "@giwater/shared/abis";
import { spotPairBaseQuoteLabels } from "@/lib/spotPairDisplay";

/** Left = base, right = quote; maps reserve0/1 from the pair contract. */
function orientedBalanceBarProps(
  pool: AdminPoolInfo,
  stats: Pick<
    AdminPoolStats,
    "reserve0" | "reserve1" | "reserve0Usd" | "reserve1Usd"
  >,
) {
  const { baseSymbol, quoteSymbol } = spotPairBaseQuoteLabels(pool);
  const t0 = pool.token0Address.toLowerCase();
  const base = (pool.baseAddress ?? "").trim().toLowerCase();
  const baseIsToken0 = !base || base === t0;
  return {
    token0Symbol: baseSymbol,
    token1Symbol: quoteSymbol,
    token0Decimals: baseIsToken0 ? pool.token0Decimals : pool.token1Decimals,
    token1Decimals: baseIsToken0 ? pool.token1Decimals : pool.token0Decimals,
    reserve0: baseIsToken0 ? stats.reserve0 : stats.reserve1,
    reserve1: baseIsToken0 ? stats.reserve1 : stats.reserve0,
    reserve0Usd: baseIsToken0 ? stats.reserve0Usd : stats.reserve1Usd,
    reserve1Usd: baseIsToken0 ? stats.reserve1Usd : stats.reserve0Usd,
  };
}

export default function PoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const address = params.address as string;
 
  const [pool, setPool] = useState<AdminPoolDetailInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingVoting, setIsTogglingVoting] = useState(false);
  const [showGaugeModal, setShowGaugeModal] = useState(false);
  const [createGaugeFactory, setCreateGaugeFactory] = useState("");
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [bucketResolution, setBucketResolution] = useState<"5m" | "1h" | "1d" | "1w" | "1M">("1h");
  const [bucketItems, setBucketItems] = useState<AdminPoolTimeBucketDto[]>([]);
  const [isBucketsLoading, setIsBucketsLoading] = useState(false);

  const fetchPool = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi.getPool(address);
      setPool(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pool");
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  const fetchBuckets = useCallback(async () => {
    setIsBucketsLoading(true);
    try {
      const res = await adminApi.getPoolTimeBuckets(address, {
        resolution: bucketResolution,
        limit: 400,
      });
      setBucketItems(res.items || []);
    } catch {
      setBucketItems([]);
    } finally {
      setIsBucketsLoading(false);
    }
  }, [address, bucketResolution]);

  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  const handleRefreshStats = useCallback(async () => {
    setIsRefreshingStats(true);
    try {
      const data = await adminApi.refreshPoolStats(address);
      setPool(data);
      toast.success("Stats refreshed from on-chain");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh stats");
    } finally {
      setIsRefreshingStats(false);
    }
  }, [address]);

  // Contract interaction for Create Gauge
  const { contracts } = useContractAddresses();
  const publicClient = usePublicClient();
  const { data: gaugeHash, writeContract, isPending: isGaugePending, reset: resetGaugeTx, error: gaugeWriteError } = useWriteContract();
  const { isLoading: isGaugeConfirming, isSuccess: isGaugeSuccess, isError: isGaugeReceiptError } = useWaitForTransactionReceipt({ hash: gaugeHash });
  const [gaugeRevertReason, setGaugeRevertReason] = useState<string>();

  // Fetch on-chain revert reason when tx fails after confirmation
  useEffect(() => {
    if (!isGaugeReceiptError || !publicClient || !contracts?.voter || !createGaugeFactory || !pool) return;
    publicClient.simulateContract({
      address: contracts.voter as `0x${string}`,
      abi: ABIs.Voter,
      functionName: "createGauge",
      args: [createGaugeFactory as `0x${string}`, pool.address as `0x${string}`],
    }).catch((err: unknown) => {
      // viem decodes custom errors from ABI automatically
      const cause = (err as { cause?: { data?: { errorName?: string; args?: unknown[] } } })?.cause;
      const errorName = cause?.data?.errorName;
      if (errorName) {
        const args = cause?.data?.args;
        setGaugeRevertReason(`${errorName}(${args?.length ? args.join(", ") : ""})`);
      } else {
        const shortMsg = (err as { shortMessage?: string })?.shortMessage;
        setGaugeRevertReason(shortMsg || "Transaction reverted on-chain");
      }
    });
  }, [isGaugeReceiptError, publicClient, contracts?.voter, createGaugeFactory, pool]);

  const getGaugeTxStatus = (): TxStatus => {
    if (isGaugePending) return "pending";
    if (isGaugeConfirming) return "confirming";
    if (isGaugeSuccess) return "success";
    if (gaugeWriteError || isGaugeReceiptError) return "error";
    return "idle";
  };

  const getGaugeErrorMessage = (): string | undefined => {
    // On-chain revert with decoded reason
    if (isGaugeReceiptError) return gaugeRevertReason || "Transaction reverted on-chain";
    if (!gaugeWriteError) return undefined;
    const msg = gaugeWriteError.message || String(gaugeWriteError);
    // Extract contract revert reason if present
    const revertMatch = msg.match(/reason:\s*(.+?)(?:\n|$)/);
    if (revertMatch) return revertMatch[1].trim();
    // Extract known custom error names (e.g. GaugeExists())
    const customErrorMatch = msg.match(/error\s+(\w+\(\))/);
    if (customErrorMatch) return customErrorMatch[1];
    // Detect user rejection
    if (msg.toLowerCase().includes("user rejected") || msg.toLowerCase().includes("user denied")) {
      return "Transaction rejected by user";
    }
    // Fallback: first meaningful line, truncated
    const firstLine = msg.split("\n")[0];
    return firstLine.length > 120 ? firstLine.slice(0, 120) + "..." : firstLine;
  };

  const handleCreateGauge = useCallback(() => {
    if (!contracts?.voter || !createGaugeFactory || !pool) return;
    writeContract({
      address: contracts.voter as `0x${string}`,
      abi: ABIs.Voter,
      functionName: "createGauge",
      args: [
        createGaugeFactory as `0x${string}`,
        pool.address as `0x${string}`,
      ],
    });
  }, [contracts?.voter, createGaugeFactory, pool, writeContract]);

  // Pre-fill factory address when pool loads
  useEffect(() => {
    if (pool?.factoryAddress && !createGaugeFactory) {
      setCreateGaugeFactory(pool.factoryAddress);
    }
  }, [pool?.factoryAddress]);

  // Refresh pool data after gauge creation succeeds
  useEffect(() => {
    if (isGaugeSuccess) {
      fetchPool();
    }
  }, [isGaugeSuccess, fetchPool]);

  const handleToggleVoting = async () => {
    if (!pool) return;

    setIsTogglingVoting(true);
    try {
      await adminApi.updatePoolVoting(pool.address, !pool.isVotingEnabled);
      setPool((prev) =>
        prev ? { ...prev, isVotingEnabled: !prev.isVotingEnabled } : prev
      );
      toast.success(
        pool.isVotingEnabled
          ? "Voting disabled for pool"
          : "Voting enabled for pool"
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update voting status"
      );
    } finally {
      setIsTogglingVoting(false);
    }
  };

  const formatAddress = (addr: string): string => {
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatUsd = (value: string): string => {
    const num = parseFloat(value);
    if (isNaN(num)) return "$0.00";
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPercent = (value: string): string => {
    const num = parseFloat(value);
    if (isNaN(num)) return "0.00%";
    return `${num.toFixed(2)}%`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFeeRate = (feeRate: number | null): string => {
    if (feeRate === null) return "-";
    return `${(feeRate / 100).toFixed(2)}%`;
  };

  const formatUsdCompact = (n: number): string =>
    Number.isFinite(n)
      ? n.toLocaleString(undefined, { maximumFractionDigits: 4 })
      : "—";

  const pointTierLabel = (tier: number): string => {
    switch (tier) {
      case 1:
        return "Tier 1 (1.5x)";
      case 2:
        return "Tier 2 (1.0x)";
      case 3:
        return "Tier 3 (0.5x)";
      default:
        return `Tier ${tier}`;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-ds-gray-300 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-28 bg-ds-gray-300 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !pool) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.push("/admin/pools")}
          className="flex items-center gap-2 text-ds-gray-700 hover:text-ds-gray-1000 transition-colors"
        >
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Pools
        </button>
        <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-6 text-center">
          <p className="text-ds-red-400 text-sm">
            {error || "Pool not found"}
          </p>
        </div>
      </div>
    );
  }

  const stats = pool.stats;
  const pairLb = spotPairBaseQuoteLabels(pool);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.push("/admin/pools")}
        className="flex items-center gap-2 text-ds-gray-700 hover:text-ds-gray-1000 transition-colors text-sm"
      >
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Pools
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <TokenPairIcon
            leftAddress={pool.baseAddress ?? ""}
            leftSymbol={pairLb.baseSymbol}
            rightAddress={pool.quoteAddress ?? ""}
            rightSymbol={pairLb.quoteSymbol}
            size={48}
          />
          <div>
            <h1 className="text-xl font-semibold text-ds-gray-1000">
              {pairLb.baseSymbol || "—"} / {pairLb.quoteSymbol || "—"}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={pool.poolType === "CL" ? "success" : "warning"}>
                {pool.poolType === "CL" ? "CL" : "Basic"}
              </Badge>
              <Badge variant={pool.isStable ? "blue" : "purple"}>
                {pool.isStable ? "Stable" : "Volatile"}
              </Badge>
              <span className="text-sm text-ds-gray-700">
                Fee: {formatFeeRate(pool.feeRate)}
              </span>
              <span className="text-sm text-ds-gray-700">
                {pointTierLabel(pool.pointTier)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={fetchPool}>
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
            Refresh
          </Button>
          <Toggle
            checked={pool.isVotingEnabled}
            onChange={handleToggleVoting}
            disabled={isTogglingVoting}
            label="Voting"
          />
        </div>
      </div>

      {/* Pool Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pool Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow
              label="Pool Address"
              value={
                <a
                  href={`${process.env.NEXT_PUBLIC_GIWASCAN_URL}/address/${pool.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-geist-mono text-sm text-ds-blue-400 hover:text-ds-blue-700 transition-colors"
                >
                  {pool.address}
                </a>
              }
            />
            <InfoRow
              label="Factory Address"
              value={
                pool.factoryAddress ? (
                  <a
                    href={`${process.env.NEXT_PUBLIC_GIWASCAN_URL}/address/${pool.factoryAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-geist-mono text-sm text-ds-blue-400 hover:text-ds-blue-700 transition-colors"
                  >
                    {pool.factoryAddress}
                  </a>
                ) : (
                  <span className="text-ds-gray-600">-</span>
                )
              }
            />
            <InfoRow
              label="Base"
              value={
                <span className="text-sm text-ds-gray-1000">
                  {pairLb.baseSymbol || "—"} ({pool.baseName || "—"})
                  <span className="text-ds-gray-600 ml-2 font-geist-mono text-xs">
                    {pool.baseAddress ? formatAddress(pool.baseAddress) : "—"}
                  </span>
                </span>
              }
            />
            <InfoRow
              label="Quote"
              value={
                <span className="text-sm text-ds-gray-1000">
                  {pairLb.quoteSymbol || "—"} ({pool.quoteName || "—"})
                  <span className="text-ds-gray-600 ml-2 font-geist-mono text-xs">
                    {pool.quoteAddress ? formatAddress(pool.quoteAddress) : "—"}
                  </span>
                </span>
              }
            />
            <InfoRow label="Created" value={formatDate(pool.createdAt)} />
            <InfoRow label="Updated" value={formatDate(pool.updatedAt)} />
            <InfoRow
              label="Swap fees USD (total)"
              value={
                <span className="text-sm font-geist-mono text-ds-gray-1000">
                  {formatUsdCompact(pool.totalSwapFeesUsd)}
                </span>
              }
            />
            <InfoRow
              label="Swap fees USD (UTC day)"
              value={
                <span className="text-sm font-geist-mono text-ds-gray-1000">
                  {formatUsdCompact(pool.daySwapFeesUsd)}
                </span>
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Buckets chart (minute/hour/day/week/month) */}
      <div className="grid grid-cols-1 gap-4">
        <div className="relative">
          {isBucketsLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 rounded-lg">
              <div className="w-6 h-6 border-2 border-ds-gray-400 border-t-ds-gray-1000 rounded-full animate-spin" />
            </div>
          )}
          <PoolBucketsChart
            title="Pool buckets"
            items={bucketItems}
            resolution={bucketResolution}
            onResolutionChange={setBucketResolution}
          />
        </div>
      </div>

      {/* Stats Section */}
      {stats ? (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="TVL" value={formatUsd(stats.tvlUsd)} />
            <StatCard
              label="Volume (24h)"
              value={formatUsd(stats.volume24hUsd)}
            />
            <StatCard
              label="Volume (7d)"
              value={formatUsd(stats.volume7dUsd)}
            />
            <StatCard
              label="Fees (24h)"
              value={formatUsd(stats.fees24hUsd)}
            />
            <StatCard
              label="Fees (7d)"
              value={formatUsd(stats.fees7dUsd)}
            />
            <StatCard
              label="Total Fees"
              value={formatUsd(stats.feesTotalUsd)}
            />
            <StatCard
              label="TX Count (24h)"
              value={stats.txCount24h.toLocaleString()}
            />
            <StatCard label="APR (24h)" value={formatPercent(stats.apr24h)} />
            <StatCard label="APR (7d)" value={formatPercent(stats.apr7d)} />
          </div>

          {/* Pool Balance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pool Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <PoolBalanceBar
                poolType={pool.poolType}
                {...orientedBalanceBarProps(pool, stats)}
              />
            </CardContent>
          </Card>

          {/* Gauge Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Gauge Information</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.hasGauge ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow
                    label="Gauge Address"
                    value={
                      stats.gaugeAddress ? (
                        <a
                          href={`${process.env.NEXT_PUBLIC_GIWASCAN_URL}/address/${stats.gaugeAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-geist-mono text-sm text-ds-blue-400 hover:text-ds-blue-700 transition-colors"
                        >
                          {formatAddress(stats.gaugeAddress)}
                        </a>
                      ) : (
                        "-"
                      )
                    }
                  />
                  <InfoRow
                    label="Gauge Status"
                    value={
                      <Badge variant={stats.isGaugeAlive ? "success" : "error"}>
                        {stats.isGaugeAlive ? "Alive" : "Dead"}
                      </Badge>
                    }
                  />
                  <InfoRow
                    label="Emission APR"
                    value={
                      stats.emissionApr
                        ? formatPercent(stats.emissionApr)
                        : "-"
                    }
                  />
                  <InfoRow
                    label="Annual Emission (USD)"
                    value={
                      stats.annualEmissionUsd
                        ? formatUsd(stats.annualEmissionUsd)
                        : "-"
                    }
                  />
                  <InfoRow
                    label="Reward Rate"
                    value={
                      <span className="font-geist-mono text-sm text-ds-gray-1000">
                        {stats.rewardRate || "-"}
                      </span>
                    }
                  />
                  <InfoRow
                    label="Period Finish"
                    value={
                      stats.periodFinish
                        ? new Date(
                            Number(stats.periodFinish) * 1000
                          ).toLocaleString()
                        : "-"
                    }
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-ds-gray-700">
                      No gauge associated with this pool
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRefreshStats}
                      disabled={isRefreshingStats}
                      loading={isRefreshingStats}
                    >
                      Refresh
                    </Button>
                  </div>
                  <AdminFunctionForm
                    title="Create Gauge"
                    description="Create a new gauge for this pool via Voter contract"
                    permission="governor"
                    hasPermission={true}
                    onSubmit={handleCreateGauge}
                    submitLabel="Create Gauge"
                    isLoading={isGaugePending || isGaugeConfirming}
                    txStatus={getGaugeTxStatus()}
                    txHash={gaugeHash}
                    txError={getGaugeErrorMessage()}
                    onTxReset={() => { resetGaugeTx(); setGaugeRevertReason(undefined); }}
                  >
                    <AddressInput
                      label="Pool Factory Address"
                      value={createGaugeFactory}
                      onChange={setCreateGaugeFactory}
                      required
                      helperText="The factory that created this pool"
                    />
                    <div className="flex flex-col gap-1.5 mt-3">
                      <span className="text-xs font-medium text-ds-gray-800">Pool Address</span>
                      <span className="text-sm font-geist-mono text-ds-gray-700">{pool.address}</span>
                    </div>
                  </AdminFunctionForm>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Updated */}
          <p className="text-xs text-ds-gray-600 text-right">
            Stats updated: {formatDate(stats.updatedAt)}
          </p>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-ds-gray-700">
              No statistics available for this pool
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create Gauge Modal */}
      {pool && (
        <CreateGaugeModal
          isOpen={showGaugeModal}
          onClose={() => setShowGaugeModal(false)}
          poolAddress={pool.address}
          factoryAddress={pool.factoryAddress}
          {...pairLb}
          onSuccess={fetchPool}
        />
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">{label}</span>
      <span className="text-ds-gray-1000 text-sm">
        {typeof value === "string" ? value : value}
      </span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-xl font-semibold text-ds-gray-1000 font-geist-mono">{value}</p>
      </CardContent>
    </Card>
  );
}
