"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/common/Button";

const TICKS = [0, 25, 50, 75, 100];

interface WithdrawAmountPanelProps {
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
  onWithdraw: () => void;
}

export function WithdrawAmountPanel({
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
  onWithdraw,
}: WithdrawAmountPanelProps) {
  const t = useTranslations();
  // Clamp bubble position so it stays visually aligned with the handle even at extremes.
  const bubbleLeft = `calc(${percentage}% + ${(50 - percentage) * 0.2}px)`;

  return (
    <div className="bg-white rounded-[40px] p-8 flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-[20px] font-bold leading-[30px] text-neutral-1000">
          {t("liquidity.withdrawTitle")}
        </h2>
        <p className="body-14-medium text-neutral-900 whitespace-pre-line">
          {t("liquidity.withdrawDescription")}
        </p>
      </div>

      <div className="h-px bg-neutral-200" />

      {/* Slider Section */}
      <div className="pt-8">
        <div className="relative">
          {/* Percentage Bubble */}
          <div
            className="absolute -top-9 px-2 py-1 rounded-[10px] bg-primary-100 text-neutral-1000 body-14-medium whitespace-nowrap select-none"
            style={{
              left: bubbleLeft,
              transform: "translateX(-50%)",
              transition: "left 0.1s ease-out",
            }}
          >
            {percentage}%
          </div>

          {/* Slider */}
          <input
            type="range"
            min={0}
            max={100}
            value={percentage}
            onChange={(e) => onPercentageChange(parseInt(e.target.value, 10))}
            className="withdraw-slider"
            style={{
              background: `linear-gradient(to right, var(--color-primary-100) 0%, var(--color-primary-100) ${percentage}%, var(--color-neutral-200) ${percentage}%, var(--color-neutral-200) 100%)`,
            }}
          />
        </div>

        {/* Tick Labels */}
        <div className="relative mt-3 h-5">
          {TICKS.map((tick) => (
            <button
              key={tick}
              type="button"
              onClick={() => onPercentageChange(tick)}
              className="absolute body-14-medium text-neutral-1000 hover:text-primary-300 transition-colors -translate-x-1/2"
              style={{ left: `${tick}%` }}
            >
              {tick}%
            </button>
          ))}
        </div>
      </div>

      {/* Token Output Cards */}
      <div className="grid grid-cols-2 gap-5">
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

      <Button size="lg" onClick={onWithdraw} disabled={buttonDisabled}>
        {buttonLabel}
      </Button>
    </div>
  );
}

function TokenOutputCard({
  symbol,
  amount,
  usdValue,
}: {
  symbol: string;
  amount: string;
  usdValue: string;
}) {
  return (
    <div className="bg-neutral-100 rounded-[20px] px-2.5 py-3.5 flex flex-col items-center gap-1">
      <div className="flex items-baseline gap-1">
        <span className="body-16-bold text-neutral-1000">{amount}</span>
        <span className="body-14-medium text-neutral-1000">{symbol}</span>
      </div>
      <span className="body-12 text-neutral-1000">{usdValue}</span>
    </div>
  );
}
