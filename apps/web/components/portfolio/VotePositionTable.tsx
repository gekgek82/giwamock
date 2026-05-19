"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAccount, useSendTransaction, usePublicClient } from "wagmi";
import toast from "react-hot-toast";
import { portfolioApi } from "@/lib/portfolioApi";
import {
  getMockDemoAddress,
  isMockMode,
  simulateMockTransaction,
} from "@/lib/mockTransactions";
import type { VotePosition, VotePositionsResponse } from "@/types/portfolio";
import { Pagination } from "./Pagination";
import { TokenPairIcon } from "@/components/common/TokenIcon";
import { Button } from "@/components/common/Button";

function InfoIcon() {
  return (
    <span className="w-4 h-4 inline-flex items-center justify-center bg-gray-10 rounded-full text-[10px] text-gray-70 shrink-0">
      i
    </span>
  );
}

function ColumnHeader({
  children,
  className = "",
  showInfo = false,
}: {
  children: React.ReactNode;
  className?: string;
  showInfo?: boolean;
}) {
  return (
    <div
      className={`p-2.5 flex items-center justify-center gap-1 ${className}`}
    >
      <span className="text-center text-gray-100 body-14-bold">
        {children}
      </span>
      {showInfo && <InfoIcon />}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="w-full px-[30px]">
      <div className="bg-gray-20 rounded-[20px] p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-12 bg-white/50 rounded" />
          <div className="h-12 bg-white/50 rounded" />
        </div>
      </div>
      <div className="space-y-4 mt-5">
        <div className="h-20 bg-gray-20 rounded animate-pulse" />
        <div className="h-20 bg-gray-20 rounded animate-pulse" />
      </div>
    </div>
  );
}

// Column widths, shared between header and rows so columns align.
const COL = {
  tokenPair: "w-[130px] shrink-0",
  strategy: "w-[140px] shrink-0",
  apr: "w-[100px] shrink-0",
  lockNo: "w-[110px] shrink-0",
  lockedAmount: "w-[130px] shrink-0",
  swapFee: "flex-1 min-w-[160px]",
  incentive: "flex-1 min-w-[140px]",
  claim: "w-[140px] shrink-0",
};

function formatAmount(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "0";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 5,
  });
}

function formatAprPercent(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "0.00%";
  return `${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}%`;
}

function strategyLabel(position: VotePosition): string {
  if (position.poolType === "CL") {
    const suffix = position.tickSpacing != null ? ` ${position.tickSpacing}` : "";
    return `${position.strategy} ${position.volatility}${suffix}`.trim();
  }
  return `${position.strategy} ${position.volatility}`.trim();
}

interface VotePositionTableProps {
  onPositionCountChange?: (count: number) => void;
  /** Fired after a successful Claim All so the parent can refresh sibling
   *  sections (Overview summary, Transaction history). */
  onClaimSuccess?: () => void;
}

/** Silent polling interval — the Vote tab reflects live rewards accrual, but
 *  the underlying backend call makes several eth_calls per request so we only
 *  refresh every 30s (kept quiet: no loading skeleton flicker). */
const VOTE_REFRESH_INTERVAL_MS = 30_000;

export function VotePositionTable({
  onPositionCountChange,
  onClaimSuccess,
}: VotePositionTableProps) {
  const t = useTranslations();
  const { address, isConnected } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const effectiveIsConnected = isConnected || Boolean(effectiveAddress);
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const [data, setData] = useState<VotePositionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isClaimingAll, setIsClaimingAll] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const itemsPerPage = 10;

  /**
   * Fetches vote positions. `silent=true` is used by the polling interval so
   * the table data swaps in place without triggering the skeleton loader —
   * otherwise the tab would visibly flash every 30s.
   */
  const fetchPositions = useCallback(
    async (silent: boolean = false) => {
      if (!effectiveIsConnected || !effectiveAddress) {
        setData(null);
        onPositionCountChange?.(0);
        return;
      }

      if (!silent) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const offset = (currentPage - 1) * itemsPerPage;
        const response = await portfolioApi.getVotePositions(
          effectiveAddress,
          undefined,
          itemsPerPage,
          offset,
        );
        setData(response);
        setTotalPages(Math.ceil(response.pagination.total / itemsPerPage));
        onPositionCountChange?.(response.pagination.total);
      } catch (err) {
        if (
          err instanceof Error &&
          "statusCode" in err &&
          (err as { statusCode?: number }).statusCode === 404
        ) {
          setData(null);
          onPositionCountChange?.(0);
        } else if (!silent) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to fetch vote positions",
          );
        }
        // Silent failures are swallowed — the existing table stays visible
        // and the next tick will retry.
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [effectiveAddress, effectiveIsConnected, currentPage, onPositionCountChange],
  );

  useEffect(() => {
    fetchPositions(false);
  }, [fetchPositions, refreshKey]);

  // Real-time polling: silently refetch every 30s while connected and the
  // tab is visible. Pauses automatically when the user switches tabs away.
  useEffect(() => {
    if (!effectiveIsConnected || !effectiveAddress) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (!document.hidden) fetchPositions(true);
      }, VOTE_REFRESH_INTERVAL_MS);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    start();
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        // Refresh immediately when coming back, then resume the interval.
        fetchPositions(true);
        start();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchPositions, effectiveIsConnected, effectiveAddress]);

  const handleClaimAll = async () => {
    if (!effectiveAddress) return;
    setIsClaimingAll(true);
    try {
      toast.loading(t("portfolio.claimInProgress"), { id: "vote-claim-all" });
      const response = await portfolioApi.claimRewards(effectiveAddress, {
        claimType: "all",
      });

      if (response.transactions.length === 0) {
        toast.dismiss("vote-claim-all");
        toast(t("portfolio.noClaimableRewards"), { id: "vote-claim-all" });
        return;
      }

      for (const tx of response.transactions) {
        const txHash = isMockMode()
          ? await simulateMockTransaction({
              label: `vote-claim-all:${tx.to}:${tx.data}`,
            })
          : await sendTransactionAsync({
              to: tx.to as `0x${string}`,
              data: tx.data as `0x${string}`,
              value: BigInt(tx.value),
            });

        if (!isMockMode() && publicClient && txHash) {
          await publicClient.waitForTransactionReceipt({
            hash: txHash,
            confirmations: 1,
          });

          try {
            await portfolioApi.notifyTransaction(txHash);
          } catch {
            // Non-critical — notification is best-effort.
          }
        }
      }

      toast.success(t("portfolio.claimRewardsSuccess"), {
        id: "vote-claim-all",
      });
      setRefreshKey((k) => k + 1);
      onClaimSuccess?.();
    } catch (err) {
      console.error("Claim all vote rewards error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      if (
        message.includes("User rejected") ||
        message.includes("user rejected")
      ) {
        toast.error("Transaction was rejected", { id: "vote-claim-all" });
      } else {
        toast.error(t("portfolio.claimFailed"), { id: "vote-claim-all" });
      }
    } finally {
      setIsClaimingAll(false);
    }
  };

  if (!effectiveIsConnected) {
    return (
      <div className="py-12 text-center text-gray-70 body-14">
        {t("common.connectWallet")}
      </div>
    );
  }

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (error) {
    return (
      <div className="py-12 text-center text-red-30 body-14">{error}</div>
    );
  }

  if (!data || data.positions.length === 0) {
    return (
      <div className="py-12 text-center text-gray-70 body-14">
        {t("portfolio.noPositions")}
      </div>
    );
  }

  const { positions } = data;
  const hasAnyClaimable = positions.some((p) => {
    const fee = parseFloat(p.estimatedRewards.swapFee.usdValue);
    const inc = parseFloat(p.estimatedRewards.incentive.usdValue);
    return fee > 0 || inc > 0;
  });

  return (
    <>
      {/* Claim All Row */}
      <div className="w-full px-[30px] flex justify-end">
        <Button
          size="sm"
          loading={isClaimingAll}
          disabled={!hasAnyClaimable || isClaimingAll}
          onClick={handleClaimAll}
        >
          {t("portfolio.claimAllRewards")}
        </Button>
      </div>

      {/* Table Header */}
      <div className="w-full px-[30px]">
        <div className="bg-gray-20 rounded-[20px] pt-[30px] pb-5 px-5 flex flex-col gap-2.5">
          {/* Category Headers */}
          <div className="flex items-center gap-2.5">
            {/* Voting Pool group: tokenPair + strategy + apr */}
            <div className="flex-[3.7] flex flex-col items-center gap-5">
              <div className="flex items-center gap-1">
                <span className="text-center text-gray-100 body-14-medium">
                  {t("vote.votingPool")}
                </span>
              </div>
              <div className="w-full h-0 border-t border-gray-30" />
            </div>

            {/* veLocked group: lockNo + lockedAmount */}
            <div className="flex-[2.4] flex flex-col items-center gap-5">
              <div className="flex items-center gap-1">
                <span className="text-center text-gray-100 body-14-medium">
                  {t("vote.veLocked")}
                </span>
              </div>
              <div className="w-full h-0 border-t border-gray-30" />
            </div>

            {/* Voting Rewards group: swapFee + incentive + claim */}
            <div className="flex-[4.4] flex flex-col items-center gap-5">
              <div className="flex items-center gap-1">
                <span className="text-center text-gray-100 body-14-medium">
                  {t("vote.votingRewards")}
                </span>
                <InfoIcon />
              </div>
              <div className="w-full h-0 border-t border-gray-30" />
            </div>
          </div>

          {/* Sub Headers */}
          <div className="flex items-center gap-2.5">
            <ColumnHeader className={COL.tokenPair}>
              {t("vote.tokenPair")}
            </ColumnHeader>
            <ColumnHeader className={COL.strategy}>
              {t("vote.strategy")}
            </ColumnHeader>
            <ColumnHeader className={COL.apr}>
              {t("vote.estApr")}
            </ColumnHeader>
            <ColumnHeader className={COL.lockNo}>
              {t("vote.lockNo")}
            </ColumnHeader>
            <ColumnHeader className={COL.lockedAmount}>
              {t("vote.lockedAmount")}
            </ColumnHeader>
            <ColumnHeader className={COL.swapFee}>
              {t("vote.swapFee")}
            </ColumnHeader>
            <ColumnHeader className={COL.incentive}>
              {t("vote.incentive")}
            </ColumnHeader>
            <ColumnHeader className={COL.claim}>
              {t("vote.claim")}
            </ColumnHeader>
          </div>
        </div>
      </div>

      {/* Data Rows */}
      <div className="w-full flex flex-col">
        {positions.map((position) => {
          const feeUsd = parseFloat(position.estimatedRewards.swapFee.usdValue);
          const incentiveUsd = parseFloat(
            position.estimatedRewards.incentive.usdValue,
          );
          const fee = position.estimatedRewards.swapFee;
          const incentive = position.estimatedRewards.incentive;
          const hasFeeTokenBreakdown =
            parseFloat(fee.token0.amount) > 0 ||
            parseFloat(fee.token1.amount) > 0;
          const hasIncentiveTokenBreakdown = incentive.tokens.length > 0;

          return (
            <div
              key={position.id}
              className="pt-5 flex flex-col items-center gap-5"
            >
              <div className="w-full px-[30px] flex items-center gap-2.5">
                {/* Token Pair */}
                <div
                  className={`${COL.tokenPair} flex flex-col items-center gap-1`}
                >
                  <TokenPairIcon
                    leftAddress={position.token0.address}
                    leftSymbol={position.token0.symbol}
                    rightAddress={position.token1.address}
                    rightSymbol={position.token1.symbol}
                    size={24}
                  />
                  <span className="text-gray-100 body-14-bold text-center">
                    {position.token0.symbol} - {position.token1.symbol}
                  </span>
                </div>

                {/* Strategy */}
                <div
                  className={`${COL.strategy} px-2.5 flex items-center justify-center`}
                >
                  <span className="text-gray-100 body-14-medium text-center">
                    {strategyLabel(position)}
                  </span>
                </div>

                {/* Est. APR */}
                <div
                  className={`${COL.apr} px-2.5 flex items-center justify-center`}
                >
                  <span className="text-gray-100 body-14-medium text-center">
                    {formatAprPercent(position.estimatedApr)}
                  </span>
                </div>

                {/* Lock No. */}
                <div
                  className={`${COL.lockNo} px-2.5 flex items-center justify-center`}
                >
                  <span className="text-gray-100 body-14-medium text-center">
                    #{position.lockTokenId}
                  </span>
                </div>

                {/* Locked Amount */}
                <div
                  className={`${COL.lockedAmount} px-2.5 flex items-center justify-center`}
                >
                  <span className="text-gray-100 body-14-medium text-center">
                    {formatAmount(position.lockedAmount)}
                  </span>
                </div>

                {/* Swap Fee */}
                <div
                  className={`${COL.swapFee} px-2.5 flex flex-col items-center gap-0.5`}
                >
                  {hasFeeTokenBreakdown ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-100 body-14-bold">
                          {formatAmount(fee.token0.amount)}
                        </span>
                        <span className="text-gray-100 body-12 font-medium">
                          {fee.token0.symbol}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-100 body-14-bold">
                          {formatAmount(fee.token1.amount)}
                        </span>
                        <span className="text-gray-100 body-12 font-medium">
                          {fee.token1.symbol}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-gray-100 body-14-medium">
                      ~${feeUsd.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Incentive */}
                <div
                  className={`${COL.incentive} px-2.5 flex flex-col items-center gap-0.5`}
                >
                  {hasIncentiveTokenBreakdown ? (
                    incentive.tokens.map((tok, idx) => (
                      <div key={`${tok.symbol}-${idx}`} className="flex items-center gap-1">
                        <span className="text-gray-100 body-14-bold">
                          {formatAmount(tok.amount)}
                        </span>
                        <span className="text-gray-100 body-12 font-medium">
                          {tok.symbol}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-gray-100 body-14-medium">
                      ~${incentiveUsd.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Claim status — indicates per-row whether there is anything
                    to collect. The actual tx is driven by the Claim All
                    button above the table. */}
                <div
                  className={`${COL.claim} px-2.5 flex flex-col items-center justify-center`}
                >
                  {feeUsd > 0 || incentiveUsd > 0 ? (
                    <>
                      <span className="px-3 py-1 bg-primary-100 text-gray-100 body-12-bold rounded-full">
                        {t("vote.claimable")}
                      </span>
                      <span className="text-gray-70 body-12 mt-1">
                        ~${(feeUsd + incentiveUsd).toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-50 body-12">
                      {t("portfolio.nothingToClaim")}
                    </span>
                  )}
                </div>
              </div>

              {/* Row Divider */}
              <div className="w-full h-0 border-t border-gray-30" />
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </>
  );
}
