"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/common/Button";
import { DecorativeBanner } from "@/components/common/DecorativeBanner";

interface ButtonConfig {
  text: ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

interface ValueUnit {
  value: string;
  unit: string;
}

interface LockStepLayoutProps {
  title: string;
  description: ReactNode;
  amount: ValueUnit;
  duration: ValueUnit;
  votingPower: ValueUnit;
  heroText: string;
  leftButton: ButtonConfig;
  rightButton: ButtonConfig;
}

export function LockStepLayout({
  title,
  description,
  amount,
  duration,
  votingPower,
  heroText,
  leftButton,
  rightButton,
}: LockStepLayoutProps) {
  const t = useTranslations();

  return (
    <div className="mx-auto flex w-full max-w-[670px] flex-col bg-white rounded-[40px]">
      {/* Header */}
      <div className="flex flex-col gap-3 pt-[30px]">
        <div className="flex flex-col gap-2.5 px-[30px]">
          <h1 className="text-[20px] font-bold leading-[30px] text-gray-100">
            {title}
          </h1>
          <div className="body-14-medium text-gray-90">{description}</div>
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

      {/* Lock Summary */}
      <div className="px-[30px] pt-5">
        <div className="flex flex-col gap-5 rounded-[20px] bg-gray-20 p-5 text-gray-100">
          <SummaryRow label={t("vote.lockAmount")} item={amount} />
          <SummaryRow label={t("vote.lockDuration")} item={duration} />
          <SummaryRow label={t("vote.estVotingPower")} item={votingPower} />
        </div>
      </div>

      {/* Hero Banner */}
      <div className="px-[30px] pt-5">
        <DecorativeBanner>
          <h3 className="body-16-bold text-white">{heroText}</h3>
        </DecorativeBanner>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-5 px-[30px] pb-[30px] pt-10">
        <Button
          variant="secondary"
          size="lg"
          className="max-w-[295px] bg-gray-100 hover:bg-gray-90"
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

function SummaryRow({ label, item }: { label: string; item: ValueUnit }) {
  return (
    <div className="flex w-full items-center justify-between">
      <p className="body-16-semibold flex-1 min-w-0">{label}</p>
      <div className="flex items-baseline gap-1 whitespace-nowrap text-right">
        <span className="text-[20px] font-bold leading-[30px]">
          {item.value}
        </span>
        <span className="text-[16px] font-normal leading-6">{item.unit}</span>
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

