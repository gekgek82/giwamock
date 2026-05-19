"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateTPointLock } from "@/hooks/useCreateTPointLock";
import { useUserPoints } from "@/hooks/useUserPoints";
import { useTPointUserLocks } from "@/hooks/useTPointLocks";
import { useVoteEpoch } from "@/hooks/useVoteEpoch";
import { Button } from "@/components/common/Button";
import { LockStepLayout } from "@/components/vote/LockStepLayout";

const MAX_LOCK_DAYS = 1456; // 4 years
const TOTAL_STEPS = 208; // 208 weeks

/**
 * Convert slider step (0-208) to lock duration in days.
 * Step 0 = epoch remaining time (minimum).
 * Each subsequent step adds 1 week (7 days).
 */
function stepToDays(step: number, minDays: number): number {
  if (step <= 0) return minDays;
  const days = minDays + step * 7;
  return Math.min(MAX_LOCK_DAYS, days);
}

/**
 * Format duration days to human-readable display.
 * Matches Aerodrome behavior:
 * - < 1 day: "X Hours"
 * - < 28 days: "X Days"
 * - < 365 days: "X Months" (Math.round for natural label sync)
 * - >= 365 days: "X Years"
 */
function formatDuration(days: number): { value: number; unit: string } {
  if (days < 1) {
    const hours = Math.max(1, Math.round(days * 24));
    return { value: hours, unit: hours === 1 ? "Hour" : "Hours" };
  }
  if (days < 28) {
    const d = Math.round(days);
    return { value: d, unit: d === 1 ? "Day" : "Days" };
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return { value: months, unit: months === 1 ? "Month" : "Months" };
  }
  const years = Math.round(days / 365);
  return { value: years, unit: years === 1 ? "Year" : "Years" };
}

function calculateVotingPower(amount: number, days: number): number {
  return amount * (days / MAX_LOCK_DAYS);
}

/** Generate display labels for slider marks */
function buildSliderMarks(minDays: number) {
  const minLabel =
    minDays < 1
      ? `${Math.max(1, Math.round(minDays * 24))}h`
      : `${Math.round(minDays)}d`;

  return [
    { label: minLabel, position: 0 },
    { label: "1y", position: 25 },
    { label: "2y", position: 50 },
    { label: "3y", position: 75 },
    { label: "4y", position: 100 },
  ];
}

type FormStep = "input" | "confirm" | "success";

export function CreateTPointLockForm() {
  const router = useRouter();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { createLock, isPending } = useCreateTPointLock();
  const { points } = useUserPoints();
  const { summary: tpointSummary } = useTPointUserLocks();
  const { epoch } = useVoteEpoch();

  const tpointBalance = Math.max(
    0,
    parseFloat(points?.onChainBalance ?? "0") -
      parseFloat(tpointSummary?.totalLocked ?? "0"),
  ).toString();

  // Minimum lock duration = epoch remaining time (in fractional days)
  const minDays = useMemo(() => {
    if (!epoch?.endsInSeconds) return 7; // fallback: 7 days
    return Math.max(0.01, epoch.endsInSeconds / 86400);
  }, [epoch?.endsInSeconds]);

  const sliderMarks = useMemo(() => buildSliderMarks(minDays), [minDays]);

  const [formStep, setFormStep] = useState<FormStep>("input");
  const [amount, setAmount] = useState("");
  const [sliderStep, setSliderStep] = useState(TOTAL_STEPS); // Default: max (4 years)
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningChecked, setWarningChecked] = useState(false);
  const [showAmountSlider, setShowAmountSlider] = useState(false);
  const [amountSliderPercent, setAmountSliderPercent] = useState(0);

  const isInsufficientBalance =
    amount !== "" && parseFloat(amount) > parseFloat(tpointBalance);

  const selectedDays = useMemo(
    () => stepToDays(sliderStep, minDays),
    [sliderStep, minDays],
  );
  const sliderPercent = (sliderStep / TOTAL_STEPS) * 100;

  const lockTime = useMemo(() => formatDuration(selectedDays), [selectedDays]);
  const votingPower = useMemo(() => {
    const numAmount = parseFloat(amount) || 0;
    return calculateVotingPower(numAmount, selectedDays);
  }, [amount, selectedDays]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSliderStep(Number(e.target.value));
    },
    [],
  );

  const handlePercentage = (percentage: number) => {
    const balance = parseFloat(tpointBalance) || 0;
    const newAmount = (balance * percentage) / 100;
    setAmount(newAmount.toString());
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

  const handleCancel = () => {
    router.back();
  };

  const handleCreateLock = () => {
    setShowWarningModal(true);
    setWarningChecked(false);
  };

  const handleWarningConfirm = () => {
    setShowWarningModal(false);
    setFormStep("confirm");
  };

  const handleEditAmount = () => {
    setFormStep("input");
  };

  const handleConfirm = async () => {
    try {
      await createLock(amount, selectedDays);
      setFormStep("success");
      queryClient.invalidateQueries({ queryKey: ["portfolio", "points"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio", "locks"] });
      queryClient.invalidateQueries({ queryKey: ["tpoint-locks"] });
    } catch {
      // Error toast handled in hook
    }
  };

  const handleGoToDashboard = () => {
    router.push("/portfolio");
  };

  const summaryProps = {
    amount: { value: amount || "0", unit: "tPOINT" },
    duration: { value: String(lockTime.value), unit: lockTime.unit },
    votingPower: { value: votingPower.toFixed(5), unit: "vePOINT" },
  };

  if (formStep === "success") {
    return (
      <LockStepLayout
        title={t("vote.lockCreatedTitle")}
        description={
          <>
            <p className="leading-[21px]">
              {t("vote.lockCreatedDescription1")}
            </p>
            <p className="leading-[21px]">
              {t("vote.lockCreatedDescription2")}
            </p>
          </>
        }
        {...summaryProps}
        heroText={t("vote.lockHasBeenCreated")}
        leftButton={{
          text: t("vote.viewConfirmation"),
          onClick: handleGoToDashboard,
        }}
        rightButton={{
          text: t("vote.goPortfolio"),
          onClick: handleGoToDashboard,
        }}
      />
    );
  }

  if (formStep === "confirm") {
    return (
      <LockStepLayout
        title={t("vote.finalReviewTitle")}
        description={t("vote.finalReviewDescription")}
        {...summaryProps}
        heroText={t("vote.readyToLockUp")}
        leftButton={{
          text: t("vote.edit"),
          onClick: handleEditAmount,
          disabled: isPending,
        }}
        rightButton={{
          text: isPending ? t("vote.confirming") : t("common.confirm"),
          onClick: handleConfirm,
          loading: isPending,
        }}
      />
    );
  }

  // Input Step
  const hasAmount = !!amount && parseFloat(amount) > 0;

  return (
    <div className="mx-auto flex w-full max-w-[670px] flex-col bg-white rounded-[40px]">
      {/* Page Header */}
      <div className="flex flex-col gap-3 pt-[30px]">
        <div className="flex flex-col gap-2.5 px-[30px]">
          <h1 className="text-[20px] leading-[30px] font-bold text-gray-100">
            {t("vote.createNewLockTitle")}
          </h1>
          <p className="body-14-medium text-gray-90">
            {t("vote.readyToEarn")}. {t("vote.cannotUnlockEarly")}{" "}
            {t("vote.extendDuration")}
          </p>
        </div>
        <div className="h-px w-full bg-gray-30" />
      </div>

      {/* Warning Banner */}
      <div className="px-[30px] pt-5">
        <div className="flex items-center gap-1 rounded-[10px] border border-gray-30 p-2.5">
          <AlertTriangleIcon className="size-6 shrink-0 text-red-30" />
          <p className="body-14-medium flex-1 text-red-30">
            {t("vote.lockNotice")}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-[30px] px-[30px] pt-5">
        {/* Amount Section */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-end gap-4">
            <span
              className={`body-14-medium ${isInsufficientBalance ? "text-red-30" : "text-gray-100"}`}
            >
              {tpointBalance} tPOINT
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePercentage(50)}
                className="body-14-medium rounded-[10px] bg-gray-30 px-2 py-1 text-gray-100 transition-colors hover:bg-gray-40"
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => handlePercentage(100)}
                className="body-14-medium rounded-[10px] bg-gray-30 px-2 py-1 text-gray-100 transition-colors hover:bg-gray-40"
              >
                100%
              </button>
              <button
                type="button"
                onClick={toggleAmountSlider}
                aria-label="Toggle percentage slider"
                aria-pressed={showAmountSlider}
                className="rounded-[10px] transition-opacity hover:opacity-90"
              >
                <PercentIcon />
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
              <span className="body-16-semibold text-gray-100">tPOINT</span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-end text-gray-100">
              <div className="flex w-full items-baseline justify-end gap-1.5">
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
                <button
                  type="button"
                  onClick={() => handlePercentage(100)}
                  className="shrink-0 text-[20px] font-normal leading-[30px] text-gray-100 hover:text-green-20"
                >
                  {t("common.max")}
                </button>
              </div>
              <span className="body-14-medium text-gray-100">~$0.0</span>
            </div>
          </div>
        </section>

        {/* Duration Slider */}
        <section className="flex flex-col gap-2.5">
          <div className="relative grid grid-cols-1 grid-rows-1 place-items-start">
            <div className="col-start-1 row-start-1 mt-[7px] h-[10px] w-full rounded-full bg-gray-30" />
            <div
              className="col-start-1 row-start-1 mt-[7px] h-[10px] rounded-full bg-green-10"
              style={{ width: `${sliderPercent}%` }}
            />
            <input
              type="range"
              min="0"
              max={TOTAL_STEPS}
              value={sliderStep}
              onChange={handleSliderChange}
              className="col-start-1 row-start-1 h-[25px] w-full cursor-pointer opacity-0"
            />
            <div
              className="pointer-events-none col-start-1 row-start-1 size-[25px] rounded-[10px] bg-green-10"
              style={{
                marginLeft: `calc(${sliderPercent}% - 12.5px)`,
              }}
            />
          </div>

          <div className="body-14-medium flex w-full items-center gap-[34px] text-gray-100">
            <span className="w-20 text-left">{sliderMarks[0].label}</span>
            <span className="flex-1 text-center">1 year</span>
            <span className="flex-1 text-center">2 years</span>
            <span className="flex-1 text-center">3 years</span>
            <span className="w-20 text-right">4 years</span>
          </div>
        </section>

        {/* Summary Fields */}
        <div className="flex w-full items-center gap-5 text-gray-100">
          <SummaryField
            label={t("vote.newLockTime")}
            value={String(lockTime.value)}
            unit={lockTime.unit}
          />
          <SummaryField
            label={t("vote.newEstimatedVotingPower")}
            value={votingPower.toFixed(1)}
            unit="vePOINT"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-5 px-[30px] pb-[30px] pt-10">
        <Button
          variant="secondary"
          size="lg"
          className="max-w-[295px] bg-gray-100 hover:bg-gray-90"
          onClick={handleCancel}
        >
          {t("common.cancel")}
        </Button>
        {isInsufficientBalance ? (
          <Button variant="danger" size="lg" className="max-w-[295px]" disabled>
            {t("swap.insufficientBalance")}
          </Button>
        ) : (
          <Button
            size="lg"
            className="max-w-[295px]"
            onClick={handleCreateLock}
            disabled={!hasAmount}
          >
            {t("vote.createLock")}
          </Button>
        )}
      </div>

      {/* Warning Modal */}
      {showWarningModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(77,77,77,0.8)]"
          onClick={() => setShowWarningModal(false)}
        >
          <div
            className="flex w-[520px] max-w-[90%] flex-col gap-[30px] rounded-[30px] bg-gray-10 pb-[30px]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex flex-col gap-3 pt-[30px]">
              <div className="flex items-center gap-2.5 px-[30px]">
                <h3 className="flex-1 text-[20px] font-bold leading-[30px] text-gray-100">
                  {t("vote.warningTitle")}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowWarningModal(false)}
                  aria-label={t("common.close")}
                  className="shrink-0 text-gray-100 transition-opacity hover:opacity-70"
                >
                  <CloseIcon className="size-6" />
                </button>
              </div>
              <div className="h-px w-full bg-gray-30" />
            </div>

            {/* Body */}
            <div className="flex flex-col gap-3 px-[30px]">
              <div className="flex items-center gap-1">
                <AlertTriangleIcon className="size-6 shrink-0 text-red-30" />
                <p className="body-14-bold text-red-30">
                  {t("vote.tokenAdditionWarning")}
                </p>
              </div>
              <p className="body-16-semibold text-black">
                {t("vote.lockWarningMessage")}
              </p>
              <button
                type="button"
                onClick={() => setWarningChecked(!warningChecked)}
                className="flex w-full items-center gap-1.5 text-left"
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-[5px] transition-colors ${
                    warningChecked
                      ? "bg-green-10"
                      : "border-2 border-gray-40 bg-white"
                  }`}
                >
                  {warningChecked && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-4"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span className="body-14-medium flex-1 text-neutral-1000">
                  {t("vote.understandRisks")}
                </span>
              </button>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-center gap-5 px-[30px]">
              <Button
                variant="secondary"
                size="lg"
                className="w-[220px]"
                onClick={() => setShowWarningModal(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="lg"
                className="w-[220px]"
                onClick={handleWarningConfirm}
                disabled={!warningChecked}
              >
                {t("vote.continue")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CloseIcon({ className = "" }: { className?: string }) {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function PercentIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="28" height="28" rx="10" fill="#00D185" />
      <path
        d="M11.8789 17.642C11.8789 18.5167 11.1669 19.2259 10.2885 19.2259C9.4102 19.2259 8.69817 18.5167 8.69817 17.642C8.69817 16.7672 9.4102 16.0581 10.2885 16.0581C11.1669 16.0581 11.8789 16.7672 11.8789 17.642Z"
        fill="white"
      />
      <path
        d="M19.3005 10.2504C19.3005 11.1252 18.5885 11.8343 17.7102 11.8343C16.8318 11.8343 16.1198 11.1252 16.1198 10.2504C16.1198 9.37564 16.8318 8.6665 17.7102 8.6665C18.5885 8.6665 19.3005 9.37564 19.3005 10.2504Z"
        fill="white"
      />
      <path
        d="M19.3327 19.3332L8.66602 8.70975M11.8789 17.642C11.8789 18.5167 11.1669 19.2259 10.2885 19.2259C9.4102 19.2259 8.69817 18.5167 8.69817 17.642C8.69817 16.7672 9.4102 16.0581 10.2885 16.0581C11.1669 16.0581 11.8789 16.7672 11.8789 17.642ZM19.3005 10.2504C19.3005 11.1252 18.5885 11.8343 17.7102 11.8343C16.8318 11.8343 16.1198 11.1252 16.1198 10.2504C16.1198 9.37564 16.8318 8.6665 17.7102 8.6665C18.5885 8.6665 19.3005 9.37564 19.3005 10.2504Z"
        stroke="#F8FAFC"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
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
