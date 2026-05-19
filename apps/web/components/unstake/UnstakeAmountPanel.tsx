"use client";

import { useTranslations } from "next-intl";
import { StakeSlider, TokenOutputCard } from "@/components/stake/StakeSlider";

interface UnstakeAmountPanelProps {
  percentage: number;
  onPercentageChange: (pct: number) => void;
  token0Symbol: string;
  token0Amount: string;
  token0UsdValue: string;
  token1Symbol: string;
  token1Amount: string;
  token1UsdValue: string;
  buttonLabel: string;
  buttonDisabled: boolean;
  onUnstake: () => void;
  readOnly?: boolean;
}

export function UnstakeAmountPanel({
  percentage,
  onPercentageChange,
  token0Symbol,
  token0Amount,
  token0UsdValue,
  token1Symbol,
  token1Amount,
  token1UsdValue,
  buttonLabel,
  buttonDisabled,
  onUnstake,
  readOnly = false,
}: UnstakeAmountPanelProps) {
  const t = useTranslations();

  return (
    <div className="bg-white rounded-[40px] p-8 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="heading-6 text-neutral-1000">{t("unstake.title")}</h2>
        <p className="body-14 text-neutral-700 whitespace-pre-line">
          {t("unstake.description")}
        </p>
      </div>

      <div className="h-px bg-neutral-200" />

      <span className="body-14 text-neutral-700">
        {t("unstake.dragToAdjust")}
      </span>

      <StakeSlider
        percentage={percentage}
        onPercentageChange={onPercentageChange}
        readOnly={readOnly}
      />

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

      <button
        type="button"
        onClick={onUnstake}
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
