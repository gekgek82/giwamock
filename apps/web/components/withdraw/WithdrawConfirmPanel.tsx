"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/common/Button";
import { DecorativeBanner } from "@/components/common/DecorativeBanner";

export type WithdrawConfirmMode = "confirm" | "success";

interface WithdrawConfirmPanelProps {
  mode: WithdrawConfirmMode;
  percentage: number;
  token0Symbol: string;
  token0Amount: string;
  token0UsdValue: string;
  token1Symbol: string;
  token1Amount: string;
  token1UsdValue: string;
  /** Confirm: edit handler. Success: view-confirmation handler. */
  onSecondary: () => void;
  /** Confirm: submit handler. Success: go-to-portfolio handler. */
  onPrimary: () => void;
  /** Disables both buttons + shows spinner on the primary CTA in confirm mode. */
  isSubmitting?: boolean;
}

export function WithdrawConfirmPanel({
  mode,
  percentage,
  token0Symbol,
  token0Amount,
  token0UsdValue,
  token1Symbol,
  token1Amount,
  token1UsdValue,
  onSecondary,
  onPrimary,
  isSubmitting,
}: WithdrawConfirmPanelProps) {
  const t = useTranslations();
  const isConfirm = mode === "confirm";

  return (
    <div className="bg-white rounded-[40px] p-8 flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-[20px] font-bold leading-[30px] text-neutral-1000">
          {isConfirm
            ? t("liquidity.withdrawConfirmTitle")
            : t("liquidity.withdrawSuccessTitle")}
        </h2>
        <p className="body-14-medium text-neutral-900 whitespace-pre-line">
          {isConfirm
            ? t("liquidity.withdrawConfirmDescription")
            : t("liquidity.withdrawSuccessDescription")}
        </p>
      </div>

      <div className="h-px bg-neutral-200" />

      <div className="bg-neutral-100 rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="body-16-medium text-neutral-1000">
            {t("liquidity.withdrawalAmount")}
          </span>
          <span className="body-16-bold text-neutral-1000">{percentage}%</span>
        </div>
        <SummaryRow
          symbol={token0Symbol}
          amount={token0Amount}
          usdValue={token0UsdValue}
        />
        <SummaryRow
          symbol={token1Symbol}
          amount={token1Amount}
          usdValue={token1UsdValue}
        />
      </div>

      <DecorativeBanner>
        <h3 className="body-16-bold text-white text-center">
          {t("liquidity.assetsSuccessfullyReturnedTitle")}
        </h3>
        <p className="body-14-medium text-white text-center whitespace-pre-line">
          {t("liquidity.assetsSuccessfullyReturnedBody")}
        </p>
      </DecorativeBanner>

      <div className="grid grid-cols-2 gap-5">
        <Button
          variant="secondary"
          size="lg"
          onClick={onSecondary}
          disabled={isSubmitting}
        >
          {isConfirm ? t("common.edit") : t("liquidity.viewConfirmation")}
        </Button>
        <Button
          size="lg"
          onClick={onPrimary}
          loading={isConfirm && isSubmitting}
          disabled={isSubmitting}
        >
          {isConfirm ? t("common.confirm") : t("portfolio.goPortfolio")}
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({
  symbol,
  amount,
  usdValue,
}: {
  symbol: string;
  amount: string;
  usdValue: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-baseline gap-1">
        <span className="body-16-medium text-neutral-1000">{symbol}</span>
        <span className="body-14 text-neutral-1000">{usdValue}</span>
      </div>
      <div className="flex items-baseline gap-1 text-right">
        <span className="body-16-bold text-neutral-1000">{amount}</span>
        <span className="body-14-medium text-neutral-1000">{symbol}</span>
      </div>
    </div>
  );
}

