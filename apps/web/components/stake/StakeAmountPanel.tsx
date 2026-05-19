"use client";

import { useTranslations } from "next-intl";
import { StakeSlider, TokenOutputCard } from "./StakeSlider";

interface StakeAmountPanelProps {
  percentage: number;
  onPercentageChange: (pct: number) => void;
  token0Symbol: string;
  token0Amount: string;
  token0UsdValue: string;
  token1Symbol: string;
  token1Amount: string;
  token1UsdValue: string;
  aprLabel: string;
  aprValue: string;
  estPoints: string;
  buttonLabel: string;
  buttonDisabled: boolean;
  onStake: () => void;
  /** When true the slider is non-interactive (e.g. already fully staked). */
  readOnly?: boolean;
}

export function StakeAmountPanel({
  percentage,
  onPercentageChange,
  token0Symbol,
  token0Amount,
  token0UsdValue,
  token1Symbol,
  token1Amount,
  token1UsdValue,
  aprLabel,
  aprValue,
  estPoints,
  buttonLabel,
  buttonDisabled,
  onStake,
  readOnly = false,
}: StakeAmountPanelProps) {
  const t = useTranslations();

  return (
    <div className="bg-white rounded-[40px] p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="heading-6 text-neutral-1000">{t("stake.title")}</h2>
        <p className="body-14 text-neutral-700 whitespace-pre-line">
          {t("stake.description")}
        </p>
      </div>

      <div className="h-px bg-neutral-200" />

      {/* Adjust label + APR/Points summary */}
      <div className="flex items-start justify-between">
        <span className="body-14 text-neutral-700">
          {t("stake.dragToAdjust")}
        </span>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-baseline gap-2">
            <span className="body-14 text-neutral-700">{aprLabel}</span>
            <span className="body-14-bold text-neutral-1000">{aprValue}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="body-14 text-neutral-700">~</span>
            <span className="body-16-bold text-neutral-1000">{estPoints}</span>
            <span className="body-14 text-neutral-700">{t("stake.point")}</span>
          </div>
        </div>
      </div>

      {/* Slider */}
      <StakeSlider
        percentage={percentage}
        onPercentageChange={onPercentageChange}
        readOnly={readOnly}
      />

      {/* Token output cards */}
      <div className="grid grid-cols-2 gap-3">
        <TokenOutputCard
          symbol={token0Symbol}
          amount={token0Amount}
          usdValue={token0UsdValue}
        />
        <TokenOutputCard
          symbol={token1Symbol}
          amount={token1Amount}
          usdValue={token1UsdValue}
        />
      </div>

      {/* Reward guide (yellow warning box) */}
      <div className="rounded-2xl border border-orange-100/50 bg-orange-100/5 p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <WarningIcon />
          <span className="body-14-bold text-orange-100">
            {t("stake.stakingRewardGuide")}
          </span>
        </div>
        <ul className="flex flex-col gap-1.5 list-disc pl-5">
          <li className="body-14 text-orange-100">
            {t("stake.guideWhenStaked")}
          </li>
          <li className="body-14 text-orange-100">
            {t("stake.guideWithoutStaking")}
          </li>
        </ul>
        <p className="body-14 text-orange-100">
          {t("stake.guideCallToAction")}
        </p>
      </div>

      {/* Stake button */}
      <button
        type="button"
        onClick={onStake}
        disabled={buttonDisabled}
        className={`w-full py-4 rounded-2xl body-16-bold transition-colors ${
          buttonDisabled
            ? "bg-neutral-200 text-neutral-700 cursor-not-allowed"
            : "bg-primary-100 hover:bg-primary-200 text-neutral-1000"
        }`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function WarningIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 2L1 18h18L10 2zm0 6v4m0 2v1"
        stroke="var(--color-orange-100)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
