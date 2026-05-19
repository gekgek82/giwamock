"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { portfolioApi } from "@/lib/portfolioApi";
import { useExtendTPointLock } from "@/hooks/useExtendTPointLock";
import { Button } from "@/components/common/Button";
import { DecorativeBanner } from "@/components/common/DecorativeBanner";
import {
  ChangeBaseLockModal,
  type BaseLockOption,
} from "@/components/vote/ChangeBaseLockModal";
import type { TPointLockPosition } from "@/types/portfolio";

const MAX_LOCK_DAYS = 1456;
const MIN_EXTENSION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

type Step = "input" | "confirm" | "success";

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
    Math.ceil((new Date(lockEnd).getTime() - Date.now()) / DAY_MS),
  );
  const yearsLabel = lockDays >= 365 ? `${years} Years` : `${lockDays} Days`;
  return `${yearsLabel}[D-${remainingDays}]`;
}

function formatDurationParts(days: number): { value: string; unit: string } {
  if (days >= 365) {
    const years = Math.round((days / 365) * 10) / 10;
    return { value: String(years), unit: years === 1 ? "Year" : "Years" };
  }
  if (days >= 30) {
    const months = Math.round(days / 30);
    return { value: String(months), unit: months === 1 ? "Month" : "Months" };
  }
  const d = Math.max(0, Math.round(days));
  return { value: String(d), unit: d === 1 ? "Day" : "Days" };
}

interface Props {
  lockId: number;
}

export function ExtendTPointLockForm({ lockId }: Props) {
  const router = useRouter();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { address } = useAccount();

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

  const { signExtend, submitExtend, isSigning, isSubmitting } =
    useExtendTPointLock();

  const [step, setStep] = useState<Step>("input");
  const [autoMax, setAutoMax] = useState(false);
  const [extensionDays, setExtensionDays] = useState<number>(
    MIN_EXTENSION_DAYS,
  );

  // Seed the Auto-Max toggle from the lock's current state so users coming from
  // the portfolio see their existing choice reflected on entry.
  useEffect(() => {
    if (lockData) setAutoMax(lockData.autoMax);
  }, [lockData]);
  // Snapshot of values at submit time so the success view stays stable after
  // the underlying lock refetches with new lockEnd / VP.
  const [submittedSnapshot, setSubmittedSnapshot] = useState<{
    lockNo: string;
    originalRemainingDays: number;
    newDurationDays: number;
  } | null>(null);

  const currentRemainingDays = useMemo(() => {
    if (!lockData) return 0;
    const remainingMs = new Date(lockData.lockEnd).getTime() - Date.now();
    return Math.max(0, remainingMs / DAY_MS);
  }, [lockData]);

  const maxExtensionDays = Math.max(
    0,
    MAX_LOCK_DAYS - currentRemainingDays,
  );
  const canExtend = maxExtensionDays >= MIN_EXTENSION_DAYS;

  // Clamp the slider value whenever the ceiling shifts (e.g. after lock switch)
  useEffect(() => {
    setExtensionDays((prev) => {
      if (!canExtend) return 0;
      const clamped = Math.min(
        Math.max(prev, MIN_EXTENSION_DAYS),
        maxExtensionDays,
      );
      return clamped;
    });
  }, [maxExtensionDays, canExtend]);

  const newDurationDays = useMemo(() => {
    if (!lockData) return 0;
    if (autoMax) return MAX_LOCK_DAYS;
    const projected = currentRemainingDays + extensionDays;
    return Math.min(MAX_LOCK_DAYS, projected);
  }, [autoMax, currentRemainingDays, extensionDays, lockData]);

  const newVotingPower = useMemo(() => {
    if (!lockData) return 0;
    const amount = parseFloat(lockData.amount);
    if (isNaN(amount) || amount <= 0) return 0;
    return amount * (newDurationDays / MAX_LOCK_DAYS);
  }, [lockData, newDurationDays]);

  const handleBack = () => {
    router.push("/portfolio");
  };

  const handleBackToInput = () => {
    setStep("input");
  };

  const handleProceed = () => {
    if (!lockData) return;
    if (newDurationDays <= currentRemainingDays + 0.01) return;
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!lockData) return;
    // Round to 4 decimals to ensure client-signed message matches the value we
    // send to the server; BigInt conversion in calcVP is integer-safe on API.
    const durationToSend = Math.round(newDurationDays * 10000) / 10000;
    try {
      const { signature, message } = await signExtend(
        activeLockId,
        durationToSend,
        autoMax,
      );
      await submitExtend(
        activeLockId,
        durationToSend,
        autoMax,
        signature,
        message,
      );
      setSubmittedSnapshot({
        lockNo: `#${lockData.id}`,
        originalRemainingDays: currentRemainingDays,
        newDurationDays: durationToSend,
      });
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["tpoint-locks"] });
      queryClient.invalidateQueries({ queryKey: ["tpoint-lock", activeLockId] });
      queryClient.invalidateQueries({ queryKey: ["portfolio", "locks"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio", "points"] });
    } catch {
      // Toast is handled inside the hook.
    }
  };

  const handleSelectBaseLock = (selected: BaseLockOption) => {
    const id = parseInt(selected.id, 10);
    if (!isNaN(id)) {
      setActiveLockId(id);
      setExtensionDays(MIN_EXTENSION_DAYS);
      setAutoMax(false);
      setSubmittedSnapshot(null);
      setStep("input");
    }
    setIsChangeModalOpen(false);
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

  if (!address) {
    return (
      <div className="py-12 text-center text-neutral-700 body-14">
        {t("common.connectWallet")}
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

  const periodLabel = formatPeriodLabel(lockData.lockDays, lockData.lockEnd);
  const lockNoLabel = `#${lockData.id}`;

  // ----- Step 1: Setup -----

  if (step === "input") {
    const lockTimeParts = formatDurationParts(newDurationDays);

    return (
      <div className="mx-auto flex w-full max-w-[670px] flex-col gap-5">
        <ChangeBaseLockModal
          isOpen={isChangeModalOpen}
          onClose={() => setIsChangeModalOpen(false)}
          onSelect={handleSelectBaseLock}
          locks={baseLockOptions}
          initialSelectedId={activeLockId.toString()}
        />

        {/* Page Header */}
        <div className="flex flex-col gap-2 px-2 text-gray-100">
          <h2 className="text-[24px] font-bold leading-[36px]">
            {t("portfolio.extendLocksTitle")}
          </h2>
          <p className="whitespace-pre-line text-[16px] font-medium leading-[24px]">
            {t("portfolio.extendLocksDescription")}
          </p>
        </div>

        {/* Section 1: Selected Base Lock */}
        <div className="flex flex-col gap-5 rounded-[40px] bg-white pb-[30px]">
          <SectionHeader>
            1. {t("portfolio.selectedBaseLock")}
          </SectionHeader>

          <div className="flex flex-col gap-[10px] px-[30px]">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-5 rounded-[10px] bg-gray-20 px-5 py-[10px]">
              <div className="body-14-bold text-center text-gray-100">
                {t("portfolio.no")}
              </div>
              <div className="body-14-bold text-center text-gray-100">
                {t("portfolio.lockPeriod")}
              </div>
              <div className="body-14-bold text-center text-gray-100">
                {t("portfolio.lockedAmount")}
              </div>
              <div className="w-[78px] shrink-0" aria-hidden="true" />
            </div>

            <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-5 rounded-[10px] bg-gray-20 px-5 py-5">
              <p className="text-[16px] font-normal leading-[24px] text-gray-100">
                {lockNoLabel}
              </p>
              <p className="text-[16px] font-normal leading-[24px] text-gray-100">
                {periodLabel}
              </p>
              <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                <span className="text-[16px] font-normal leading-[24px] text-gray-80">
                  {formatAmount(lockData.amount)}
                </span>
                <span className="body-14-medium text-gray-100">Point</span>
              </div>
              <button
                type="button"
                onClick={() => setIsChangeModalOpen(true)}
                className="body-14-medium flex h-[33px] shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] bg-gray-80 px-[10px] py-[6px] text-gray-10 transition-colors hover:bg-gray-90"
              >
                {t("portfolio.change")}
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Extend Lock Time */}
        <div className="flex flex-col gap-10 rounded-[40px] bg-white pb-[30px]">
          <div className="flex flex-col gap-5">
            <SectionHeader>
              2. {t("portfolio.extendLockTimeTitle")}
            </SectionHeader>

            <div className="flex flex-col gap-5 px-[30px]">
              {/* Auto-Max Lock toggle */}
              <div className="flex items-center justify-end gap-5">
                <div className="flex items-center gap-1">
                  <span className="text-[16px] font-bold leading-[24px] text-gray-100">
                    {t("portfolio.autoMaxLockMode")}
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex size-4 items-center justify-center rounded-full bg-gray-20 text-[10px] font-medium leading-none text-gray-70"
                  >
                    i
                  </span>
                </div>
                <AutoMaxSegmentedControl
                  enabled={autoMax}
                  onChange={setAutoMax}
                  disabled={!canExtend}
                />
              </div>

              <ExtensionSlider
                valueDays={extensionDays}
                minDays={MIN_EXTENSION_DAYS}
                maxDays={Math.max(MIN_EXTENSION_DAYS, maxExtensionDays)}
                disabled={autoMax || !canExtend}
                onChange={setExtensionDays}
              />

              <div className="grid grid-cols-2 gap-5 text-gray-100">
                <SummaryField
                  label={t("portfolio.newLockTime")}
                  value={lockTimeParts.value}
                  unit={lockTimeParts.unit}
                />
                <SummaryField
                  label={t("portfolio.newEstimatedVotingPower")}
                  value={formatAmount(newVotingPower, 6)}
                  unit="vePoint"
                />
              </div>
            </div>

            {/* Notice */}
            <div className="mx-[30px] flex flex-col gap-[10px] rounded-[10px] border border-gray-30 p-[10px]">
              <div className="flex items-center gap-1">
                <AlertTriangleIcon className="size-6 shrink-0 text-red-30" />
                <p className="body-14-bold text-red-30">
                  {t("portfolio.noticeTitle")}
                </p>
              </div>
              <p className="body-14-medium whitespace-pre-line text-red-30">
                {autoMax
                  ? t("portfolio.extendAutoMaxNotice")
                  : t("portfolio.extendManualNotice")}
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex w-full items-center justify-center gap-5 px-[30px]">
            <Button
              variant="secondary"
              size="lg"
              className="max-w-[295px]"
              onClick={handleBack}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="lg"
              className="max-w-[295px]"
              onClick={handleProceed}
              disabled={
                !canExtend || newDurationDays <= currentRemainingDays + 0.01
              }
            >
              {t("portfolio.extendLockTimeAction")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ----- Step 2: Confirm -----

  if (step === "confirm") {
    return (
      <div className="mx-auto flex w-full max-w-[670px] flex-col items-center gap-10 rounded-[40px] bg-white pb-[30px]">
        <div className="flex w-full flex-col items-center gap-5">
          <StepPageHeader
            title={t("portfolio.confirmExtendTitle")}
            description={t("portfolio.confirmExtendDescription")}
          />

          <div className="w-full px-[30px]">
            <ExtendSummaryCard
              lockNo={lockNoLabel}
              amount={{
                value: formatAmount(lockData.amount),
                unit: "point",
              }}
              remaining={formatDurationParts(currentRemainingDays)}
              newLockTime={formatDurationParts(
                Math.max(0, newDurationDays - currentRemainingDays),
              )}
              totalLockTime={formatDurationParts(newDurationDays)}
              labels={{
                remainingTime: t("portfolio.remainingTime"),
                newLockTime: t("portfolio.newLockTime"),
                totalLockTime: t("portfolio.totalLockTime"),
              }}
            />
          </div>

          <div className="w-full px-[30px]">
            <DecorativeBanner>
              <p className="body-16-bold whitespace-pre-line text-center text-white">
                {t("portfolio.extendSignPrompt")}
              </p>
            </DecorativeBanner>
          </div>
        </div>

        <div className="flex w-full items-center justify-center gap-5 px-[30px]">
          <Button
            variant="secondary"
            size="lg"
            className="max-w-[295px]"
            onClick={handleBackToInput}
            disabled={isSigning || isSubmitting}
          >
            {t("common.goBack")}
          </Button>
          <Button
            size="lg"
            className="max-w-[295px]"
            onClick={handleConfirm}
            loading={isSigning || isSubmitting}
            disabled={isSigning || isSubmitting}
          >
            {isSigning || isSubmitting
              ? t("vote.confirming")
              : t("common.confirm")}
          </Button>
        </div>
      </div>
    );
  }

  // ----- Step 3: Success -----

  if (step === "success" && submittedSnapshot) {
    return (
      <div className="mx-auto flex w-full max-w-[670px] flex-col items-center gap-10 rounded-[40px] bg-white pb-[30px]">
        <div className="flex w-full flex-col items-center gap-5">
          <StepPageHeader
            title={t("portfolio.extendSuccessTitle")}
            description={t("portfolio.extendSuccessDescription")}
          />

          <div className="w-full px-[30px]">
            <ExtendSummaryCard
              lockNo={submittedSnapshot.lockNo}
              amount={{
                value: formatAmount(lockData.amount),
                unit: "point",
              }}
              remaining={formatDurationParts(
                submittedSnapshot.originalRemainingDays,
              )}
              newLockTime={formatDurationParts(
                Math.max(
                  0,
                  submittedSnapshot.newDurationDays -
                    submittedSnapshot.originalRemainingDays,
                ),
              )}
              totalLockTime={formatDurationParts(
                submittedSnapshot.newDurationDays,
              )}
              labels={{
                remainingTime: t("portfolio.remainingTime"),
                newLockTime: t("portfolio.newLockTime"),
                totalLockTime: t("portfolio.totalLockTime"),
              }}
            />
          </div>

          <div className="w-full px-[30px]">
            <DecorativeBanner>
              <p className="body-16-bold text-center text-white">
                {t("portfolio.extendConfirmedBanner")}
              </p>
            </DecorativeBanner>
          </div>
        </div>

        <div className="flex w-full items-center justify-center gap-5 px-[30px]">
          <Button
            variant="secondary"
            size="lg"
            className="max-w-[295px]"
            onClick={handleGoPortfolio}
          >
            {t("vote.viewConfirmation")}
          </Button>
          <Button
            size="lg"
            className="max-w-[295px]"
            onClick={handleGoPortfolio}
          >
            {t("portfolio.goPortfolio")}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 pt-[30px]">
      <div className="px-[30px]">
        <h3 className="text-[20px] font-bold leading-[30px] text-gray-100">
          {children}
        </h3>
      </div>
      <div className="h-px w-full bg-gray-30" />
    </div>
  );
}

function StepPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex w-full flex-col gap-3 pt-[30px]">
      <div className="flex flex-col gap-2.5 px-[30px]">
        <h2 className="text-[20px] font-bold leading-[30px] text-gray-100">
          {title}
        </h2>
        <p className="body-14-medium whitespace-pre-line text-gray-90">
          {description}
        </p>
      </div>
      <div className="h-px w-full bg-gray-30" />
    </div>
  );
}

interface AutoMaxSegmentedControlProps {
  enabled: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

function AutoMaxSegmentedControl({
  enabled,
  disabled,
  onChange,
}: AutoMaxSegmentedControlProps) {
  return (
    <div
      className="inline-flex items-center rounded-[40px] bg-gray-20 p-1"
      role="group"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        aria-pressed={enabled}
        className={`body-14-medium rounded-[40px] px-1.5 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          enabled ? "bg-gray-100 text-gray-10" : "text-gray-100"
        }`}
      >
        On
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        aria-pressed={!enabled}
        className={`body-14-medium rounded-[40px] px-1.5 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          !enabled ? "bg-gray-100 text-gray-10" : "text-gray-100"
        }`}
      >
        Off
      </button>
    </div>
  );
}

interface ExtensionSliderProps {
  valueDays: number;
  minDays: number;
  maxDays: number;
  disabled?: boolean;
  onChange: (days: number) => void;
}

function ExtensionSlider({
  valueDays,
  minDays,
  maxDays,
  disabled,
  onChange,
}: ExtensionSliderProps) {
  const effectiveValue = Math.min(Math.max(valueDays, minDays), maxDays);
  const percent =
    maxDays > minDays
      ? ((effectiveValue - minDays) / (maxDays - minDays)) * 100
      : 0;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative grid grid-cols-1 grid-rows-1 place-items-start">
        <div className="col-start-1 row-start-1 mt-[7px] h-[10px] w-full rounded-full bg-gray-20" />
        <input
          type="range"
          min={minDays}
          max={maxDays}
          step={1}
          value={effectiveValue}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="col-start-1 row-start-1 h-[25px] w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <div
          className={`pointer-events-none col-start-1 row-start-1 size-[25px] rounded-[10px] transition-colors ${
            disabled ? "bg-gray-40" : "bg-red-40"
          }`}
          style={{
            marginLeft: `calc(${percent}% - 12.5px)`,
          }}
          aria-hidden="true"
        />
      </div>

      <div className="body-14-medium flex w-full items-center gap-[34px] text-gray-100">
        <span className="w-20 text-left">7 days</span>
        <span className="flex-1 text-center">1 year</span>
        <span className="flex-1 text-center">2 years</span>
        <span className="flex-1 text-center">3 years</span>
        <span className="w-20 text-right">4 years</span>
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
    <div className="flex flex-col items-start gap-2.5">
      <p className="text-[16px] font-semibold leading-[24px]">{label}</p>
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

interface ValueUnit {
  value: string;
  unit: string;
}

interface ExtendSummaryCardProps {
  lockNo: string;
  amount: ValueUnit;
  remaining: ValueUnit;
  newLockTime: ValueUnit;
  totalLockTime: ValueUnit;
  labels: {
    remainingTime: string;
    newLockTime: string;
    totalLockTime: string;
  };
}

function ExtendSummaryCard({
  lockNo,
  amount,
  remaining,
  newLockTime,
  totalLockTime,
  labels,
}: ExtendSummaryCardProps) {
  return (
    <div className="flex flex-col items-end gap-5 rounded-[20px] bg-gray-20 p-5">
      <div className="flex w-full items-center justify-between whitespace-nowrap">
        <p className="text-[16px] font-semibold leading-[24px] text-gray-100">
          {labels.remainingTime}
        </p>
        <div className="flex items-center gap-[10px] text-right">
          <p className="text-[20px] font-bold leading-[30px] text-black">
            {lockNo}
          </p>
          <div className="flex items-center gap-1">
            <span className="text-[20px] font-bold leading-[30px] text-black">
              {amount.value}
            </span>
            <span className="text-[16px] font-medium leading-[24px] text-gray-100">
              {amount.unit}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[20px] font-bold leading-[30px] text-black">
              {remaining.value}
            </span>
            <span className="text-[16px] font-medium leading-[24px] text-gray-100">
              {remaining.unit}
            </span>
          </div>
        </div>
      </div>
      <SummaryRow label={labels.newLockTime} value={newLockTime} />
      <SummaryRow label={labels.totalLockTime} value={totalLockTime} />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: ValueUnit }) {
  return (
    <div className="flex w-full items-center justify-between">
      <p className="flex-1 text-[16px] font-semibold leading-[24px] text-gray-100">
        {label}
      </p>
      <div className="flex items-center gap-1 whitespace-nowrap text-right">
        <span className="text-[20px] font-bold leading-[30px] text-black">
          {value.value}
        </span>
        <span className="text-[16px] font-medium leading-[24px] text-gray-100">
          {value.unit}
        </span>
      </div>
    </div>
  );
}

