"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { portfolioApi } from "@/lib/portfolioApi";
import { useDisableAutoMax } from "@/hooks/useDisableAutoMax";
import { Button } from "@/components/common/Button";
import { DecorativeBanner } from "@/components/common/DecorativeBanner";

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCK_UNIT = "Point";

type Step = "confirm" | "success";

function formatAmount(value: string | number, maxFraction = 5): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFraction,
  });
}

function computeRemainingDays(lockEnd: string): number {
  const diffMs = new Date(lockEnd).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / DAY_MS));
}

function formatWithdrawalDate(lockEnd: string): string {
  return new Date(lockEnd).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatYearsRemaining(days: number): string {
  if (days >= 365) {
    const years = Math.round((days / 365) * 10) / 10;
    return `${years} ${years === 1 ? "year" : "years"} remaining`;
  }
  if (days >= 30) {
    const months = Math.round(days / 30);
    return `${months} ${months === 1 ? "month" : "months"} remaining`;
  }
  return `${days} ${days === 1 ? "day" : "days"} remaining`;
}

interface Props {
  lockId: number;
}

export function DisableAutoMaxForm({ lockId }: Props) {
  const router = useRouter();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { address } = useAccount();

  const { data: lockData, isLoading } = useQuery({
    queryKey: ["tpoint-lock", lockId],
    queryFn: () => portfolioApi.getTPointLockById(lockId),
    enabled: !isNaN(lockId),
    staleTime: 15_000,
  });

  const { disableAutoMax, isWorking } = useDisableAutoMax();

  const [step, setStep] = useState<Step>("confirm");
  const [submittedSnapshot, setSubmittedSnapshot] = useState<{
    remainingDays: number;
    lockEnd: string;
  } | null>(null);

  const remainingDays = useMemo(
    () => (lockData ? computeRemainingDays(lockData.lockEnd) : 0),
    [lockData],
  );

  const handleCancel = () => {
    router.push("/portfolio");
  };

  const handleConfirm = async () => {
    if (!lockData) return;
    const snapshot = {
      remainingDays: computeRemainingDays(lockData.lockEnd),
      lockEnd: lockData.lockEnd,
    };
    const ok = await disableAutoMax(lockId);
    if (ok) {
      setSubmittedSnapshot(snapshot);
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["tpoint-lock", lockId] });
      queryClient.invalidateQueries({ queryKey: ["tpoint-locks"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio", "locks"] });
    }
  };

  const handleGoPortfolio = () => {
    router.push("/portfolio");
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center text-gray-70 body-14">
        {t("common.loading")}
      </div>
    );
  }

  if (!address) {
    return (
      <div className="py-12 text-center text-gray-70 body-14">
        {t("common.connectWallet")}
      </div>
    );
  }

  if (!lockData) {
    return (
      <div className="py-12 text-center text-gray-70 body-14">
        {t("portfolio.lockNotFound")}
      </div>
    );
  }

  const lockNoLabel = `#${lockData.id}`;
  const amountLabel = formatAmount(lockData.amount);
  const dDay = `D-${remainingDays}`;

  if (step === "confirm") {
    return (
      <div className="mx-auto flex w-full max-w-[670px] flex-col items-center gap-10 rounded-[40px] bg-white pb-[30px]">
        <div className="flex w-full flex-col items-center gap-5">
          <StepPageHeader
            title={t("portfolio.disableAutoMaxTitle")}
            description={t("portfolio.disableAutoMaxDescription")}
          />

          {/* Base Lock summary */}
          <div className="w-full px-[30px]">
            <div className="flex items-center justify-between gap-5 rounded-[20px] bg-gray-20 p-5 whitespace-nowrap">
              <span className="text-[16px] font-semibold leading-[24px] text-gray-100">
                {t("portfolio.baseLock")}
              </span>
              <span className="text-[16px] font-semibold leading-[24px] text-gray-100">
                {lockNoLabel}
              </span>
              <div className="flex items-center gap-1 text-gray-100">
                <span className="text-[16px] font-semibold leading-[24px]">
                  {amountLabel}
                </span>
                <span className="body-14-medium">{LOCK_UNIT}</span>
              </div>
              <span className="text-[16px] font-bold leading-[24px] text-red-30">
                {t("portfolio.autoMaxLockOn")}
              </span>
            </div>
          </div>

          {/* Question box */}
          <div className="w-full px-[30px]">
            <div className="flex flex-col gap-5 rounded-[20px] bg-gray-20 p-5 text-gray-100">
              <p className="text-[16px] font-bold leading-[24px]">
                {t("portfolio.disableAutoMaxQuestion")}
              </p>
              <div className="flex flex-col gap-2.5 body-14-medium">
                <p>{t("portfolio.disableAutoMaxBody1", { dDay })}</p>
                <p>{t("portfolio.disableAutoMaxBody2")}</p>
              </div>
            </div>
          </div>

          {/* Withdrawal date notice */}
          <div className="w-full px-[30px]">
            <div className="flex items-center gap-2.5 rounded-[10px] border border-gray-30 p-2.5 text-gray-100 whitespace-nowrap">
              <span className="text-[16px] font-semibold leading-[24px]">
                {t("portfolio.withdrawalAvailableFrom")}:
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[20px] font-bold leading-[30px]">
                  {formatWithdrawalDate(lockData.lockEnd)}
                </span>
                <span className="text-[16px] font-medium leading-[24px]">
                  ({formatYearsRemaining(remainingDays)})
                </span>
              </div>
            </div>
          </div>

          {/* Signing banner */}
          <div className="w-full px-[30px]">
            <DecorativeBanner>
              <p className="body-16-bold whitespace-pre-line text-center text-white">
                {t("portfolio.disableAutoMaxSignPrompt")}
              </p>
            </DecorativeBanner>
          </div>
        </div>

        <div className="flex w-full items-center justify-center gap-5 px-[30px]">
          <Button
            variant="secondary"
            size="lg"
            className="max-w-[295px]"
            onClick={handleCancel}
            disabled={isWorking}
          >
            {t("common.cancel")}
          </Button>
          <Button
            size="lg"
            className="max-w-[295px]"
            onClick={handleConfirm}
            loading={isWorking}
            disabled={isWorking}
          >
            {t("portfolio.disableAutoMaxAction")}
          </Button>
        </div>
      </div>
    );
  }

  // step === "success"
  if (!submittedSnapshot) return null;

  const successDDay = `D-${submittedSnapshot.remainingDays}`;

  return (
    <div className="mx-auto flex w-full max-w-[670px] flex-col items-center gap-10 rounded-[40px] bg-white pb-[30px]">
      <div className="flex w-full flex-col items-center gap-5">
        <StepPageHeader
          title={t("portfolio.disableAutoMaxSuccessTitle")}
          description={t("portfolio.disableAutoMaxSuccessDescription")}
        />

        {/* Base Lock compact summary */}
        <div className="w-full px-[30px]">
          <div className="flex items-center justify-between gap-5 rounded-[20px] bg-gray-20 p-5 whitespace-nowrap">
            <span className="text-[16px] font-semibold leading-[24px] text-gray-100">
              {t("portfolio.baseLock")}
            </span>
            <span className="text-[16px] font-semibold leading-[24px] text-gray-100">
              {lockNoLabel}
            </span>
            <div className="flex items-center gap-1 text-gray-100">
              <span className="text-[16px] font-semibold leading-[24px]">
                {amountLabel}
              </span>
              <span className="body-14-medium">{LOCK_UNIT}</span>
            </div>
          </div>
        </div>

        {/* Status + Time Remaining */}
        <div className="w-full px-[30px]">
          <div className="grid grid-cols-2 gap-5">
            <SummaryField
              label={t("portfolio.status")}
              valueClassName="text-red-30"
              value={t("portfolio.autoMaxLockOff")}
            />
            <SummaryField
              label={t("portfolio.timeRemaining")}
              value={successDDay}
            />
          </div>
        </div>

        {/* Success banner */}
        <div className="w-full px-[30px]">
          <DecorativeBanner>
            <p className="body-16-bold text-center text-white">
              {t("portfolio.disableAutoMaxSuccessBanner")}
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

function SummaryField({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-2.5">
      <p className="text-[16px] font-semibold leading-[24px] text-gray-100">
        {label}
      </p>
      <div className="flex w-full items-center justify-center whitespace-nowrap rounded-[20px] bg-gray-20 px-2.5 py-5 text-center">
        <span
          className={`text-[20px] font-bold leading-[30px] ${valueClassName ?? "text-gray-100"}`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
