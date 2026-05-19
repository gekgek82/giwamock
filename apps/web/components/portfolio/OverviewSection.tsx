"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { portfolioApi, type PortfolioOverview } from "@/lib/portfolioApi";
import { useClaimPoints } from "@/hooks/useClaimPoints";
import { useClaimRewards } from "@/hooks/useClaimRewards";
import { useTPointUserLocks } from "@/hooks/useTPointLocks";
import { IS_PRE_TGE } from "@/lib/config";
import { getMockDemoAddress, isMockMode } from "@/lib/mockTransactions";
import { ClaimPointsModal } from "./ClaimPointsModal";
import { ClaimRewardsModal } from "./ClaimRewardsModal";
import { Button } from "@/components/common/Button";

// Format USD value for display
function formatUsd(value: string | null | undefined): string {
  if (!value) return "$0";
  const num = parseFloat(value);
  if (isNaN(num)) return "$0";
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Format percentage for display
function formatPercent(value: string | null | undefined): string {
  if (!value) return "0%";
  const num = parseFloat(value);
  if (isNaN(num)) return "0%";
  return `${num.toFixed(2)}%`;
}

interface OverviewSectionProps {
  /** Bumped by the parent after a section-triggered claim succeeds (e.g.
   *  Vote tab's Claim All). Re-fetches the pending rewards summary so the
   *  just-claimed amount disappears from the top card. */
  refreshKey?: number;
}

export function OverviewSection({ refreshKey }: OverviewSectionProps = {}) {
  const t = useTranslations();
  const { address, isConnected } = useAccount();
  const effectiveAddress = address ?? (isMockMode() ? getMockDemoAddress() : undefined);
  const effectiveIsConnected = isConnected || isMockMode();
  const [overview, setOverview] = useState<PortfolioOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isClaimRewardsModalOpen, setIsClaimRewardsModalOpen] = useState(false);

  const {
    claimPoints,
    status: claimStatus,
    claimData,
    txHash,
    reset: resetClaim,
  } = useClaimPoints();

  const {
    status: claimRewardsStatus,
    claimableRewards,
    error: claimRewardsError,
    txHashes: claimRewardsTxHashes,
    fetchClaimable,
    claimRewards,
    reset: resetClaimRewards,
  } = useClaimRewards();
  const { summary: tpointSummary } = useTPointUserLocks();

  useEffect(() => {
    if (!effectiveIsConnected || !effectiveAddress) {
      setOverview(null);
      return;
    }

    const fetchOverview = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await portfolioApi.getOverview(effectiveAddress);
        setOverview(data);
      } catch (err) {
        // 404 means new user with no positions
        if (
          err instanceof Error &&
          "statusCode" in err &&
          (err as { statusCode?: number }).statusCode === 404
        ) {
          setOverview(null);
        } else {
          setError(
            err instanceof Error ? err.message : "Failed to fetch portfolio",
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchOverview();
  }, [effectiveAddress, effectiveIsConnected, refreshKey]);

  // Refetch overview after successful claim
  useEffect(() => {
    if (claimStatus === "success" && effectiveAddress) {
      const timer = setTimeout(async () => {
        try {
          const data = await portfolioApi.getOverview(effectiveAddress);
          setOverview(data);
        } catch {
          // ignore refetch errors
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [claimStatus, effectiveAddress]);

  // Refetch overview after successful rewards claim
  useEffect(() => {
    if (claimRewardsStatus === "success" && effectiveAddress) {
      const timer = setTimeout(async () => {
        try {
          const data = await portfolioApi.getOverview(effectiveAddress);
          setOverview(data);
        } catch {
          // ignore refetch errors
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [claimRewardsStatus, effectiveAddress]);

  const hasClaimablePoints =
    overview?.pendingRewards.terPoint.amount &&
    parseFloat(overview.pendingRewards.terPoint.amount) > 0;

  // Default values for empty/no wallet state
  const displayData = {
    activePools: overview?.assetsByPool.activePools ?? 0,
    totalDeposit: formatUsd(overview?.assetsByPool.totalDepositUsd),
    avgNetAPR: formatPercent(overview?.assetsByPool.avgNetApr),
    unclaimedRewards: formatUsd(overview?.pendingRewards.totalUnclaimedUsd),
    fee: formatUsd(overview?.pendingRewards.fee.totalUsd),
    terPoint: overview?.pendingRewards.terPoint.amount
      ? parseFloat(overview.pendingRewards.terPoint.amount).toLocaleString(undefined, { maximumFractionDigits: 5 })
      : "0",
    onChainTerPoint: (() => {
      const onChain = parseFloat(
        overview?.pendingRewards.terPoint.onChainBalance ?? "0",
      );
      const locked = IS_PRE_TGE
        ? parseFloat(tpointSummary?.totalLocked ?? "0")
        : 0;
      const available = Math.max(0, onChain - locked);
      return available.toLocaleString(undefined, { maximumFractionDigits: 5 });
    })(),
    vote: IS_PRE_TGE
      ? parseFloat(tpointSummary?.totalVotingPower ?? "0").toLocaleString(undefined, { maximumFractionDigits: 5 })
      : overview?.pendingRewards.vote
        ? parseFloat(overview.pendingRewards.vote.amount).toFixed(5)
        : "0",
  };

  if (!effectiveIsConnected) {
    return (
      <div className="bg-white rounded-[40px] p-8 text-center">
        <p className="text-neutral-700 text-base">
          {t("common.connectWallet")}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="px-2">
          <div className="h-9 bg-gray-30 rounded w-1/4 animate-pulse" />
        </div>
        <div className="flex flex-col lg:flex-row justify-between items-stretch gap-5">
          <div className="w-full bg-white rounded-[40px] pb-[30px] pt-[30px] px-[30px] animate-pulse">
            <div className="h-[30px] bg-gray-30 rounded w-1/3 mb-6" />
            <div className="space-y-5">
              <div className="h-20 bg-gray-20 rounded-[20px]" />
              <div className="h-6 bg-gray-20 rounded" />
              <div className="h-6 bg-gray-20 rounded" />
            </div>
          </div>
          <div className="w-full bg-white rounded-[40px] pb-[30px] pt-[30px] px-[30px] animate-pulse">
            <div className="h-[30px] bg-gray-30 rounded w-1/3 mb-6" />
            <div className="space-y-2.5">
              <div className="h-20 bg-gray-20 rounded-[20px]" />
              <div className="h-6 bg-gray-20 rounded" />
              <div className="h-6 bg-gray-20 rounded" />
              <div className="h-6 bg-gray-20 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-[40px] p-8 text-center">
        <p className="text-red-600 text-base">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="px-2">
        <h2 className="text-gray-100 text-2xl font-bold leading-9">
          {t("portfolio.overview")}
        </h2>
      </div>
      {/* Cards Row */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch gap-5">
        {/* Assets By Pool Card */}
        <div className="w-full bg-white rounded-[40px] pb-[30px] flex flex-col items-center gap-5">
          {/* Card Header */}
          <div className="w-full pt-[30px] flex flex-col items-center gap-3">
            <div className="w-full px-[30px] flex items-center">
              <span className="flex-1 text-gray-100 text-xl font-bold leading-[30px]">
                {t("portfolio.assetsByPool")}
              </span>
            </div>
            <div className="w-full h-0 border-t border-gray-30" />
          </div>

          {/* Card Body */}
          <div className="w-full px-[30px] flex flex-col gap-5">
            {/* Active Pools - Highlight Box */}
            <div className="w-full p-[30px] bg-gray-20 rounded-[20px] flex items-center justify-between">
              <span className="text-gray-100 text-base font-bold leading-6">
                {t("portfolio.activePools")}
              </span>
              <span className="text-right text-gray-100 text-2xl font-bold leading-9">
                {displayData.activePools}
              </span>
            </div>

            {/* Detail Rows */}
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="text-gray-100 text-base font-semibold leading-6">
                  {t("portfolio.totalDeposit")}
                </span>
                <span className="text-right text-gray-100 text-xl font-bold leading-[30px]">
                  {displayData.totalDeposit}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-100 text-base font-semibold leading-6">
                  {t("portfolio.avgNetAPR")}
                </span>
                <span className="text-right text-gray-100 text-xl font-bold leading-[30px]">
                  {displayData.avgNetAPR}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Rewards Card */}
        <div className="w-full bg-white rounded-[40px] pb-[30px] flex flex-col items-center gap-5">
          {/* Card Header */}
          <div className="w-full pt-[30px] flex flex-col items-center gap-3">
            <div className="w-full px-[30px] flex items-center">
              <span className="flex-1 text-gray-100 text-xl font-bold leading-[30px]">
                {t("portfolio.pendingRewards")}
              </span>
            </div>
            <div className="w-full h-0 border-t border-gray-30" />
          </div>

          {/* Card Body */}
          <div className="w-full px-[30px] flex flex-col gap-2.5">
            {/* Unclaimed Rewards - Highlight Box */}
            <div className="w-full p-[30px] bg-gray-20 rounded-[20px] flex items-center justify-between">
              <span className="flex-1 text-gray-100 text-base font-bold leading-6">
                {t("portfolio.unclaimedRewards")}
              </span>
              <div className="flex items-center justify-end gap-2">
                <span className="text-right text-gray-100 text-2xl font-bold leading-9">
                  ≈ {displayData.unclaimedRewards} + α
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsClaimRewardsModalOpen(true)}
                  disabled={
                    !overview?.pendingRewards.totalUnclaimedUsd ||
                    parseFloat(overview.pendingRewards.totalUnclaimedUsd) <= 0
                  }
                >
                  {t("portfolio.claimAll")}
                </Button>
              </div>
            </div>

            {/* Detail Rows */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-gray-100 text-base font-semibold leading-6">
                  {t("vote.fees")}
                </span>
                <span className="text-right text-gray-100 text-xl font-bold leading-[30px]">
                  ≈ {displayData.fee}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-100 text-base font-semibold leading-6">
                  Claimable Point
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-right text-gray-100 text-xl font-bold leading-[30px]">
                    {displayData.terPoint}
                  </span>
                  {hasClaimablePoints && (
                    <Button size="sm" onClick={() => setIsClaimModalOpen(true)}>
                      {t("portfolio.claim")}
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-100 text-base font-semibold leading-6">
                  tPOINT
                </span>
                <span className="text-right text-primary-300 text-xl font-bold leading-[30px]">
                  {displayData.onChainTerPoint}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-100 text-base font-semibold leading-6">
                  vePoint
                </span>
                <span className="text-right text-gray-100 text-xl font-bold leading-[30px]">
                  {displayData.vote}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Claim Points Modal */}
      <ClaimPointsModal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        status={claimStatus}
        claimData={claimData}
        txHash={txHash}
        onClaim={claimPoints}
        onReset={resetClaim}
      />

      {/* Claim Rewards Modal */}
      <ClaimRewardsModal
        isOpen={isClaimRewardsModalOpen}
        onClose={() => setIsClaimRewardsModalOpen(false)}
        status={claimRewardsStatus}
        claimableRewards={claimableRewards}
        txHashes={claimRewardsTxHashes}
        error={claimRewardsError}
        onFetchClaimable={fetchClaimable}
        onClaim={() => claimRewards("all")}
        onReset={resetClaimRewards}
      />
    </div>
  );
}
