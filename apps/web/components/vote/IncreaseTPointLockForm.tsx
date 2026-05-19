"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { portfolioApi } from "@/lib/portfolioApi";
import { useUserPoints } from "@/hooks/useUserPoints";
import { useTPointUserLocks } from "@/hooks/useTPointLocks";
import { useIncreaseTPointLock } from "@/hooks/useIncreaseTPointLock";
import { Button } from "@/components/common/Button";
import { DecorativeBanner } from "@/components/common/DecorativeBanner";
import {
  ChangeBaseLockModal,
  type BaseLockOption,
} from "@/components/vote/ChangeBaseLockModal";
import type { TPointLockPosition } from "@/types/portfolio";

const MAX_LOCK_DAYS = 1456;

type Step = "input" | "approve" | "confirm" | "success";

function formatAmount(value: string | number, maxFraction = 5): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFraction,
  });
}

function formatPeriodLabel(lockDays: number, lockEnd: string): string {
  const years = Math.round(lockDays / 365);
  const remainingDays = Math.max(
    0,
    Math.ceil(
      (new Date(lockEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    ),
  );
  const yearsLabel = lockDays >= 365 ? `${years} Years` : `${lockDays} Days`;
  return `${yearsLabel}[D-${remainingDays}]`;
}

function formatDurationParts(lockDays: number): { value: string; unit: string } {
  if (lockDays >= 365) {
    const years = Math.round(lockDays / 365);
    return { value: String(years), unit: years === 1 ? "Year" : "Years" };
  }
  if (lockDays >= 28) {
    const months = Math.round(lockDays / 30);
    return { value: String(months), unit: months === 1 ? "Month" : "Months" };
  }
  const days = Math.max(1, Math.round(lockDays));
  return { value: String(days), unit: days === 1 ? "Day" : "Days" };
}

interface Props {
  lockId: number;
}

export function IncreaseTPointLockForm({ lockId }: Props) {
  const router = useRouter();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { address } = useAccount();

  const { points } = useUserPoints();
  const { summary: tpointSummary } = useTPointUserLocks();

  const [activeLockId, setActiveLockId] = useState<number>(lockId);
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);

  const { data: locksList } = useQuery({
    queryKey: ["tpoint-locks", address],
    queryFn: () => portfolioApi.getTPointLocks(address!),
    enabled: !!address,
    staleTime: 15_000,
  });

  const { data: lockData, isLoading } = useQuery({
    queryKey: ["tpoint-lock", activeLockId],
    queryFn: () => portfolioApi.getTPointLockById(activeLockId),
    enabled: !isNaN(activeLockId),
    staleTime: 15_000,
  });

  const activeLocks = useMemo<TPointLockPosition[]>(() => {
    const all = locksList?.locks ?? [];
    const now = Date.now();
    return all.filter(
      (lock) => lock.isActive && new Date(lock.lockEnd).getTime() > now,
    );
  }, [locksList]);

  const baseLockOptions = useMemo<BaseLockOption[]>(
    () =>
      activeLocks.map((lock) => ({
        id: lock.id.toString(),
        lockNo: `#${lock.id}`,
        lockPeriod: formatPeriodLabel(lock.lockDays, lock.lockEnd),
        vePointAmount: formatAmount(lock.amount),
      })),
    [activeLocks],
  );
  const {
    signIncrease,
    submitIncrease,
    resetSignature,
    isSigning,
    isSubmitting,
  } = useIncreaseTPointLock();

  const tpointBalance = Math.max(
    0,
    parseFloat(points?.onChainBalance ?? "0") -
      parseFloat(tpointSummary?.totalLocked ?? "0"),
  ).toString();

  const [step, setStep] = useState<Step>("input");
  const [amount, setAmount] = useState("");
  const [showAmountSlider, setShowAmountSlider] = useState(false);
  const [amountSliderPercent, setAmountSliderPercent] = useState(0);
  const [pendingSig, setPendingSig] = useState<{
    signature: string;
    message: string;
    amountWei: string;
  } | null>(null);
  // Snapshot of the base amount at submit-time. After the mutation completes
  // the query refetches with the new total, so we freeze the original base
  // amount here to keep the success summary math consistent.
  const [submittedBaseAmount, setSubmittedBaseAmount] = useState<string | null>(
    null,
  );

  const isInsufficientBalance =
    amount !== "" && parseFloat(amount) > parseFloat(tpointBalance);
  const amountNum = parseFloat(amount) || 0;
  const canIncrease = amountNum > 0 && !isInsufficientBalance;

  const votingPowerAfter = useMemo(() => {
    if (!lockData) return 0;
    const baseAmount = parseFloat(lockData.amount);
    const totalAmount = baseAmount + amountNum;
    const remainingMs = new Date(lockData.lockEnd).getTime() - Date.now();
    const remainingDays = Math.max(0, remainingMs / (1000 * 60 * 60 * 24));
    return totalAmount * (remainingDays / MAX_LOCK_DAYS);
  }, [lockData, amountNum]);

  const handlePercentage = (percentage: number) => {
    const balance = parseFloat(tpointBalance) || 0;
    const newAmount = (balance * percentage) / 100;
    setAmount(newAmount > 0 ? newAmount.toString() : "");
    setAmountSliderPercent(Math.min(100, Math.max(0, percentage)));
  };

  const handleAmountSliderChange = (percent: number) => {
    setAmountSliderPercent(percent);
    const balance = parseFloat(tpointBalance) || 0;
    const newAmount = (balance * percent) / 100;
    setAmount(newAmount > 0 ? newAmount.toString() : "");
  };

  const toggleAmountSlider = () => {
    setShowAmountSlider((prev) => {
      const next = !prev;
      if (next) {
        const balance = parseFloat(tpointBalance) || 0;
        const current =
          balance > 0 && amount
            ? Math.round((parseFloat(amount) / balance) * 100)
            : 0;
        setAmountSliderPercent(Math.min(100, Math.max(0, current)));
      }
      return next;
    });
  };

  const handleBack = () => {
    router.push("/portfolio");
  };

  const handleEditAmount = () => {
    resetSignature();
    setPendingSig(null);
    setSubmittedBaseAmount(null);
    setStep("input");
  };

  const handleContinueToApprove = () => {
    if (!canIncrease) return;
    setStep("approve");
  };

  const handleApprove = async () => {
    try {
      const sig = await signIncrease(activeLockId, amount);
      setPendingSig(sig);
      setStep("confirm");
    } catch {
      // Toast handled in hook
    }
  };

  const handleConfirm = async () => {
    if (!pendingSig || !lockData) return;
    try {
      setSubmittedBaseAmount(lockData.amount);
      await submitIncrease(
        activeLockId,
        pendingSig.amountWei,
        pendingSig.signature,
        pendingSig.message,
      );
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["tpoint-locks"] });
      queryClient.invalidateQueries({ queryKey: ["tpoint-lock", activeLockId] });
      queryClient.invalidateQueries({ queryKey: ["portfolio", "locks"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio", "points"] });
    } catch {
      // Toast handled in hook
    }
  };

  const handleGoPortfolio = () => {
    router.push("/portfolio");
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center text-neutral-700 body-14">
        {t("common.loading")}
      </div>
    );
  }

  if (!lockData) {
    return (
      <div className="py-12 text-center text-neutral-700 body-14">
        {t("portfolio.lockNotFound")}
      </div>
    );
  }

  if (!address) {
    return (
      <div className="py-12 text-center text-neutral-700 body-14">
        {t("common.connectWallet")}
      </div>
    );
  }

  const periodLabel = formatPeriodLabel(lockData.lockDays, lockData.lockEnd);
  // After submit succeeds, lockData.amount reflects the post-increase total.
  // Use the pre-submit snapshot so the summary math stays consistent.
  const displayBaseAmount = submittedBaseAmount ?? lockData.amount;
  const baseAmountFormatted = formatAmount(displayBaseAmount);
  const totalAmount = parseFloat(displayBaseAmount) + amountNum;
  const lockNoLabel = `#${lockData.id}`;

  const handleSelectBaseLock = (selected: BaseLockOption) => {
    const id = parseInt(selected.id, 10);
    if (!isNaN(id)) {
      setActiveLockId(id);
      setAmount("");
      resetSignature();
      setPendingSig(null);
      setSubmittedBaseAmount(null);
      setStep("input");
    }
    setIsChangeModalOpen(false);
  };

  const durationParts = formatDurationParts(lockData.lockDays);

  return (
    <div className="mx-auto w-full max-w-[670px]">
      <ChangeBaseLockModal
        isOpen={isChangeModalOpen}
        onClose={() => setIsChangeModalOpen(false)}
        onSelect={handleSelectBaseLock}
        locks={baseLockOptions}
        initialSelectedId={activeLockId.toString()}
      />
      {step === "input" && (
        <div className="flex flex-col gap-5">
          {/* Title */}
          <div className="flex flex-col gap-2 px-2 py-2 text-gray-100">
            <h1 className="heading-5">
              {t("portfolio.increaseYourLockAmount")}
            </h1>
            <p className="body-16-medium whitespace-pre-line">
              {t("portfolio.increaseLockDescription")}
            </p>
          </div>

          {/* Card 1: Selected Base Lock */}
          <div className="flex flex-col gap-5 rounded-[40px] bg-white pb-[30px]">
            <div className="flex flex-col gap-3 pt-[30px]">
              <div className="px-[30px]">
                <h2 className="text-[20px] font-bold leading-[30px] text-gray-100">
                  1. {t("portfolio.selectedBaseLock")}
                </h2>
              </div>
              <div className="h-px w-full bg-gray-30" />
            </div>

            <div className="flex flex-col gap-2.5 px-[30px]">
              {/* Table header */}
              <div className="rounded-[10px] bg-gray-20 px-5 py-2.5">
                <div className="grid grid-cols-[1fr_1fr_1fr_75px] items-center gap-2">
                  <span className="body-14-bold text-center text-gray-100">
                    {t("portfolio.no")}
                  </span>
                  <span className="body-14-bold text-center text-gray-100">
                    {t("portfolio.lockPeriod")}
                  </span>
                  <span className="body-14-bold text-center text-gray-100">
                    {t("portfolio.lockedAmount")}
                  </span>
                  <span />
                </div>
              </div>

              {/* Table row */}
              <div className="rounded-[10px] bg-gray-20 p-5">
                <div className="grid grid-cols-[1fr_1fr_1fr_75px] items-center gap-2">
                  <p className="body-16 text-gray-100">{lockNoLabel}</p>
                  <p className="body-16 text-gray-100">{periodLabel}</p>
                  <p className="body-16 text-center text-gray-80 whitespace-nowrap">
                    {baseAmountFormatted}{" "}
                    <span className="text-gray-80">vePoint</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsChangeModalOpen(true)}
                    className="body-14-medium rounded-[10px] bg-gray-80 px-2.5 py-1.5 text-gray-10 transition-colors hover:bg-gray-90"
                  >
                    {t("portfolio.change")}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Increase your Lock Amount */}
          <div className="flex flex-col rounded-[40px] bg-white">
            <div className="flex flex-col gap-3 pt-[30px]">
              <div className="px-[30px]">
                <h2 className="text-[20px] font-bold leading-[30px] text-gray-100">
                  2. {t("portfolio.increaseYourLockAmount")}
                </h2>
              </div>
              <div className="h-px w-full bg-gray-30" />
            </div>

            <div className="flex flex-col gap-[30px] px-[30px] pt-5">
              {/* Amount Section */}
              <section className="flex flex-col gap-2.5">
                <div className="flex items-center justify-end gap-4">
                  <span
                    className={`body-14-medium ${isInsufficientBalance ? "text-red-30" : "text-gray-100"}`}
                  >
                    {formatAmount(tpointBalance)} tPOINT
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handlePercentage(50)}
                      className="body-14-medium rounded-[10px] bg-gray-20 px-2 py-1 text-gray-100 transition-colors hover:bg-gray-30"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePercentage(100)}
                      className="body-14-medium rounded-[10px] bg-gray-20 px-2 py-1 text-gray-100 transition-colors hover:bg-gray-30"
                    >
                      100%
                    </button>
                    <button
                      type="button"
                      onClick={toggleAmountSlider}
                      aria-label="Toggle percentage slider"
                      aria-pressed={showAmountSlider}
                      className="flex size-7 items-center justify-center rounded-[10px] bg-red-40 transition-opacity hover:opacity-90"
                    >
                      <PercentBadgeIcon className="size-4 text-white" />
                    </button>
                  </div>
                </div>

                {showAmountSlider && (
                  <div className="flex items-center gap-3 rounded-[20px] bg-gray-20 px-5 py-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={amountSliderPercent}
                      onChange={(e) =>
                        handleAmountSliderChange(Number(e.target.value))
                      }
                      className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-30 accent-green-10"
                    />
                    <span className="body-14-medium w-12 text-right text-gray-80">
                      {amountSliderPercent}%
                    </span>
                  </div>
                )}

                <div
                  className={`flex items-center justify-between gap-4 rounded-[20px] px-[30px] py-5 ${
                    isInsufficientBalance
                      ? "bg-red-10 ring-2 ring-red-30"
                      : "bg-gray-20"
                  }`}
                >
                  <div className="flex shrink-0 items-center gap-1 rounded-full bg-gray-10 p-4">
                    <div className="flex size-6 items-center justify-center rounded-full bg-gray-20">
                      <span className="text-[10px] font-bold text-primary-300">
                        tP
                      </span>
                    </div>
                    <span className="body-16-semibold text-gray-100">
                      tPOINT
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col items-end text-gray-100">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
                      }}
                      placeholder="0"
                      className={`w-full min-w-0 bg-transparent text-right text-[24px] font-bold leading-9 focus:outline-none ${
                        isInsufficientBalance ? "text-red-30" : "text-gray-100"
                      }`}
                    />
                    <span className="body-14-medium text-gray-100">~$0.0</span>
                  </div>
                </div>
              </section>

              {/* Summary Fields */}
              <div className="flex w-full items-center gap-5 text-gray-100">
                <SummaryField
                  label={t("vote.newLockTime")}
                  value={durationParts.value}
                  unit={durationParts.unit}
                />
                <SummaryField
                  label={t("portfolio.estimatedVotingPower")}
                  value={formatAmount(votingPowerAfter)}
                  unit="vePoint"
                />
              </div>

              {/* Notice */}
              <div className="flex flex-col gap-2.5 rounded-[10px] border border-gray-30 p-2.5">
                <div className="flex items-center gap-1">
                  <AlertTriangleIcon className="size-6 shrink-0 text-red-30" />
                  <p className="body-14-bold text-red-30">
                    {t("portfolio.noticeTitle")}
                  </p>
                </div>
                <p className="body-14-medium whitespace-pre-line text-red-30">
                  {t("portfolio.increaseLockNotice")}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-5 px-[30px] pb-[30px] pt-10">
              <Button
                variant="secondary"
                size="lg"
                className="max-w-[295px] bg-gray-100 hover:bg-gray-90"
                onClick={handleBack}
              >
                {t("common.cancel")}
              </Button>
              {isInsufficientBalance ? (
                <Button
                  variant="danger"
                  size="lg"
                  className="max-w-[295px]"
                  disabled
                >
                  {t("swap.insufficientBalance")}
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="max-w-[295px]"
                  onClick={handleContinueToApprove}
                  disabled={!canIncrease}
                >
                  {t("portfolio.increase")}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {step === "approve" && (
        <StepShell
          title={t("portfolio.reviewIncreaseAmountTitle")}
          description={t("portfolio.reviewIncreaseAmountDescription")}
          summary={
            <SummaryCard
              lockNo={lockNoLabel}
              lockPeriod={periodLabel}
              baseAmount={baseAmountFormatted}
              increaseAmount={formatAmount(amountNum, 2)}
              totalAmount={formatAmount(totalAmount)}
              labels={{
                base: t("portfolio.baseLock"),
                increase: t("portfolio.increaseLockAmountLabel"),
                total: t("portfolio.totalLockAmount"),
                unit: "Point",
              }}
            />
          }
          banner={
            <DecorativeBanner>
              <h3 className="body-16-bold text-white">
                {t("portfolio.approveToSign")}
              </h3>
            </DecorativeBanner>
          }
          leftButton={{
            text: t("portfolio.edit"),
            onClick: handleEditAmount,
            disabled: isSigning,
          }}
          rightButton={{
            text: isSigning ? t("common.approving") : t("common.approve"),
            onClick: handleApprove,
            loading: isSigning,
            disabled: isSigning,
          }}
        />
      )}

      {step === "confirm" && (
        <StepShell
          title={t("portfolio.readyToIncreaseTitle")}
          description={t("portfolio.readyToIncreaseDescription")}
          summary={
            <SummaryCard
              lockNo={lockNoLabel}
              lockPeriod={periodLabel}
              baseAmount={baseAmountFormatted}
              increaseAmount={formatAmount(amountNum, 2)}
              totalAmount={formatAmount(totalAmount)}
              labels={{
                base: t("portfolio.baseLock"),
                increase: t("portfolio.increaseLockAmountLabel"),
                total: t("portfolio.totalLockAmount"),
                unit: "Point",
              }}
            />
          }
          banner={
            <DecorativeBanner>
              <h3 className="body-16-bold text-white">
                {t("portfolio.finalStepBoost")}
              </h3>
            </DecorativeBanner>
          }
          leftButton={{
            text: t("portfolio.edit"),
            onClick: handleEditAmount,
            disabled: isSubmitting,
          }}
          rightButton={{
            text: isSubmitting ? t("vote.confirming") : t("common.confirm"),
            onClick: handleConfirm,
            loading: isSubmitting,
            disabled: isSubmitting,
          }}
        />
      )}

      {step === "success" && (
        <StepShell
          title={t("portfolio.additionCompleteTitle")}
          description={t("portfolio.additionCompleteDescription")}
          summary={
            <SummaryCard
              lockNo={lockNoLabel}
              lockPeriod={periodLabel}
              baseAmount={baseAmountFormatted}
              increaseAmount={formatAmount(amountNum, 2)}
              totalAmount={formatAmount(totalAmount)}
              labels={{
                base: t("portfolio.baseLock"),
                increase: t("portfolio.increaseLockAmountLabel"),
                total: t("portfolio.totalLockAmount"),
                unit: "Point",
              }}
            />
          }
          banner={
            <DecorativeBanner>
              <h3 className="body-16-bold text-white">
                {t("portfolio.successfullyAdded")}
              </h3>
            </DecorativeBanner>
          }
          leftButton={{
            text: t("vote.viewConfirmation"),
            onClick: handleGoPortfolio,
          }}
          rightButton={{
            text: t("portfolio.goPortfolio"),
            onClick: handleGoPortfolio,
          }}
        />
      )}
    </div>
  );
}

interface SummaryCardProps {
  lockNo: string;
  lockPeriod: string;
  baseAmount: string;
  increaseAmount: string;
  totalAmount: string;
  labels: {
    base: string;
    increase: string;
    total: string;
    unit: string;
  };
}

function SummaryCard({
  lockNo,
  lockPeriod,
  baseAmount,
  increaseAmount,
  totalAmount,
  labels,
}: SummaryCardProps) {
  return (
    <div className="flex flex-col gap-5 rounded-[20px] bg-gray-20 p-5 text-gray-100">
      <div className="flex items-start justify-between gap-4">
        <span className="body-16-semibold">{labels.base}</span>
        <div className="flex flex-col items-end gap-1 text-right">
          <div className="flex items-center gap-2.5 whitespace-nowrap">
            <span className="body-16-bold">{lockNo}</span>
            <span className="body-16-bold">{lockPeriod}</span>
          </div>
          <div className="flex items-baseline gap-1 whitespace-nowrap">
            <span className="body-16-bold">{baseAmount}</span>
            <span className="body-16">{labels.unit}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="body-16-semibold">{labels.increase}</span>
        <div className="flex items-baseline gap-1 whitespace-nowrap">
          <span className="body-16-bold">{increaseAmount}</span>
          <span className="body-16">{labels.unit}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="body-16-semibold">{labels.total}</span>
        <div className="flex items-baseline gap-1 whitespace-nowrap">
          <span className="body-16-bold">{totalAmount}</span>
          <span className="body-16">{labels.unit}</span>
        </div>
      </div>
    </div>
  );
}

interface StepButtonConfig {
  text: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

interface StepShellProps {
  title: string;
  description: React.ReactNode;
  summary: React.ReactNode;
  banner: React.ReactNode;
  leftButton: StepButtonConfig;
  rightButton: StepButtonConfig;
}

function StepShell({
  title,
  description,
  summary,
  banner,
  leftButton,
  rightButton,
}: StepShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-[670px] flex-col gap-10 rounded-[40px] bg-white pb-[30px]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 pt-[30px]">
          <div className="flex flex-col gap-2.5 px-[30px]">
            <h1 className="text-[20px] font-bold leading-[30px] text-gray-100">
              {title}
            </h1>
            <div className="body-14-medium whitespace-pre-line text-gray-90">
              {description}
            </div>
          </div>
          <div className="h-px w-full bg-gray-30" />
        </div>
        <div className="px-[30px]">{summary}</div>
        <div className="px-[30px]">{banner}</div>
      </div>
      <div className="flex items-center justify-center gap-5 px-[30px]">
        <Button
          variant="secondary"
          size="lg"
          className="max-w-[295px]"
          onClick={leftButton.onClick}
          disabled={leftButton.disabled}
          loading={leftButton.loading}
        >
          {leftButton.text}
        </Button>
        <Button
          size="lg"
          className="max-w-[295px]"
          onClick={rightButton.onClick}
          disabled={rightButton.disabled}
          loading={rightButton.loading}
        >
          {rightButton.text}
        </Button>
      </div>
    </div>
  );
}

function SummaryField({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-start gap-2.5">
      <p className="body-16-semibold">{label}</p>
      <div className="flex w-full items-baseline justify-center gap-1 whitespace-nowrap rounded-[20px] bg-gray-20 px-2.5 py-5 text-center">
        <span className="text-[20px] font-bold leading-[30px]">{value}</span>
        <span className="body-14-medium">{unit}</span>
      </div>
    </div>
  );
}

function AlertTriangleIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function PercentBadgeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

