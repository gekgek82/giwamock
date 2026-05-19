"use client";

import { useTranslations } from "next-intl";
import { StakeSlider, TokenOutputCard } from "@/components/stake/StakeSlider";

interface UnstakingConfigDetailsProps {
  percentage: number;
  token0Symbol: string;
  token0Amount: string;
  token0UsdValue: string;
  token1Symbol: string;
  token1Amount: string;
  token1UsdValue: string;
}

export function UnstakingConfigDetails({
  percentage,
  token0Symbol,
  token0Amount,
  token0UsdValue,
  token1Symbol,
  token1Amount,
  token1UsdValue,
}: UnstakingConfigDetailsProps) {
  const t = useTranslations();

  return (
    <div className="bg-white rounded-[40px] p-8 flex flex-col gap-6">
      <h2 className="heading-6 text-neutral-1000">
        {t("unstake.configurationDetails")}
      </h2>

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
