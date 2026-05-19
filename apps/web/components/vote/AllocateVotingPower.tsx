"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { TokenPairIcon } from "@/components/common/TokenIcon";
import { useLockData } from "@/hooks/useVotingEscrow";
import { useTPointLockData } from "@/hooks/useTPointLocks";
import { useVote } from "@/hooks/useVote";
import { useTPointVote } from "@/hooks/useTPointVote";
import { useVotePools } from "@/hooks/useVotePools";
import { portfolioApi } from "@/lib/portfolioApi";
import { IS_PRE_TGE } from "@/lib/config";
import { Button } from "@/components/common/Button";

const POINT_SYMBOL = IS_PRE_TGE ? "vePOINT" : "veTER";

export function AllocateVotingPower() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { address } = useAccount();

  const poolId = searchParams.get("poolId");
  const lockId = searchParams.get("lockId");

  const { pools } = useVotePools();
  const poolData = useMemo(
    () => pools.find((p) => p.poolAddress === poolId),
    [pools, poolId],
  );

  const { lockData: onchainLockData, isLoading: onchainLockLoading } =
    useLockData(!IS_PRE_TGE && lockId ? BigInt(lockId) : undefined);
  const { lockData: tpointLockData, isLoading: tpointLockLoading } =
    useTPointLockData(IS_PRE_TGE && lockId ? Number(lockId) : undefined);

  const lockData = IS_PRE_TGE ? tpointLockData : onchainLockData;
  const lockLoading = IS_PRE_TGE ? tpointLockLoading : onchainLockLoading;

  const { data: votesData } = useQuery({
    queryKey: ["tpoint-votes", address],
    queryFn: () => portfolioApi.getTPointVotes(address!),
    enabled: IS_PRE_TGE && !!address,
  });

  const { usedPercentage, remainingPercentage, existingPoolVote } =
    useMemo(() => {
      if (!votesData || !lockId) {
        return {
          usedPercentage: 0,
          remainingPercentage: 100,
          existingPoolVote: 0,
        };
      }
      const lockVotes = votesData.votes.filter(
        (v) => v.tpointLockId === Number(lockId),
      );
      const currentPoolVote = lockVotes.find(
        (v) => v.poolAddress.toLowerCase() === poolId?.toLowerCase(),
      );
      const existingPoolVote = currentPoolVote
        ? parseFloat(currentPoolVote.percentage)
        : 0;
      const totalUsed = lockVotes.reduce(
        (sum, v) => sum + parseFloat(v.percentage),
        0,
      );
      const usedByOthers = totalUsed - existingPoolVote;
      return {
        usedPercentage: Math.round(usedByOthers),
        remainingPercentage: Math.round(100 - usedByOthers),
        existingPoolVote: Math.round(existingPoolVote),
      };
    }, [votesData, lockId, poolId]);

  const { vote: onchainVote, isPending: onchainVotePending } = useVote();
  const { vote: tpointVote, isPending: tpointVotePending } = useTPointVote();
  const voteWritePending = IS_PRE_TGE ? tpointVotePending : onchainVotePending;

  const maxPercentage = IS_PRE_TGE ? remainingPercentage : 100;
  const [relativePercentage, setRelativePercentage] = useState<number>(100);
  const [inputValue, setInputValue] = useState<string>("100");
  const [isVoting, setIsVoting] = useState(false);

  const absolutePercentage = Math.round(
    (relativePercentage * maxPercentage) / 100,
  );

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Math.max(Number(e.target.value), 0), 100);
    setRelativePercentage(value);
    setInputValue(value.toString());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    const numValue = Math.min(100, Math.max(0, parseInt(value) || 0));
    setRelativePercentage(numValue);
  };

  const handleInputBlur = () => {
    const numValue = Math.min(100, Math.max(0, parseInt(inputValue) || 0));
    setInputValue(numValue.toString());
    setRelativePercentage(numValue);
  };

  const handleVote = async () => {
    if (!lockId || !poolId || absolutePercentage <= 0) return;

    setIsVoting(true);
    try {
      if (IS_PRE_TGE) {
        await tpointVote(Number(lockId), [poolId], [absolutePercentage]);
      } else {
        await onchainVote(
          BigInt(lockId),
          [poolId as `0x${string}`],
          [BigInt(absolutePercentage * 100)],
        );
      }

      queryClient.invalidateQueries({ queryKey: ["vote"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["tpoint-locks"] });
      queryClient.invalidateQueries({ queryKey: ["tpoint-votes"] });

      router.push(
        `/vote/complete?poolId=${poolId}&lockId=${lockId}&percentage=${absolutePercentage}`,
      );
    } catch (error) {
      console.error("Vote failed:", error);
    } finally {
      setIsVoting(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (lockLoading || !poolData || !lockData) {
    return (
      <div className="mx-auto w-full max-w-[1360px] px-4 md:px-10 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[670px_1fr] gap-5">
          <div className="flex flex-col gap-5">
            <div className="h-32 bg-gray-20 rounded-[40px] animate-pulse" />
            <div className="h-[450px] bg-gray-20 rounded-[40px] animate-pulse" />
            <div className="h-60 bg-gray-20 rounded-[40px] animate-pulse" />
          </div>
          <div className="h-[580px] bg-gray-20 rounded-[40px] animate-pulse" />
        </div>
      </div>
    );
  }

  const poolType = poolData.poolType === "CL" ? "Concentrated" : "Standard";
  const volatility = poolData.poolType === "CL"
    ? `CL${poolData.tickSpacing ?? ""}`
    : poolData.isStable
      ? "Stable"
      : "Volatile";

  const lockedAmountDisplay = parseFloat(lockData.lockedAmount).toFixed(5);
  const votingPowerDisplay = parseFloat(lockData.votingPower).toFixed(5);

  const isPending = isVoting || voteWritePending;
  const isConfirmDisabled =
    absolutePercentage === 0 ||
    isPending ||
    (IS_PRE_TGE && maxPercentage === 0);

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 md:px-10 py-5">
      <div className="grid grid-cols-1 lg:grid-cols-[670px_1fr] gap-5 items-start">
        {/* Left column */}
        <div className="flex flex-col gap-5">
          {/* Intro card */}
          <section className="bg-white rounded-[40px] py-[30px] flex flex-col gap-3">
            <div className="flex flex-col gap-2.5 px-[30px]">
              <h1 className="heading-6 text-gray-100">
                {t("vote.allocateVotingPower")}
              </h1>
              <div className="body-14-medium text-gray-90">
                <p>{t("vote.enterPercentage")}</p>
                <p>{t("vote.splitPower")}</p>
              </div>
            </div>
            <div className="h-px w-full bg-gray-30" />
          </section>

          {/* 1. Voting Target */}
          <section className="bg-white rounded-[40px] pb-[30px] flex flex-col gap-5 items-center">
            <SectionHeader title={`1. ${t("vote.votingTarget")}`} />

            <div className="w-[calc(100%-60px)] max-w-[610px] bg-gray-20 rounded-[10px] px-5 py-2.5 flex items-center justify-between gap-3">
              <div className="flex flex-1 items-center gap-1.5 min-w-0">
                <TokenPairIcon
                  leftAddress={poolData.token0.address}
                  leftSymbol={poolData.token0.symbol}
                  rightAddress={poolData.token1.address}
                  rightSymbol={poolData.token1.symbol}
                  size={32}
                />
                <span className="body-16-bold text-gray-100 truncate">
                  {poolData.token0.symbol} - {poolData.token1.symbol}
                </span>
              </div>
              <div className="flex items-center gap-5 body-14-medium text-gray-100 text-right">
                <span>{poolType}</span>
                <span>{volatility}</span>
                <span className="body-14-bold">{poolData.feePercent}%</span>
              </div>
            </div>

            <div className="w-[calc(100%-60px)] max-w-[610px] flex flex-col gap-3.5">
              <StatRow
                label={t("vote.tvl")}
                value={`~$${formatCompact(poolData.tvl)}`}
              />
              <StatRow
                label={t("vote.swapFees")}
                value={`~$${formatCompact(poolData.fees7d)}`}
              />
              <StatRow
                label={t("vote.incentives")}
                value={`~$${formatCompact(poolData.incentives)}`}
              />
              <StatRow
                label={t("vote.totalRewards")}
                value={`~$${formatCompact(poolData.totalRewards)}`}
                leftValue={
                  <span className="body-16-bold text-gray-100">
                    {t("vote.feesPlusIncentives")}
                  </span>
                }
              />
              <StatRow
                label={t("vote.vApr")}
                value={`${poolData.vAPR}%`}
                leftValue={
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <span className="body-16-bold text-gray-100">
                        {poolData.voteShare}
                      </span>
                      <span className="body-14-medium text-gray-100">
                        {t("vote.votes")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="body-16-bold text-gray-100">
                        {formatWithCommas(poolData.voteWeight)}
                      </span>
                      <span className="body-14-medium text-gray-100">
                        {POINT_SYMBOL}
                      </span>
                    </div>
                  </div>
                }
              />
            </div>
          </section>

          {/* 2. Your Selected Lock */}
          <section className="bg-white rounded-[40px] pb-[30px] flex flex-col gap-5 items-center">
            <SectionHeader title={`2. ${t("vote.yourSelectedLock")}`} />

            <div className="w-[calc(100%-60px)] max-w-[610px] flex flex-col gap-2.5">
              <div className="bg-gray-20 rounded-[10px] p-5 flex items-center justify-between">
                <LockHeaderCell label={t("vote.lockNo")} />
                <LockHeaderCell label={t("vote.lockedAmount")} />
                <LockHeaderCell label={t("vote.lockDuration")} />
                <LockHeaderCell label={t("vote.votingWeight")} />
              </div>
              <div className="bg-gray-20 rounded-[10px] p-5 flex items-center justify-between">
                <LockCell text={lockData.lockNo} />
                <LockCell text={lockedAmountDisplay} />
                <LockCell text={lockData.lockPeriod} />
                <LockCell text={lockData.votingWeight} bold />
              </div>
            </div>
          </section>
        </div>

        {/* Right column — 3. Set Voting Weight */}
        <section className="bg-white rounded-[40px] flex flex-col">
          <SectionHeader title={`3. ${t("vote.setVotingWeight")}`} />

          {/* APR / Est. Rewards */}
          <div className="px-[30px] pt-5 flex gap-5">
            <MetricTile
              label={t("vote.votingAPR")}
              value={`${poolData.vAPR}%`}
              sub={`${t("vote.votes")} ${formatWithCommas(poolData.voteWeight)}`}
            />
            <MetricTile
              label={t("vote.estRewards")}
              value={`~$${formatCompact(poolData.totalRewards)}`}
              sub={
                <>
                  <span>{t("vote.outOf")} </span>
                  <span className="font-bold">
                    ~${formatCompact(poolData.totalRewards)}
                  </span>
                </>
              }
            />
          </div>

          {/* Adjust voting weight */}
          <div className="px-[30px] pt-5 flex flex-col gap-5">
            <p className="body-16-medium text-gray-100 text-center">
              {t("vote.dragOrEnterToAdjust")}
            </p>

            <div className="border border-gray-30 rounded-[20px] p-5 flex flex-col gap-5">
              {/* Voting Power header */}
              <div className="flex items-start justify-between gap-2.5">
                <span className="body-16-semibold text-gray-100">
                  {t("vote.votingPower")}
                </span>
                <div className="flex items-center gap-1">
                  <span className="body-16-bold text-gray-100">
                    {votingPowerDisplay}
                  </span>
                  <span className="body-16 text-gray-100">{POINT_SYMBOL}</span>
                </div>
              </div>

              {/* Contextual allocation info */}
              {IS_PRE_TGE && usedPercentage > 0 && (
                <div className="flex items-center justify-between -my-3">
                  <span className="body-12 text-gray-70">
                    {t("vote.usedByOtherPools")}
                  </span>
                  <span className="body-12 text-gray-90">
                    {usedPercentage}%
                  </span>
                </div>
              )}
              {IS_PRE_TGE && remainingPercentage < 100 && (
                <div className="flex items-center justify-between -my-3">
                  <span className="body-12 text-gray-70">
                    {t("vote.remainingAllocation")}
                  </span>
                  <span
                    className={`body-12-bold ${
                      remainingPercentage === 0 ? "text-red-30" : "text-green-10"
                    }`}
                  >
                    {remainingPercentage}%
                  </span>
                </div>
              )}
              {IS_PRE_TGE && existingPoolVote > 0 && (
                <div className="bg-green-10/10 rounded-lg px-4 py-3">
                  <span className="body-14 text-green-20">
                    {t("vote.currentPoolVote", { percentage: existingPoolVote })}
                  </span>
                </div>
              )}
              {IS_PRE_TGE && remainingPercentage === 0 && (
                <div className="bg-red-10 border border-red-20 rounded-lg px-4 py-3">
                  <span className="body-14 text-red-30">
                    {t("vote.noRemainingAllocation")}
                  </span>
                </div>
              )}

              {/* Percentage input */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 bg-gray-20 rounded-[20px] px-5 py-5">
                    <input
                      type="number"
                      value={inputValue}
                      onChange={handleInputChange}
                      onBlur={handleInputBlur}
                      min="0"
                      max="100"
                      placeholder="Enter 1-100%"
                      disabled={maxPercentage === 0}
                      className="w-full bg-transparent body-16 text-gray-100 placeholder:text-gray-60 text-right focus:outline-none disabled:opacity-50"
                    />
                  </div>
                  <span className="body-16 text-black">%</span>
                </div>
                {IS_PRE_TGE && maxPercentage > 0 && maxPercentage < 100 && (
                  <span className="body-12 text-gray-70 text-right pr-6">
                    {t("vote.equalsTotalVotingPower", {
                      percentage: absolutePercentage,
                    })}
                  </span>
                )}
              </div>

              {/* Slider */}
              <div className="flex flex-col gap-2.5">
                <div className="relative h-6 flex items-center">
                  <div className="absolute inset-x-0 h-2.5 bg-gray-30 rounded-full top-1/2 -translate-y-1/2" />
                  <div
                    className="absolute h-2.5 bg-green-10 rounded-full top-1/2 -translate-y-1/2 left-0"
                    style={{ width: `${relativePercentage}%` }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={relativePercentage}
                    onChange={handleSliderChange}
                    disabled={maxPercentage === 0}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                  />
                  <div
                    className="absolute w-[22px] h-[22px] bg-green-10 rounded-[10px] border-2 border-white shadow-sm top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{
                      left: `calc(${relativePercentage}% - 11px)`,
                    }}
                  />
                </div>
                <div className="flex items-center body-14-medium text-gray-100">
                  <span className="w-[40px]">0%</span>
                  <span className="flex-1 text-center">25%</span>
                  <span className="flex-1 text-center">50%</span>
                  <span className="flex-1 text-center">75%</span>
                  <span className="w-[40px] text-right">100%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-5 px-[30px] pt-10 pb-[30px]">
            <Button
              variant="secondary"
              size="lg"
              className="max-w-[295px] bg-gray-100 hover:bg-gray-90"
              onClick={handleCancel}
              disabled={isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="lg"
              className="max-w-[295px]"
              onClick={handleVote}
              loading={isPending}
              disabled={isConfirmDisabled}
            >
              {isPending ? t("vote.voting") : t("common.confirm")}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-3 items-center pt-[30px] w-full">
      <div className="px-[30px] w-full">
        <p className="heading-6 text-gray-90">{title}</p>
      </div>
      <div className="h-px w-full bg-gray-30" />
    </div>
  );
}

function StatRow({
  label,
  value,
  leftValue,
}: {
  label: string;
  value: string;
  leftValue?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 w-full">
      <span className="body-16-semibold text-gray-100">{label}</span>
      <div className="flex items-center gap-2.5 text-right">
        {leftValue}
        <span className="heading-6 text-gray-100">{value}</span>
      </div>
    </div>
  );
}

function LockHeaderCell({ label }: { label: string }) {
  return (
    <span className="flex-1 body-16-semibold text-gray-100 text-center">
      {label}
    </span>
  );
}

function LockCell({ text, bold = false }: { text: string; bold?: boolean }) {
  return (
    <span
      className={`flex-1 text-center text-gray-100 ${bold ? "body-16-bold" : "body-16"}`}
    >
      {text}
    </span>
  );
}

function MetricTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col gap-2.5">
      <span className="body-16-semibold text-gray-100">{label}</span>
      <div className="bg-gray-20 rounded-[20px] h-[95px] px-2.5 py-5 flex flex-col items-center justify-center gap-2 text-center">
        <span className="heading-6 text-gray-100 w-full">{value}</span>
        <span className="body-14-medium text-gray-100 w-full">{sub}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatCompact(input: string | number): string {
  const n = typeof input === "number" ? input : parseFloat(input);
  if (!isFinite(n)) return String(input);
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}

function formatWithCommas(input: string | number): string {
  const n = typeof input === "number" ? input : parseFloat(input);
  if (!isFinite(n)) return String(input);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
