"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { GIWASCAN_URL } from "@/lib/config";
import { GiwaterLogo } from "@/components/common/GiwaterLogo";
import { TokenIcon } from "@/components/common/TokenIcon";
import { SlippageSettings } from "./SlippageSettings";
import type { TokenInfo } from "@/hooks/useContractAddresses";

interface RouteFeeInfo {
  route: { from: `0x${string}`; to: `0x${string}` };
  feeDisplay: string;
}

interface SwapDetails {
  fromToken: TokenInfo | null;
  toToken: TokenInfo | null;
  fromAmount: string;
  toAmount: string;
  exchangeRate: string;
  minimumReceived: string;
  priceImpact: number;
  tokens: TokenInfo[];
  routeFees: RouteFeeInfo[] | undefined;
  totalFeePercent: number;
  totalFeeDisplay: string;
}

// ---------------------------------------------------------------------------
// Internal: shared header / summary / info panel for the mobile swap flow
// ---------------------------------------------------------------------------

function ArrowLeftIcon() {
  return (
    <svg
      width="10"
      height="9"
      viewBox="0 0 10 9"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 4.5H1M1 4.5L4.5 1M1 4.5L4.5 8"
        stroke="#1E293B"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MobileHeader({
  title,
  onCancel,
}: {
  title: string;
  onCancel: () => void;
}) {
  const t = useTranslations();
  return (
    <>
      <div className="flex items-center justify-between p-4">
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("common.cancel")}
          className="size-6 flex items-center justify-center"
        >
          <ArrowLeftIcon />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-90 body-14-bold"
        >
          {t("common.cancel")}
        </button>
      </div>
      <div className="flex flex-col gap-2 items-center w-full">
        <div className="flex gap-2.5 items-center px-4 w-full">
          <p className="flex-1 text-gray-100 body-16-bold">{title}</p>
        </div>
        <div className="h-px w-full bg-gray-30" />
      </div>
    </>
  );
}

function SummaryCard({
  token,
  amount,
  usdValue,
}: {
  token: TokenInfo | null;
  amount: string;
  usdValue?: string;
}) {
  return (
    <div className="bg-gray-20 flex items-center justify-between rounded-[20px] px-5 py-2.5 w-full">
      <div className="flex items-center gap-1 p-1.5">
        {token && (
          <TokenIcon address={token.address} symbol={token.symbol} size={24} />
        )}
        <span className="text-gray-90 body-14-bold">
          {token?.symbol ?? "---"}
        </span>
      </div>
      <div className="flex flex-col items-end text-right">
        <span className="text-gray-90 font-bold leading-[30px] text-[20px]">
          {amount || "0"}
        </span>
        <span className="text-gray-70 body-12 leading-[18px]">
          {usdValue ?? "~$0"}
        </span>
      </div>
    </div>
  );
}

function SummarySwapIcon() {
  return (
    <div className="flex items-center justify-center p-1.5 rounded-full bg-green-10 shadow-[inset_0_-1px_2px_0_rgba(0,0,0,0.1),inset_0_1px_1px_0_rgba(255,255,255,0.6)]">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 6l4 4 4-4"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function InfoIcon() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center size-4 rounded-full bg-gray-20"
    >
      <svg className="size-[8px]" viewBox="0 0 8 8" fill="none">
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

function HighRiskBadge() {
  const t = useTranslations();
  return (
    <span className="inline-flex items-center justify-center rounded-[20px] bg-red-30 text-gray-10 font-medium px-1 py-0.5 text-[10px] leading-none whitespace-nowrap">
      {t("swap.highRisk")}
    </span>
  );
}

function Label({ label, tooltip }: { label: string; tooltip?: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-90 body-12">{label}</span>
      {tooltip ? (
        <span className="cursor-help" title={tooltip}>
          <InfoIcon />
        </span>
      ) : null}
    </div>
  );
}

function MobileInfoPanel({ details }: { details: SwapDetails }) {
  const t = useTranslations();
  const [expanded, setExpanded] = useState(true);
  const {
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    exchangeRate,
    minimumReceived,
    priceImpact,
    tokens,
    routeFees,
    totalFeePercent,
    totalFeeDisplay,
  } = details;

  const fromSymbol = fromToken?.symbol ?? "---";
  const toSymbol = toToken?.symbol ?? "---";
  const hasInput = !!fromAmount && !!toAmount && parseFloat(fromAmount) > 0;
  const showRoute = hasInput && routeFees && routeFees.length > 0;
  const isHighRisk = priceImpact >= 3 && hasInput;

  const totalFeeUsd = hasInput
    ? `~$${(parseFloat(fromAmount) * totalFeePercent).toFixed(2)}`
    : "~$";
  const avgFeeRate = hasInput ? `~${totalFeeDisplay}` : "~%";
  const exchangeRateText = hasInput
    ? `1 ${fromSymbol} = ${exchangeRate} ${toSymbol}`
    : "-";
  const priceImpactText = hasInput ? `${priceImpact.toFixed(3)}%` : "-";

  const getTokenSymbol = (address: string) => {
    const token = tokens.find(
      (tk) => tk.address.toLowerCase() === address.toLowerCase(),
    );
    return token?.symbol || "???";
  };

  return (
    <div className="bg-gray-10 rounded-[20px] px-4 py-2.5 flex flex-col gap-2 w-full">
      <div className="flex flex-col gap-3 w-full">
        <div className="flex items-start justify-between gap-2">
          <Label
            label={t("swap.swapRoute")}
            tooltip={t("swap.swapRouteTooltip")}
          />
          <div className="flex-1 flex justify-end">
            {showRoute ? (
              <div className="flex items-center flex-wrap gap-x-1 gap-y-0.5 justify-end body-12">
                {routeFees!.map((feeInfo, index) => (
                  <span key={index} className="flex items-center gap-1">
                    <span className="text-gray-90">
                      {getTokenSymbol(feeInfo.route.from)}
                    </span>
                    <span className="text-gray-90 font-bold">
                      ({feeInfo.feeDisplay})
                    </span>
                    <span className="text-gray-90">&gt;</span>
                    {index === routeFees!.length - 1 && (
                      <span className="text-gray-90">
                        {getTokenSymbol(feeInfo.route.to)}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-gray-50 body-12">-</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label label={t("swap.exchangeRate")} />
          <span className="text-gray-90 body-12-bold text-right">
            {exchangeRateText}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <Label
            label={t("swap.priceImpact")}
            tooltip={t("swap.priceImpactTooltip")}
          />
          <div className="flex items-center gap-1">
            {isHighRisk && <HighRiskBadge />}
            <span
              className={`body-12-bold ${
                isHighRisk ? "text-red-30" : "text-gray-90"
              }`}
            >
              {priceImpactText}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label label={t("swap.minimumReceived")} />
          <div className="flex items-center gap-1">
            <SlippageSettings />
            <span className="text-gray-90 body-12-bold text-right">
              {hasInput ? `${minimumReceived} ${toSymbol}` : "-"}
            </span>
          </div>
        </div>

        {expanded && (
          <>
            <div className="flex items-center justify-between">
              <Label
                label={t("swap.estTotalFee")}
                tooltip={t("swap.estTotalFeeTooltip")}
              />
              <div className="flex items-center gap-1 text-right body-12">
                <span className="text-gray-90 font-bold">{totalFeeUsd}</span>
                <span className="text-gray-80">
                  {t("swap.estTotalFeeNote")}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label
                label={t("swap.avgFeeRate")}
                tooltip={t("swap.avgFeeRateTooltip")}
              />
              <div className="flex items-center gap-1 text-right body-12">
                <span className="text-gray-90 font-bold">{avgFeeRate}</span>
                <span className="text-gray-80">{t("swap.avgFeeRateNote")}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-center gap-1 text-gray-100 body-12 font-medium py-1 hover:opacity-80 transition-opacity"
      >
        <span>{expanded ? t("swap.lessDetails") : t("swap.moreDetails")}</span>
        <ChevronIcon open={expanded} />
      </button>
    </div>
  );
}

function StateMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 items-center justify-center px-6 py-[30px]">
      <GiwaterLogo width={58} height={52} />
      <div className="text-gray-90 body-16-bold text-center leading-[24px]">
        {children}
      </div>
    </div>
  );
}

function SummarySection({ details }: { details: SwapDetails }) {
  const { fromToken, toToken, fromAmount, toAmount } = details;
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-4 pt-4 pb-2.5 w-full">
      <SummaryCard token={fromToken} amount={fromAmount} />
      <SummarySwapIcon />
      <SummaryCard token={toToken} amount={toAmount} />
    </div>
  );
}

function AlertTriangleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 2.667 1.333 14h13.334L8 2.667Z" />
      <path d="M8 6.667v3" />
      <circle cx="8" cy="11.667" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Public: SwapMobileConfirm — "Check before you swap" confirmation step
// ---------------------------------------------------------------------------

interface SwapMobileConfirmProps {
  details: SwapDetails;
  onCancel: () => void;
  highPriceImpact?: boolean;
}

/**
 * "Check before you swap" confirmation step (Figma 813:12340).
 *
 * Renders header + summary + info panel + state message + optional risk alert.
 * The Cancel/Confirm footer is rendered by `SwapMobileCard` so that the
 * `SwapButton` (and its wagmi hooks) can stay mounted across view transitions.
 */
export function SwapMobileConfirm({
  details,
  onCancel,
  highPriceImpact,
}: SwapMobileConfirmProps) {
  const t = useTranslations();

  return (
    <div className="bg-white rounded-[20px] flex flex-col">
      <MobileHeader title={t("swap.checkBeforeSwap")} onCancel={onCancel} />
      <SummarySection details={details} />
      <div className="px-4">
        <MobileInfoPanel details={details} />
      </div>
      <StateMessage>
        <p>{t("swap.pleaseCheckBeforeSwap")}</p>
      </StateMessage>

      {highPriceImpact && (
        <div
          role="alert"
          className="flex items-center gap-1 text-red-30 px-4 pb-2"
        >
          <AlertTriangleIcon />
          <span className="body-12 font-medium leading-[18px]">
            {t("swap.highPriceImpactWarning")}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public: SwapMobilePending
// ---------------------------------------------------------------------------

interface SwapMobilePendingProps {
  details: SwapDetails;
  onCancel: () => void;
  failed?: boolean;
  onRetry?: () => void;
}

export function SwapMobilePending({
  details,
  onCancel,
  failed,
  onRetry,
}: SwapMobilePendingProps) {
  const t = useTranslations();

  return (
    <div className="bg-white rounded-[20px] flex flex-col">
      <MobileHeader title={t("swap.waitingForApproval")} onCancel={onCancel} />
      <SummarySection details={details} />
      <div className="px-4">
        <MobileInfoPanel details={details} />
      </div>
      <StateMessage>
        <p>{t("swap.assetsBeingTransformed")}</p>
      </StateMessage>

      {failed && (
        <div className="px-4 pb-2">
          <div className="bg-gray-70 rounded-[10px] flex items-center justify-center gap-2.5 px-4 py-2 w-full">
            <div className="flex-1 flex flex-col items-center justify-center gap-1">
              <p className="body-14-medium text-gray-10 text-center">
                {t("swap.transactionFailedRetry")}
              </p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex items-center text-brand-green body-14-bold"
                >
                  <span>{t("swap.retry")}</span>
                  <svg
                    className="size-4 -rotate-90"
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
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 items-start px-4 pt-4 pb-5">
        <div className="flex gap-2.5 items-center w-full">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-70 text-gray-10 body-16-bold rounded-[20px] px-5 py-2.5 hover:bg-gray-80 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled
            className="flex-1 bg-brand-green text-gray-100 body-16-bold rounded-[20px] px-5 py-2.5 h-11 flex items-center justify-center cursor-not-allowed"
            aria-busy="true"
          >
            <svg
              className="animate-spin size-7"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public: SwapMobileCompleted
// ---------------------------------------------------------------------------

interface SwapMobileCompletedProps {
  details: SwapDetails;
  txHash: string;
  onClose: () => void;
}

export function SwapMobileCompleted({
  details,
  txHash,
  onClose,
}: SwapMobileCompletedProps) {
  const t = useTranslations();

  return (
    <div className="bg-white rounded-[20px] flex flex-col">
      <MobileHeader title={t("swap.swapCompleted")} onCancel={onClose} />
      <SummarySection details={details} />
      <div className="px-4">
        <MobileInfoPanel details={details} />
      </div>
      <StateMessage>
        <p>{t("swap.safelySwapped")}</p>
        <p>{t("swap.exchangeFinished")}</p>
        <p>{t("swap.viewRewardPoints")}</p>
      </StateMessage>

      <div className="flex flex-col gap-2 items-start px-4 pt-4 pb-5">
        <div className="flex gap-2.5 items-center w-full">
          <a
            href={`${GIWASCAN_URL}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-gray-70 text-gray-10 body-16-bold rounded-[20px] px-5 py-2.5 text-center hover:bg-gray-80 transition-colors"
          >
            {t("swap.viewConfirmation")}
          </a>
          <Link
            href="/portfolio"
            className="flex-1 bg-brand-green text-gray-100 body-16-bold rounded-[20px] px-5 py-2.5 text-center hover:bg-green-10 transition-colors"
          >
            {t("swap.goPortfolio")}
          </Link>
        </div>
      </div>
    </div>
  );
}
