"use client";

import { useTranslations } from "next-intl";
import { StakeSlider, TokenOutputCard } from "./StakeSlider";

interface StakingConfigDetailsProps {
  percentage: number;
  token0Symbol: string;
  token0Amount: string;
  token0UsdValue: string;
  token1Symbol: string;
  token1Amount: string;
  token1UsdValue: string;
  aprLabel: string;
  aprValue: string;
  estPoints: string;
}

export function StakingConfigDetails({
  percentage,
  token0Symbol,
  token0Amount,
  token0UsdValue,
  token1Symbol,
  token1Amount,
  token1UsdValue,
  aprLabel,
  aprValue,
  estPoints,
}: StakingConfigDetailsProps) {
  const t = useTranslations();

  return (
    <div className="bg-white rounded-[40px] p-8 flex flex-col gap-6">
      <h2 className="heading-6 text-neutral-1000">
        {t("stake.configurationDetails")}
      </h2>

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

      <StakeSlider percentage={percentage} readOnly />

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
    </div>
  );
}
