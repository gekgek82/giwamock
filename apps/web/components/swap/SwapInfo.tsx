"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GiwaterLogo } from "@/components/common/GiwaterLogo";
import { SlippageSettings } from "./SlippageSettings";
import type { TokenInfo } from "@/hooks/useContractAddresses";

interface RouteFeeInfo {
  route: { from: `0x${string}`; to: `0x${string}` };
  feeDisplay: string;
}

interface SwapInfoProps {
  hasInput: boolean;
  fromAmount: string;
  toAmount: string;
  activeFromToken: TokenInfo | null;
  activeToToken: TokenInfo | null;
  tokens: TokenInfo[];
  exchangeRate: string;
  minimumReceived: string;
  priceImpact: number;
  routeFees: RouteFeeInfo[] | undefined;
  totalFeePercent: number;
  totalFeeDisplay: string;
  /** Preferred avg fee bps from broker `swap-routes` when present. */
  averageFeeBps?: number | null;
  /** Optional override from broker `swap-routes` (preferred when present). */
  totalFeeUsdDisplay?: string;
  isQuoteLoading: boolean;
  highPriceImpactVisible: boolean;
  swapButton: React.ReactNode;
}

function InfoIcon() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center size-4 rounded-full bg-gray-30"
    >
      <svg
        className="size-[8px]"
        viewBox="0 0 8 8"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 1.2V2M4 3.4V7"
          stroke="#475569"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LabelWithTooltip({
  label,
  tooltip,
  textClass = "text-gray-90 body-16-semibold",
}: {
  label: string;
  tooltip?: string;
  textClass?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className={textClass}>{label}</span>
      {tooltip ? (
        <div className="relative group">
          <span className="cursor-help">
            <InfoIcon />
          </span>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-100 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-48 text-center z-10 leading-normal">
            {tooltip}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HighRiskBadge({ size = "md" }: { size?: "sm" | "md" }) {
  const t = useTranslations();
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[20px] bg-red-30 text-gray-10 font-medium whitespace-nowrap ${
        size === "sm" ? "px-1 py-0.5 text-[10px] leading-none" : "px-1.5 py-1 text-xs leading-[18px]"
      }`}
    >
      {t("swap.highRisk")}
    </span>
  );
}

function RouteDisplay({
  routeFees,
  tokens,
  textClass,
  feeBold = false,
}: {
  routeFees: RouteFeeInfo[];
  tokens: TokenInfo[];
  textClass: string;
  feeBold?: boolean;
}) {
  const getTokenSymbol = (address: string) => {
    const token = tokens.find(
      (t) => t.address.toLowerCase() === address.toLowerCase(),
    );
    return token?.symbol || "???";
  };

  return (
    <div className={`flex items-center flex-wrap gap-x-1 gap-y-0.5 justify-end ${textClass}`}>
      {routeFees.map((feeInfo, index) => {
        const fromSymbol = getTokenSymbol(feeInfo.route.from);
        const toSymbol = getTokenSymbol(feeInfo.route.to);
        return (
          <span key={index} className="flex items-center gap-1">
            <span className="text-gray-90">{fromSymbol}</span>
            <span className={feeBold ? "text-gray-90 font-bold" : "text-gray-80"}>
              ({feeInfo.feeDisplay})
            </span>
            <span className="text-gray-90">&gt;</span>
            {index === routeFees.length - 1 && (
              <span className="text-gray-90">{toSymbol}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export function SwapInfo(props: SwapInfoProps) {
  const {
    hasInput,
    fromAmount,
    toAmount,
    activeFromToken,
    activeToToken,
    exchangeRate,
    minimumReceived,
    priceImpact,
    routeFees,
    totalFeePercent,
    totalFeeDisplay,
    averageFeeBps,
    totalFeeUsdDisplay,
    tokens,
    isQuoteLoading,
    highPriceImpactVisible,
    swapButton,
  } = props;
  const t = useTranslations();
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const showRoute =
    hasInput && routeFees && routeFees.length > 0 && fromAmount && toAmount;
  const fromSymbol = activeFromToken?.symbol ?? "---";
  const toSymbol = activeToToken?.symbol ?? "---";

  const hasFromAmount = !!fromAmount && Number.isFinite(parseFloat(fromAmount)) && parseFloat(fromAmount) > 0;

  const totalFeeUsd =
    totalFeeUsdDisplay ??
    (hasFromAmount
      ? `~$${(parseFloat(fromAmount) * totalFeePercent).toFixed(2)}`
      : "~$");
  const avgFeeRate =
    hasFromAmount
      ? averageFeeBps !== null &&
        averageFeeBps !== undefined &&
        Number.isFinite(averageFeeBps)
        ? `~${(averageFeeBps / 100).toFixed(2)}%`
        : `~${totalFeeDisplay}`
      : "~%";
  const exchangeRateText =
    hasInput && fromAmount && toAmount
      ? `1 ${fromSymbol} = ${exchangeRate} ${toSymbol}`
      : "-";
  const priceImpactText =
    hasInput && fromAmount && toAmount ? `${priceImpact.toFixed(3)}%` : "-";

  const isHighRisk = priceImpact >= 3 && hasInput && !!fromAmount && !!toAmount;

  return (
    <>
      {/* ====== Desktop (md+) ====== */}
      <div className="hidden md:flex flex-col gap-[30px] bg-white rounded-[40px] pb-[30px]">
        <div className="flex flex-col gap-3 pt-[30px]">
          <div className="px-[30px]">
            <h2 className="text-gray-100 heading-6">
              {t("swap.checkBeforeSwap")}
            </h2>
          </div>
          <div className="h-px w-full bg-gray-30" />
        </div>

        <div
          className={`flex-1 flex flex-col gap-6 px-[30px] transition-opacity duration-300 ${
            isQuoteLoading ? "opacity-50" : "opacity-100"
          }`}
        >
          {/* Swap Route */}
          <div className="flex items-center justify-between gap-4">
            <LabelWithTooltip
              label={t("swap.swapRoute")}
              tooltip={t("swap.swapRouteTooltip")}
            />
            <div className="text-right">
              {showRoute ? (
                <RouteDisplay
                  routeFees={routeFees!}
                  tokens={tokens}
                  textClass="body-14-medium"
                />
              ) : (
                <span className="text-gray-50 body-16">-</span>
              )}
            </div>
          </div>

          {/* Est. Total Fee */}
          <div className="flex items-center justify-between">
            <LabelWithTooltip
              label={t("swap.estTotalFee")}
              tooltip={t("swap.estTotalFeeTooltip")}
            />
            <div className="flex items-baseline gap-1 text-right">
              <span className="text-gray-90 heading-6">{totalFeeUsd}</span>
              <span className="text-gray-80 body-14-medium">
                {t("swap.estTotalFeeNote")}
              </span>
            </div>
          </div>

          {/* Avg. Fee Rate */}
          <div className="flex items-center justify-between">
            <LabelWithTooltip
              label={t("swap.avgFeeRate")}
              tooltip={t("swap.avgFeeRateTooltip")}
            />
            <div className="flex items-baseline gap-1 text-right">
              <span className="text-gray-90 heading-6">{avgFeeRate}</span>
              <span className="text-gray-80 body-14-medium">
                {t("swap.avgFeeRateNote")}
              </span>
            </div>
          </div>

          {/* Exchange Rate */}
          <div className="flex items-center justify-between">
            <LabelWithTooltip label={t("swap.exchangeRate")} />
            <span className="text-gray-90 heading-6 text-right">
              {exchangeRateText}
            </span>
          </div>

          {/* Price Impact */}
          <div className="flex items-center justify-between">
            <LabelWithTooltip
              label={t("swap.priceImpact")}
              tooltip={t("swap.priceImpactTooltip")}
            />
            <div className="flex items-center gap-2">
              {isHighRisk && <HighRiskBadge />}
              <span
                className={`heading-6 ${
                  isHighRisk ? "text-red-30" : "text-gray-90"
                }`}
              >
                {priceImpactText}
              </span>
            </div>
          </div>

          {/* Minimum Received */}
          <div className="flex items-center justify-between">
            <LabelWithTooltip label={t("swap.minimumReceived")} />
            <div className="flex items-center gap-2">
              <SlippageSettings />
              <div className="flex items-baseline gap-1 text-right">
                {hasInput && fromAmount && toAmount ? (
                  <>
                    <span className="text-gray-90 heading-6">
                      ~ {minimumReceived}
                    </span>
                    <span className="text-gray-80 body-14-medium">
                      {toSymbol}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-90 heading-6">-</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 px-[30px]">
          <p
            className={`body-14-medium text-red-30 ${
              highPriceImpactVisible ? "visible" : "invisible"
            }`}
          >
            {t("swap.highPriceImpactWarning")}
          </p>
          {swapButton}
        </div>
      </div>

      {/* ====== Mobile (<md) ====== */}
      <div className="md:hidden">
        {!hasInput || !fromAmount || !toAmount ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-[30px] bg-white rounded-[20px]">
            <GiwaterLogo width={58} height={52} />
            <p className="text-gray-90 body-16-bold text-center">
              {t("swap.pleaseCheckBeforeSwap")}
            </p>
          </div>
        ) : (
          <div
            className={`bg-white rounded-[20px] px-4 py-2.5 flex flex-col gap-2 transition-opacity duration-300 ${
              isQuoteLoading ? "opacity-50" : "opacity-100"
            }`}
          >
            <div className="flex flex-col gap-3 w-full">
              {/* Swap Route */}
              <div className="flex items-start justify-between gap-2">
                <LabelWithTooltip
                  label={t("swap.swapRoute")}
                  tooltip={t("swap.swapRouteTooltip")}
                  textClass="text-gray-90 body-12"
                />
                <div className="flex-1 flex justify-end">
                  {showRoute ? (
                    <RouteDisplay
                      routeFees={routeFees!}
                      tokens={tokens}
                      textClass="body-12"
                      feeBold
                    />
                  ) : (
                    <span className="text-gray-50 body-12">-</span>
                  )}
                </div>
              </div>

              {/* Exchange Rate */}
              <div className="flex items-center justify-between">
                <LabelWithTooltip
                  label={t("swap.exchangeRate")}
                  textClass="text-gray-90 body-12"
                />
                <span className="text-gray-90 body-12-bold text-right">
                  {exchangeRateText}
                </span>
              </div>

              {/* Price Impact */}
              <div className="flex items-center justify-between">
                <LabelWithTooltip
                  label={t("swap.priceImpact")}
                  tooltip={t("swap.priceImpactTooltip")}
                  textClass="text-gray-90 body-12"
                />
                <div className="flex items-center gap-1">
                  {isHighRisk && <HighRiskBadge size="sm" />}
                  <span
                    className={`body-12-bold ${
                      isHighRisk ? "text-red-30" : "text-gray-90"
                    }`}
                  >
                    {priceImpactText}
                  </span>
                </div>
              </div>

              {/* Minimum Received */}
              <div className="flex items-center justify-between">
                <LabelWithTooltip
                  label={t("swap.minimumReceived")}
                  textClass="text-gray-90 body-12"
                />
                <div className="flex items-center gap-1">
                  <SlippageSettings />
                  <span className="text-gray-90 body-12-bold text-right">
                    {hasInput && fromAmount && toAmount
                      ? `${minimumReceived} ${toSymbol}`
                      : "-"}
                  </span>
                </div>
              </div>

              {mobileExpanded && (
                <>
                  {/* Est. Total Fee */}
                  <div className="flex items-center justify-between">
                    <LabelWithTooltip
                      label={t("swap.estTotalFee")}
                      tooltip={t("swap.estTotalFeeTooltip")}
                      textClass="text-gray-90 body-12"
                    />
                    <div className="flex items-center gap-1 text-right body-12">
                      <span className="text-gray-90 font-bold">
                        {totalFeeUsd}
                      </span>
                      <span className="text-gray-80">
                        {t("swap.estTotalFeeNote")}
                      </span>
                    </div>
                  </div>

                  {/* Avg. Fee Rate */}
                  <div className="flex items-center justify-between">
                    <LabelWithTooltip
                      label={t("swap.avgFeeRate")}
                      tooltip={t("swap.avgFeeRateTooltip")}
                      textClass="text-gray-90 body-12"
                    />
                    <div className="flex items-center gap-1 text-right body-12">
                      <span className="text-gray-90 font-bold">
                        {avgFeeRate}
                      </span>
                      <span className="text-gray-80">
                        {t("swap.avgFeeRateNote")}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileExpanded((v) => !v)}
              className="flex items-center justify-center gap-1 text-gray-100 body-12 font-medium py-1 hover:opacity-80 transition-opacity"
            >
              <span>
                {mobileExpanded ? t("swap.lessDetails") : t("swap.moreDetails")}
              </span>
              <ChevronIcon open={mobileExpanded} />
            </button>
          </div>
        )}

        {highPriceImpactVisible && (
          <p className="mt-2 body-14-medium text-red-30">
            {t("swap.highPriceImpactWarning")}
          </p>
        )}

        <div className="mt-4">{swapButton}</div>
      </div>
    </>
  );
}
