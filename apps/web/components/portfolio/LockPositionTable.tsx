"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAccount, useSendTransaction, usePublicClient } from "wagmi";
import { portfolioApi } from "@/lib/portfolioApi";
import type { LockPosition, TPointLockPosition } from "@/types/portfolio";
import { Pagination } from "./Pagination";
import { IS_PRE_TGE } from "@/lib/config";
import {
  getMockDemoAddress,
  isMockMode,
  simulateMockTransaction,
} from "@/lib/mockTransactions";
import { useVote } from "@/hooks/useVote";
import { usePokeTPointLock } from "@/hooks/usePokeTPointLock";
import toast from "react-hot-toast";

const VE_UNIT = IS_PRE_TGE ? "vePOINT" : "veTER";
const LOCK_UNIT = IS_PRE_TGE ? "Point" : "TER";

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
  showInfo = true,
}: {
  children: React.ReactNode;
  className?: string;
  showInfo?: boolean;
}) {
  return (
    <div
      className={`p-2.5 flex items-center justify-center gap-1 ${className}`}
    >
      <span className="text-center text-gray-100 body-14-bold whitespace-pre-line leading-[21px]">
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

function ManageButton({
  children,
  disabled = false,
  title,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <span title={title} className="inline-flex">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="min-w-[80px] h-[72px] px-2.5 py-5 rounded-[20px] bg-primary-100 text-gray-100 body-14-bold hover:bg-primary-200 disabled:bg-primary-200 disabled:text-red-10 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all whitespace-pre-line text-center leading-[21px]"
      >
        {children}
      </button>
    </span>
  );
}

function AutoMaxBadge({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1 bg-primary-100 text-gray-100 body-12-bold rounded-full whitespace-nowrap hover:bg-primary-200 active:scale-95 transition-all"
    >
      {label}
    </button>
  );
}

/** How many days remain between now and endDate */
function computeRemainingDays(endDate: string): number {
  const now = new Date();
  const end = new Date(endDate);
  const diffMs = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function formatDurationLabel(totalDays: number): string {
  if (totalDays >= 365) {
    const years = Math.round(totalDays / 365);
    return `${years} Years`;
  }
  if (totalDays >= 30) {
    const months = Math.round(totalDays / 30);
    return `${months} Months`;
  }
  return `${totalDays} Days`;
}

interface NormalizedLock {
  id: string;
  tokenId: string;
  lockedAmount: string;
  lockedSymbol: string;
  votingPower: string;
  totalDays: number;
  remainingDays: number;
  endDate: string;
  isExpired: boolean;
  canWithdraw: boolean;
  /** Whether this lock has at least one vote in the current epoch. */
  hasCurrentEpochVote: boolean;
  /** True when the user has opted into automatic renewal to max lock duration. */
  autoMax: boolean;
  rewards: {
    claimable: string;
    claimed: string;
  };
}

interface NormalizedLockData {
  locks: NormalizedLock[];
  summary: {
    totalLocked: string;
    totalVotingPower: string;
    totalLocks: number;
  };
  totalCount: number;
}

function normalizeTPointLock(
  lock: TPointLockPosition,
  votedLockIds: Set<number>,
): NormalizedLock {
  const now = new Date();
  const endDate = new Date(lock.lockEnd);
  const isExpired = endDate < now;

  return {
    id: lock.id.toString(),
    tokenId: lock.id.toString(),
    lockedAmount: lock.amount,
    lockedSymbol: lock.lockedSymbol,
    votingPower: lock.votingPower,
    totalDays: lock.lockDays,
    remainingDays: computeRemainingDays(lock.lockEnd),
    endDate: lock.lockEnd,
    isExpired,
    canWithdraw: isExpired && lock.isActive,
    hasCurrentEpochVote: votedLockIds.has(lock.id),
    autoMax: lock.autoMax,
    rewards: { claimable: "0", claimed: "0" },
  };
}

function normalizeOnChainLock(lock: LockPosition): NormalizedLock {
  return {
    id: lock.id,
    tokenId: lock.tokenId,
    lockedAmount: lock.lockedAmount,
    lockedSymbol: lock.lockedSymbol,
    votingPower: lock.votingPower,
    totalDays: lock.lockDuration.weeks * 7,
    remainingDays: computeRemainingDays(lock.lockDuration.endDate),
    endDate: lock.lockDuration.endDate,
    isExpired: lock.isExpired,
    canWithdraw: lock.canWithdraw,
    // Pre-TGE uses this flag for the Poke gating; on-chain keeps existing
    // behavior by treating all non-expired locks as pokeable.
    hasCurrentEpochVote: true,
    // Auto-max doesn't exist on the on-chain path yet; the UI treats it as off.
    autoMax: false,
    rewards: lock.rewards,
  };
}

function formatAmount(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "0";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 5,
  });
}

interface LockPositionTableProps {
  onPositionCountChange?: (count: number) => void;
}

export function LockPositionTable({
  onPositionCountChange,
}: LockPositionTableProps) {
  const t = useTranslations();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const effectiveIsConnected = isConnected || Boolean(effectiveAddress);
  const { poke, isPending: isVotePending } = useVote();
  const {
    poke: pokeTPoint,
    pendingLockId: pokePendingLockId,
    isPending: isPokePending,
  } = usePokeTPointLock();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const [data, setData] = useState<NormalizedLockData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [claimingTokenId, setClaimingTokenId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const itemsPerPage = 10;

  const isClaimable = (claimable: string): boolean => {
    const num = parseFloat(claimable);
    return !isNaN(num) && num > 0;
  };

  const handleClaim = async (lock: NormalizedLock) => {
    if (!effectiveAddress) return;
    setClaimingTokenId(lock.tokenId);
    try {
      toast.loading(t("portfolio.claimInProgress"), { id: "claim-rebase" });
      const response = await portfolioApi.claimRewards(effectiveAddress, {
        claimType: "vote",
        positions: [lock.tokenId],
      });

      for (const tx of response.transactions) {
        const txHash = isMockMode()
          ? await simulateMockTransaction({
              label: `claim-rebase:${lock.tokenId}:${tx.to}:${tx.data}`,
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
            // Non-critical
          }
        }
      }

      toast.success(t("portfolio.claimRewardsSuccess"), { id: "claim-rebase" });
    } catch (err) {
      console.error("Claim rebase error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      if (
        message.includes("User rejected") ||
        message.includes("user rejected")
      ) {
        toast.error("Transaction was rejected", { id: "claim-rebase" });
      } else {
        toast.error(t("portfolio.claimFailed"), { id: "claim-rebase" });
      }
    } finally {
      setClaimingTokenId(null);
    }
  };

  const handlePoke = async (tokenId: string) => {
    if (IS_PRE_TGE) {
      const result = await pokeTPoint(Number(tokenId));
      if (result) {
        setRefreshKey((k) => k + 1);
      }
      return;
    }
    try {
      await poke(BigInt(tokenId));
      toast.success("Poke completed");
    } catch {
      // Error already handled in useVote
    }
  };

  useEffect(() => {
    if (!effectiveIsConnected || !effectiveAddress) {
      setData(null);
      onPositionCountChange?.(0);
      return;
    }

    const fetchPositions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (IS_PRE_TGE) {
          const [locksResponse, votesResponse] = await Promise.all([
            portfolioApi.getTPointLocks(effectiveAddress),
            portfolioApi.getTPointVotes(effectiveAddress).catch(() => ({
              votes: [],
              summary: {
                totalVotingPower: "0",
                usedVotingPower: "0",
                currentEpoch: 0,
              },
            })),
          ]);
          const votedLockIds = new Set<number>(
            votesResponse.votes.map(
              (v: { tpointLockId: number }) => v.tpointLockId,
            ),
          );
          const allLocks = locksResponse.locks.map((l: TPointLockPosition) =>
            normalizeTPointLock(l, votedLockIds),
          );
          const start = (currentPage - 1) * itemsPerPage;
          const paged = allLocks.slice(start, start + itemsPerPage);
          setData({
            locks: paged,
            summary: locksResponse.summary,
            totalCount: allLocks.length,
          });
          setTotalPages(Math.ceil(allLocks.length / itemsPerPage));
          onPositionCountChange?.(allLocks.length);
        } else {
          const offset = (currentPage - 1) * itemsPerPage;
          const response = await portfolioApi.getLockPositions(
            effectiveAddress,
            itemsPerPage,
            offset,
          );
          setData({
            locks: response.positions.map(normalizeOnChainLock),
            summary: response.summary,
            totalCount: response.pagination.total,
          });
          setTotalPages(Math.ceil(response.pagination.total / itemsPerPage));
          onPositionCountChange?.(response.pagination.total);
        }
      } catch (err) {
        if (
          err instanceof Error &&
          "statusCode" in err &&
          (err as { statusCode?: number }).statusCode === 404
        ) {
          setData(null);
          onPositionCountChange?.(0);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to fetch lock positions",
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPositions();
  }, [effectiveAddress, effectiveIsConnected, currentPage, refreshKey, onPositionCountChange]);

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
      <div className="py-12 text-center text-red-600 body-14">{error}</div>
    );
  }

  if (!data || data.locks.length === 0) {
    return (
      <div className="py-12 text-center text-gray-70 body-14">
        {t("portfolio.noPositions")}
      </div>
    );
  }

  const { locks } = data;

  return (
    <>
      {/* Table Header (desktop only) */}
      <div className="hidden lg:flex w-full px-[30px] justify-center">
        <div className="w-full max-w-[1300px] bg-gray-20 rounded-[20px] pt-[30px] pb-5 flex flex-col gap-2.5">
          {/* Category Headers */}
          <div className="flex items-center gap-2.5">
            {/* My Lock Details group */}
            <div className="flex-[1.95_1_0] min-w-0 flex flex-col items-center gap-5">
              <div className="flex items-center gap-1">
                <span className="text-center text-gray-100 body-14-medium">
                  {t("portfolio.myLockDetails", { unit: LOCK_UNIT })}
                </span>
                <InfoIcon />
              </div>
              <div className="w-full h-0 border-t border-gray-30" />
            </div>
            {/* Rebase Rewards group (post-TGE only) */}
            {!IS_PRE_TGE && (
              <div className="flex-1 flex flex-col items-center gap-5">
                <div className="flex items-center gap-1">
                  <span className="text-center text-gray-100 body-14-medium">
                    {t("portfolio.rebaseRewards")}
                  </span>
                  <InfoIcon />
                </div>
                <div className="w-full h-0 border-t border-gray-30" />
              </div>
            )}
            {/* Manage group */}
            <div className="flex-1 flex flex-col items-center gap-5">
              <div className="flex items-center gap-1">
                <span className="text-center text-gray-100 body-14-medium">
                  {t("portfolio.manage")}
                </span>
                <InfoIcon />
              </div>
              <div className="w-full h-0 border-t border-gray-30" />
            </div>
          </div>

          {/* Sub Headers */}
          <div className="flex items-center gap-2.5">
            {/* Lock Details columns */}
            <div className="flex-[1.95_1_0] min-w-0 flex items-center gap-2.5">
              <ColumnHeader className="flex-1" showInfo={false}>
                {t("portfolio.no")}
              </ColumnHeader>
              <ColumnHeader className="flex-1">
                {t("portfolio.lockedAmount")}
              </ColumnHeader>
              <ColumnHeader className="flex-1">
                {t("portfolio.lockDurationRemaining")}
              </ColumnHeader>
              <ColumnHeader className="flex-1">
                {t("portfolio.vAPR")}
              </ColumnHeader>
              <ColumnHeader className="flex-1">
                {t("portfolio.votingPowerVePoint")}
              </ColumnHeader>
            </div>
            {/* Rebase Rewards columns */}
            {!IS_PRE_TGE && (
              <div className="flex-1 flex items-center gap-2.5">
                <ColumnHeader className="flex-1">
                  {t("portfolio.claimableRewards")}
                </ColumnHeader>
                <ColumnHeader className="flex-1">
                  {t("portfolio.claim")}
                </ColumnHeader>
              </div>
            )}
            {/* Manage columns */}
            <div className="flex-1 flex items-center gap-[6.25px]">
              <ColumnHeader className="flex-1">
                {t("portfolio.increaseLockAmount")}
              </ColumnHeader>
              <ColumnHeader className="flex-1">
                {t("portfolio.extendLockup")}
              </ColumnHeader>
              <ColumnHeader className="flex-1">
                {t("portfolio.mergeLocks")}
              </ColumnHeader>
              <ColumnHeader className="flex-1">
                {t("portfolio.update")}
              </ColumnHeader>
            </div>
          </div>
        </div>
      </div>

      {/* Data Rows */}
      <div className="w-full flex flex-col gap-2 lg:gap-0 px-4 lg:px-0">
        {locks.map((lock) => {
          const durationLabel = formatDurationLabel(lock.totalDays);
          const remainingLabel = lock.isExpired
            ? "(Expired)"
            : `(D-${lock.remainingDays})`;

          return (
            <div
              key={lock.id}
              className="lg:pt-5 flex flex-col items-center lg:gap-5"
            >
              {/* Mobile card */}
              <MobileLockCard
                lock={lock}
                durationLabel={durationLabel}
                remainingLabel={remainingLabel}
                onAddMore={() =>
                  router.push(`/vote/lock/increase/${lock.tokenId}`)
                }
                onExtend={() =>
                  router.push(`/vote/lock/extend/${lock.tokenId}`)
                }
                onMerge={() =>
                  router.push(`/vote/lock/merge?base=${lock.tokenId}`)
                }
                onPoke={() => handlePoke(lock.tokenId)}
                onDisableAutoMax={() =>
                  router.push(`/vote/lock/disable-auto-max/${lock.tokenId}`)
                }
                canMerge={data.totalCount >= 2}
                isPokeDisabled={
                  lock.isExpired ||
                  (IS_PRE_TGE && !lock.hasCurrentEpochVote) ||
                  (IS_PRE_TGE &&
                    isPokePending &&
                    pokePendingLockId === Number(lock.tokenId)) ||
                  (!IS_PRE_TGE && isVotePending)
                }
                lockUnit={LOCK_UNIT}
                veUnit={VE_UNIT}
              />

              {/* Desktop row */}
              <div className="hidden lg:flex w-full px-[30px] items-start gap-5">
                {/* Lock Details */}
                <div className="flex-[1.95_1_0] min-w-0 flex items-start gap-2">
                  {/* No. */}
                  <div className="flex-1 h-[46px] px-2.5 flex items-center justify-center">
                    <span className="text-right text-gray-100 body-14-medium">
                      Lock #{lock.tokenId}
                    </span>
                  </div>

                  {/* Locked Amount */}
                  <div className="flex-1 px-2.5 flex flex-col items-center justify-center gap-1">
                    <span className="w-full text-center text-gray-100 body-14-medium">
                      {formatAmount(lock.lockedAmount)}
                    </span>
                    <span className="w-full text-center text-gray-100 body-14-medium">
                      {LOCK_UNIT}
                    </span>
                  </div>

                  {/* Lock Duration (Remaining) */}
                  <div className="flex-1 px-2.5 flex flex-col items-center justify-center gap-2.5">
                    <div className="h-[46px] flex flex-col items-center justify-center">
                      <span className="text-center text-gray-100 body-14-medium leading-[21px]">
                        {durationLabel}
                      </span>
                      <span className="text-center text-gray-100 body-14-medium leading-[21px]">
                        {lock.isExpired
                          ? "(Expired)"
                          : `(D-${lock.remainingDays})`}
                      </span>
                    </div>
                    {!lock.isExpired && lock.autoMax && (
                      <AutoMaxBadge
                        label={t("portfolio.disableAutoMax")}
                        onClick={() =>
                          router.push(
                            `/vote/lock/disable-auto-max/${lock.tokenId}`,
                          )
                        }
                      />
                    )}
                  </div>

                  {/* vAPR */}
                  <div className="flex-1 h-[46px] px-2.5 flex items-center justify-end">
                    <span className="text-right text-gray-100 body-14-medium">
                      -
                    </span>
                  </div>

                  {/* Voting Power (VePoint) */}
                  <div className="flex-1 px-2.5 flex flex-col items-center justify-center gap-1">
                    <span className="w-full text-right text-gray-100 body-14-medium">
                      {formatAmount(lock.votingPower)}
                    </span>
                    <span className="w-full text-right text-gray-100 body-14-medium">
                      {VE_UNIT}
                    </span>
                  </div>
                </div>

                {/* Rebase Rewards */}
                {!IS_PRE_TGE && (
                  <div className="flex-1 flex items-center gap-2.5">
                    {/* Claimable Amount */}
                    <div className="flex-1 flex flex-col items-center">
                      <span className="text-gray-100 body-14-medium">
                        {formatAmount(lock.rewards.claimable)}
                      </span>
                      <span className="text-gray-100 body-14-medium">
                        {LOCK_UNIT}
                      </span>
                    </div>

                    {/* Claim Button */}
                    <div className="flex-1 flex justify-center">
                      <ManageButton
                        disabled={
                          !isClaimable(lock.rewards.claimable) ||
                          claimingTokenId === lock.tokenId
                        }
                        onClick={() => handleClaim(lock)}
                      >
                        {claimingTokenId === lock.tokenId
                          ? t("portfolio.claimInProgress")
                          : isClaimable(lock.rewards.claimable)
                            ? t("portfolio.claimRebase")
                            : t("portfolio.nothingToClaim")}
                      </ManageButton>
                    </div>
                  </div>
                )}

                {/* Manage Actions */}
                <div className="flex-1 flex items-center gap-2">
                  {/* Add More */}
                  <div className="flex-1 flex justify-center">
                    <ManageButton
                      disabled={lock.isExpired}
                      onClick={() =>
                        router.push(`/vote/lock/increase/${lock.tokenId}`)
                      }
                    >
                      {t("portfolio.addMore")}
                    </ManageButton>
                  </div>

                  {/* Extend Time */}
                  <div className="flex-1 flex justify-center">
                    <ManageButton
                      disabled={lock.isExpired}
                      onClick={() =>
                        router.push(`/vote/lock/extend/${lock.tokenId}`)
                      }
                    >
                      {t("portfolio.extendTime")}
                    </ManageButton>
                  </div>

                  {/* Merge */}
                  <div className="flex-1 flex justify-center">
                    <ManageButton
                      disabled={lock.isExpired || data.totalCount < 2}
                      onClick={() =>
                        router.push(`/vote/lock/merge?base=${lock.tokenId}`)
                      }
                    >
                      {t("portfolio.merge")}
                    </ManageButton>
                  </div>

                  {/* Poke (Update) */}
                  <div className="flex-1 flex justify-center">
                    {(() => {
                      const isThisPoking =
                        IS_PRE_TGE &&
                        isPokePending &&
                        pokePendingLockId === Number(lock.tokenId);
                      const noVote =
                        IS_PRE_TGE && !lock.hasCurrentEpochVote;
                      const disabled =
                        lock.isExpired ||
                        noVote ||
                        isThisPoking ||
                        (!IS_PRE_TGE && isVotePending);
                      const tooltip = lock.isExpired
                        ? t("portfolio.pokeDisabledExpired")
                        : noVote
                          ? t("portfolio.pokeDisabledNoVote")
                          : isThisPoking
                            ? t("portfolio.pokeInProgress")
                            : t("portfolio.pokeEnabled");
                      return (
                        <ManageButton
                          disabled={disabled}
                          title={tooltip}
                          onClick={() => handlePoke(lock.tokenId)}
                        >
                          {isThisPoking
                            ? t("portfolio.pokeInProgress")
                            : t("portfolio.poke")}
                        </ManageButton>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Row Divider (desktop only) */}
              <div className="hidden lg:block w-full h-0 border-t border-gray-30" />
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

// ---------------------------------------------------------------------------
// Mobile card view — below `lg` breakpoint
// ---------------------------------------------------------------------------

interface MobileLockCardProps {
  lock: NormalizedLock;
  durationLabel: string;
  remainingLabel: string;
  onAddMore: () => void;
  onExtend: () => void;
  onMerge: () => void;
  onPoke: () => void;
  onDisableAutoMax: () => void;
  canMerge: boolean;
  isPokeDisabled: boolean;
  lockUnit: string;
  veUnit: string;
}

function MobileActionButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="px-2 py-1.5 rounded-[10px] bg-primary-100 text-gray-100 body-12-bold hover:bg-primary-200 disabled:bg-primary-200 disabled:text-red-10 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all whitespace-nowrap"
    >
      {children}
    </button>
  );
}

function MobileStatCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center gap-2.5">
      <div className="w-full flex flex-col gap-1.5">
        <span className="w-full text-center text-gray-100 body-12-bold">
          {label}
        </span>
        <div className="w-full h-0 border-t border-gray-30" />
      </div>
      <div className="w-full flex items-center justify-center">{children}</div>
    </div>
  );
}

function MobileLockCard({
  lock,
  durationLabel,
  remainingLabel,
  onAddMore,
  onExtend,
  onMerge,
  onPoke,
  onDisableAutoMax,
  canMerge,
  isPokeDisabled,
  lockUnit,
  veUnit,
}: MobileLockCardProps) {
  // Split "4 Years" / "1 Days" / "6 Months" into bold number + medium unit
  const durationMatch = durationLabel.match(/^(\d+)\s+(.+)$/);
  const durationValue = durationMatch?.[1] ?? durationLabel;
  const durationUnit = durationMatch?.[2] ?? "";

  return (
    <div className="lg:hidden w-full bg-white rounded-[20px] p-4 flex flex-col gap-2.5">
      {/* Info box */}
      <div className="w-full bg-gray-20 rounded-[10px] p-2.5 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-gray-100 body-12-medium">Number</span>
          <span className="text-gray-100 body-12-bold">#{lock.tokenId}</span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <span className="text-gray-100 body-12-medium">Locked Amount</span>
          <div className="flex items-center gap-1">
            <span className="text-gray-100 body-12-bold">
              {formatAmount(lock.lockedAmount)}
            </span>
            <span className="text-gray-100 body-12-medium">{lockUnit}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-100 body-12-medium">Lock Duration</span>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1 text-gray-100 body-12-medium">
              <span className="body-12-bold">{durationValue}</span>
              {durationUnit && <span>{durationUnit}</span>}
              <span>{remainingLabel}</span>
            </div>
            {!lock.isExpired && lock.autoMax && (
              <button
                type="button"
                onClick={onDisableAutoMax}
                className="h-[30px] px-2 py-1.5 rounded-[10px] bg-gray-80 text-gray-10 body-12-bold hover:bg-gray-90 transition-colors whitespace-nowrap"
              >
                Disable Auto-Max
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="w-full flex gap-x-3 gap-y-3.5">
        <MobileStatCell label="Avg. Bonus Rate">
          <span className="text-gray-100 body-12-medium text-right">-</span>
        </MobileStatCell>
        <MobileStatCell label="Voting power">
          <div className="flex items-center justify-center gap-0.5 text-gray-100 body-12-medium">
            <span className="text-right">{formatAmount(lock.votingPower)}</span>
            <span>{veUnit}</span>
          </div>
        </MobileStatCell>
      </div>

      {/* Actions grid */}
      <div className="w-full flex gap-x-2 gap-y-3.5">
        <MobileStatCell label="Increase Lock">
          <MobileActionButton disabled={lock.isExpired} onClick={onAddMore}>
            + Add
          </MobileActionButton>
        </MobileStatCell>
        <MobileStatCell label="Extend Lockup">
          <MobileActionButton disabled={lock.isExpired} onClick={onExtend}>
            Extend
          </MobileActionButton>
        </MobileStatCell>
        <MobileStatCell label="Merge Locks">
          <MobileActionButton
            disabled={lock.isExpired || !canMerge}
            onClick={onMerge}
          >
            Merge
          </MobileActionButton>
        </MobileStatCell>
        <MobileStatCell label="Update">
          <MobileActionButton disabled={isPokeDisabled} onClick={onPoke}>
            Poke
          </MobileActionButton>
        </MobileStatCell>
      </div>
    </div>
  );
}
