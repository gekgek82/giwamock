"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { parseUnits, formatUnits } from "viem";
import { SitePageShell } from "@/components/pages/_lib/SitePageShell";
import { TokenIcon } from "@/components/common/TokenIcon";
import { PriceRangeSelector } from "@/components/deposit/PriceRangeSelector";
import { InitialPriceSelector } from "@/components/deposit/InitialPriceSelector";
import { ApprovalModal } from "@/components/pool/ApprovalModal";
import { DepositGradeWarningModal } from "@/components/deposit/DepositGradeWarningModal";
import type { LiquidityLockOption } from "@/components/deposit/LiquidityLockSettings";
import { formatUSD, formatAPR } from "@/hooks/useIndexerStats";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { GIWASCAN_URL } from "@/lib/config";
import { useConcentratedPoolDeposit } from "./useConcentratedPoolDeposit";

/* ────────────────────────────────────────────────────────────────────────── */
/* Inline icons                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function ChevronDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="4 6 8 10 12 6" />
    </svg>
  );
}

function ChevronUpIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="4 10 8 6 12 10" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      className="w-3 h-3 text-gray-100"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M2.5 10.5V3.5A1 1 0 0 1 3.5 2.5H10.5" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg
      className="w-4 h-4 shrink-0 text-red-30"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 1.33L1.33 13.33h13.34L8 1.33z" />
      <line x1="8" y1="6" x2="8" y2="9" />
      <line x1="8" y1="11.33" x2="8.01" y2="11.33" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      className="w-6 h-6 text-gray-100"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function PlusBadge() {
  return (
    <div
      aria-hidden="true"
      className="bg-green-10 rounded-full p-2.5 w-7 h-7 flex items-center justify-center shadow-[inset_0_-1px_2px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.6)]"
    >
      <svg
        className="w-3.5 h-3.5"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 5v14M5 12h14"
          stroke="white"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

const PRESET_SLIPPAGES = [0.5, 1, 3, 5];
const AUTO_SLIPPAGE_VALUE = 0.5;

function formatGatewayUsd(amount: number | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "-";
  if (amount <= 0) return "$0.00";
  return formatUSD(String(amount));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Sub-components                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

function StatColumn({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 items-center min-w-0 flex-1">
      <span className="body-12-bold text-gray-100 text-center w-full break-keep">
        {label}
      </span>
      <span aria-hidden="true" className="block w-full h-px bg-gray-30" />
      <span className="body-14-medium text-gray-100 text-center w-full truncate">
        {value}
      </span>
    </div>
  );
}

function AddressColumn({
  poolAddress,
  gaugeAddress,
}: {
  poolAddress: string;
  gaugeAddress?: string | null;
}) {
  const t = useTranslations();
  const handleCopy = (text: string | null | undefined) => {
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(t("common.copied")))
      .catch(() => toast.error(t("common.copyFailed")));
  };

  const renderRow = (label: string, address: string | null | undefined) => (
    <div className="flex gap-1 items-center justify-center w-full">
      <span className="body-14-medium text-gray-100 text-center w-12">
        {label}
      </span>
      {address ? (
        <button
          type="button"
          onClick={() => handleCopy(address)}
          className="bg-gray-30 rounded-[5px] p-0.5 flex items-center justify-center shrink-0 hover:bg-gray-40 transition-colors"
          aria-label={`Copy ${label}`}
        >
          <CopyIcon />
        </button>
      ) : (
        <span aria-hidden="true" className="text-gray-50 body-12">
          —
        </span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5 items-center min-w-0 flex-1 self-stretch">
      <span className="body-12-bold text-gray-100 text-center w-full">
        {t("pool.address")}
      </span>
      <span aria-hidden="true" className="block w-full h-px bg-gray-30" />
      <div className="flex flex-col gap-1.5 items-start w-full px-2">
        {renderRow(t("pool.pool"), poolAddress)}
        {renderRow(t("pool.gauge"), gaugeAddress ?? null)}
      </div>
    </div>
  );
}

interface PairInfo {
  token0: { symbol: string };
  token1: { symbol: string };
  address: string;
}

interface PairInfoCollapsibleProps {
  pool: PairInfo;
  isStableLabel: string;
  feeLabel: string;
  tvl: string;
  volume: string;
  fees: string;
  pointDistPct: string;
  swapApr: string;
}

/**
 * Pair info card that can collapse to a single header strip (matches the
 * Figma `Pairinfo` component — collapsed = header strip only with chevron-down,
 * expanded = header strip + 2x3 stat grid).
 */
function PairInfoCollapsible({
  pool,
  isStableLabel,
  feeLabel,
  tvl,
  volume,
  fees,
  pointDistPct,
  swapApr,
}: PairInfoCollapsibleProps) {
  const t = useTranslations();
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="bg-white rounded-[20px] p-4 flex flex-col items-center justify-center gap-3.5">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        className="bg-gray-20 rounded-[10px] p-2.5 flex items-center justify-between gap-2 w-full transition-colors hover:bg-gray-30"
      >
        <span className="body-14-bold text-gray-100 truncate min-w-0">
          {pool.token0.symbol} - {pool.token1.symbol}
        </span>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex gap-1 items-center body-12 font-medium text-gray-100 whitespace-nowrap">
            <span>{t("pool.concentrated")}</span>
            <span>{isStableLabel}</span>
            <span>{feeLabel}</span>
          </div>
          {expanded ? (
            <ChevronUpIcon className="w-4 h-4 text-gray-100" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-100" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3.5 w-full">
          <div className="flex items-start gap-2">
            <StatColumn label={t("pool.tvl")} value={tvl} />
            <StatColumn label={t("pool.volume24h")} value={volume} />
            <StatColumn label={t("pool.accumulatedFees")} value={fees} />
          </div>
          <div className="flex items-start gap-2">
            <StatColumn
              label={t("pool.pointDistPercent")}
              value={pointDistPct}
            />
            <StatColumn label={t("pool.swapFeeAPR")} value={swapApr} />
            <AddressColumn poolAddress={pool.address} gaugeAddress={null} />
          </div>
        </div>
      )}
    </section>
  );
}

function NumberRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between w-full">
      <span className="body-12-medium text-gray-100">{label}</span>
      <span className="body-12-bold text-gray-100 text-right">{value}</span>
    </div>
  );
}

interface AmountRowProps {
  side: 0 | 1;
  tokenSymbol: string;
  tokenAddress: string;
  tokenDecimals: number;
  balance?: string;
  amount: string;
  usdValue: number;
  onAmountChange: (value: string) => void;
  isExceeding?: boolean;
  disabled?: boolean;
}

/**
 * Mobile token amount input. Mirrors the Basic-pool variant — header row
 * (label + balance + 50/100% quick-fills) over a gray-20 input pill, with
 * insufficient-balance and disabled (range-locked) visuals.
 */
function AmountRow({
  side,
  tokenSymbol,
  tokenAddress,
  tokenDecimals,
  balance,
  amount,
  usdValue,
  onAmountChange,
  isExceeding = false,
  disabled = false,
}: AmountRowProps) {
  const t = useTranslations();

  const balanceLabel = useMemo(() => {
    if (!balance) return `0 ${tokenSymbol}`;
    const num = parseFloat(balance);
    if (!Number.isFinite(num)) return `0 ${tokenSymbol}`;
    return `${num.toFixed(num >= 1 ? 2 : 6)} ${tokenSymbol}`;
  }, [balance, tokenSymbol]);

  const handlePercent = (percent: number) => {
    if (!balance || disabled) return;
    try {
      const balRaw = parseUnits(balance, tokenDecimals);
      const portion = (balRaw * BigInt(percent)) / BigInt(100);
      onAmountChange(formatUnits(portion, tokenDecimals));
    } catch {
      /* ignore */
    }
  };

  const usdLabel = usdValue > 0 ? `~${formatUSD(String(usdValue))}` : "—";

  return (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="flex items-center justify-between gap-2">
        <span className="body-16-semibold text-gray-100">
          {side === 0 ? t("deposit.token1") : t("deposit.token2")}
        </span>
        <div className="flex items-center gap-2.5">
          <span className="body-14-medium text-gray-100 whitespace-nowrap">
            {balanceLabel}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePercent(50)}
              disabled={disabled}
              className="bg-gray-30 hover:bg-gray-40 rounded-[10px] px-2 py-1 body-14-medium text-gray-100 transition-colors disabled:opacity-50"
            >
              50%
            </button>
            <button
              type="button"
              onClick={() => handlePercent(100)}
              disabled={disabled}
              className="bg-gray-30 hover:bg-gray-40 rounded-[10px] px-2 py-1 body-14-medium text-gray-100 transition-colors disabled:opacity-50"
            >
              100%
            </button>
          </div>
        </div>
      </div>
      <div
        className={`rounded-[20px] px-5 py-2.5 flex items-center justify-between gap-2 ${
          isExceeding
            ? "bg-red-10 border border-red-30"
            : disabled
              ? "bg-gray-20 opacity-60"
              : "bg-gray-20"
        }`}
      >
        <div className="bg-white rounded-full p-1.5 flex gap-1.5 items-center shrink-0">
          <div className="flex gap-1 items-center">
            <TokenIcon address={tokenAddress} symbol={tokenSymbol} size={24} />
            <span className="body-14-bold text-gray-100">{tokenSymbol}</span>
          </div>
          <ChevronDownIcon />
        </div>
        <div className="flex flex-col items-end min-w-0 flex-1">
          <input
            type="text"
            inputMode="decimal"
            value={disabled ? "0" : amount}
            disabled={disabled}
            onChange={(e) => {
              const raw = e.target.value.replace(/,/g, ".");
              if (raw === "" || /^\d*\.?\d*$/.test(raw)) onAmountChange(raw);
            }}
            placeholder="0"
            className={`w-full bg-transparent text-right outline-none heading-bold-20 placeholder:text-gray-100 disabled:cursor-not-allowed ${
              isExceeding ? "text-red-40" : "text-gray-100"
            }`}
          />
          <span
            className={`body-12-medium whitespace-nowrap ${
              isExceeding ? "text-red-40" : "text-gray-70"
            }`}
          >
            {usdLabel}
          </span>
        </div>
      </div>
      {isExceeding && (
        <div className="flex items-center gap-1 text-red-40 body-12-medium px-1">
          <AlertTriangleIcon />
          <span>{t("errors.insufficientBalance")}</span>
        </div>
      )}
    </div>
  );
}

function LiquidityLockSegmented({
  value,
  onChange,
}: {
  value: LiquidityLockOption;
  onChange: (value: LiquidityLockOption) => void;
}) {
  const t = useTranslations();
  const options: { key: LiquidityLockOption; label: string }[] = [
    { key: "permanent", label: t("deposit.lockPermanent") },
    { key: "6month", label: t("deposit.lock6Month") },
    { key: "none", label: t("deposit.lockNone") },
  ];
  return (
    <section className="flex flex-col gap-2">
      <h3 className="body-14-bold text-gray-100">
        {t("deposit.liquidityLockTitle")}
      </h3>
      <p className="body-12-medium text-gray-70 leading-[18px] whitespace-pre-line">
        {t("deposit.liquidityLockDescription")}
      </p>
      <div
        role="radiogroup"
        aria-label={t("deposit.liquidityLockTitle")}
        className="grid grid-cols-3 gap-1 bg-gray-20 rounded-[10px] p-1"
      >
        {options.map((option) => {
          const selected = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.key)}
              className={`px-1 py-2 rounded-[8px] body-12-medium text-center transition-colors ${
                selected
                  ? "bg-gray-100 text-white"
                  : "text-gray-100 hover:bg-gray-30"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface CLDepositSuccessSummary {
  token0: { symbol: string; address: string };
  token1: { symbol: string; address: string };
  amount0: string;
  amount1: string;
  usd0: number;
  usd1: number;
  totalUsd: number;
  ratio0Pct: number;
  ratio1Pct: number;
  txHash?: `0x${string}`;
}

function SummaryTokenRow({
  tokenSymbol,
  tokenAddress,
  amount,
  usdValue,
}: {
  tokenSymbol: string;
  tokenAddress: string;
  amount: string;
  usdValue: number;
}) {
  const amountLabel = useMemo(() => {
    const n = parseFloat(amount || "0");
    if (!Number.isFinite(n) || n === 0) return "0";
    return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }, [amount]);
  const usdLabel = usdValue > 0 ? `~${formatUSD(String(usdValue))}` : "—";
  return (
    <div className="bg-gray-20 rounded-[20px] px-4 py-2.5 flex items-center justify-between gap-2 w-full">
      <div className="bg-white rounded-full px-2.5 py-1.5 flex items-center gap-1 shrink-0">
        <TokenIcon address={tokenAddress} symbol={tokenSymbol} size={24} />
        <span className="body-14-bold text-gray-100">{tokenSymbol}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="body-16-bold text-gray-100">{amountLabel}</span>
        <span className="body-12-medium text-gray-100">{usdLabel}</span>
      </div>
    </div>
  );
}

function DepositSuccessView({
  summary,
  onDismiss,
}: {
  summary: CLDepositSuccessSummary;
  onDismiss: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();

  const totalDepositLabel =
    summary.totalUsd > 0 ? `$${summary.totalUsd.toFixed(2)}` : "$0.00";
  const ratioLabel =
    summary.totalUsd > 0
      ? `${summary.ratio0Pct.toFixed(1)}% / ${summary.ratio1Pct.toFixed(1)}%`
      : "—";

  const handleViewConfirmation = () => {
    if (summary.txHash) {
      window.open(
        `${GIWASCAN_URL}/tx/${summary.txHash}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    onDismiss();
  };

  const handleGoPortfolio = () => {
    router.push("/portfolio");
  };

  return (
    <SitePageShell showHeader={false} showFooter={false} className="bg-white">
      <header className="px-4 py-4 flex items-center">
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Back"
          className="w-6 h-6 flex items-center justify-center"
        >
          <ArrowLeftIcon />
        </button>
      </header>
      <div className="px-4 flex flex-col gap-2">
        <h1 className="body-16-bold text-gray-100">
          {t("deposit.completedSuccessfully")}
        </h1>
        <span aria-hidden="true" className="block w-full h-px bg-gray-30" />
      </div>
      <main className="flex-1 px-4 pt-5 pb-2 flex flex-col gap-2.5">
        <div className="flex flex-col items-center gap-1.5">
          <SummaryTokenRow
            tokenSymbol={summary.token0.symbol}
            tokenAddress={summary.token0.address}
            amount={summary.amount0}
            usdValue={summary.usd0}
          />
          <PlusBadge />
          <SummaryTokenRow
            tokenSymbol={summary.token1.symbol}
            tokenAddress={summary.token1.address}
            amount={summary.amount1}
            usdValue={summary.usd1}
          />
        </div>
        <section className="bg-gray-20 rounded-[20px] px-3 py-2 flex flex-col gap-2.5">
          <NumberRow
            label={t("deposit.totalDeposit")}
            value={totalDepositLabel}
          />
          <NumberRow label={t("deposit.depositRatio")} value={ratioLabel} />
        </section>
        <div className="flex flex-col items-center gap-4 px-6 py-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/giwater-glyph.png"
            alt=""
            width={52}
            height={52}
            className="object-contain"
          />
          <div className="text-center body-16-bold text-gray-100 leading-6">
            <p>{t("deposit.successMessageLine1")}</p>
            <p>{t("deposit.successMessageLine2")}</p>
          </div>
        </div>
      </main>
      <div className="bg-white pt-4 pb-5 px-4 flex gap-2.5">
        <button
          type="button"
          onClick={handleViewConfirmation}
          className="flex-1 px-5 py-2.5 rounded-[20px] bg-gray-70 hover:bg-gray-80 text-white body-16-bold transition-colors min-h-[44px]"
        >
          {t("deposit.viewConfirmation")}
        </button>
        <button
          type="button"
          onClick={handleGoPortfolio}
          className="flex-1 px-5 py-2.5 rounded-[20px] bg-brand-green hover:bg-primary-200 text-gray-100 body-16-bold transition-colors min-h-[44px]"
        >
          {t("deposit.goPortfolio")}
        </button>
      </div>
    </SitePageShell>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Main view                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export function ConcentratedPoolDepositMobileView() {
  const t = useTranslations();
  const d = useConcentratedPoolDeposit();

  const symbols = [
    d.selectedPool?.token0.symbol ?? "",
    d.selectedPool?.token1.symbol ?? "",
  ].filter(Boolean);
  const { prices } = useTokenPrices(symbols);

  // Two-step flow: 0 = "Set Price Range" (Figma node 934:20942),
  // 1 = "Add Amounts" (BasicPool-style amount form). Reset to 0 every time we
  // dismiss the success view so the next deposit starts at the price step.
  const [step, setStep] = useState<0 | 1>(0);

  // Slippage modal mirror of `BasicPoolDepositMobileView`.
  const [isSlippageModalOpen, setIsSlippageModalOpen] = useState(false);
  const [customSlippageInput, setCustomSlippageInput] = useState("");
  const [autoSlippage, setAutoSlippage] = useState(true);
  const [activeSlippage, setActiveSlippage] = useState(AUTO_SLIPPAGE_VALUE);

  const isCustomSlippage = useMemo(() => {
    if (autoSlippage) return false;
    return (
      customSlippageInput !== "" || !PRESET_SLIPPAGES.includes(activeSlippage)
    );
  }, [customSlippageInput, activeSlippage, autoSlippage]);

  const handleAutoSlippageClick = () => {
    setAutoSlippage(true);
    setActiveSlippage(AUTO_SLIPPAGE_VALUE);
    setCustomSlippageInput("");
  };
  const handlePresetSlippageClick = (value: number) => {
    setAutoSlippage(false);
    setActiveSlippage(value);
    setCustomSlippageInput("");
  };
  const handleCustomSlippageChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setCustomSlippageInput(value);
      setAutoSlippage(false);
      const parsed = parseFloat(value);
      if (!Number.isNaN(parsed)) setActiveSlippage(parsed);
    }
  };

  // Loading
  if (
    !d.selectedPool ||
    d.isCLPoolLoading ||
    (d.clPoolAddress && d.isSlot0Loading && d.sqrtPriceX96 === null)
  ) {
    return (
      <SitePageShell className="bg-brand-bg" showFooter={false}>
        <main className="flex-1 flex items-center justify-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green" />
          <span className="ml-3 body-14 text-gray-70">
            {t("common.loading")}
          </span>
        </main>
      </SitePageShell>
    );
  }

  const pool = d.selectedPool;

  // Success view takeover (post-mint snapshot).
  if (d.lastDeposit) {
    const snapUsd0 =
      (parseFloat(d.lastDeposit.amount0 || "0") || 0) *
      (prices[pool.token0.symbol] ?? 0);
    const snapUsd1 =
      (parseFloat(d.lastDeposit.amount1 || "0") || 0) *
      (prices[pool.token1.symbol] ?? 0);
    const snapTotal = snapUsd0 + snapUsd1;
    return (
      <DepositSuccessView
        summary={{
          token0: {
            symbol: pool.token0.symbol,
            address: pool.token0.address,
          },
          token1: {
            symbol: pool.token1.symbol,
            address: pool.token1.address,
          },
          amount0: d.lastDeposit.amount0,
          amount1: d.lastDeposit.amount1,
          usd0: snapUsd0,
          usd1: snapUsd1,
          totalUsd: snapTotal,
          ratio0Pct: snapTotal > 0 ? (snapUsd0 / snapTotal) * 100 : 0,
          ratio1Pct: snapTotal > 0 ? (snapUsd1 / snapTotal) * 100 : 0,
          txHash: d.lastDeposit.txHash,
        }}
        onDismiss={() => {
          d.dismissLastDeposit();
          setStep(0);
        }}
      />
    );
  }

  // Pool needs an initial price first.
  if (d.isPoolUninitialized && d.userInitialSqrtPriceX96 === null) {
    return (
      <SitePageShell className="bg-brand-bg" showFooter={false}>
        <main className="flex-1 px-4 pt-2 pb-6 flex flex-col gap-2.5">
          <InitialPriceSelector
            token0Symbol={pool.token0.symbol}
            token1Symbol={pool.token1.symbol}
            token0Decimals={pool.token0.decimals}
            token1Decimals={pool.token1.decimals}
            onContinue={d.handleInitialPriceConfirm}
            onChangePool={d.handleChangePool}
          />
        </main>
      </SitePageShell>
    );
  }

  const gateway = undefined; // CL pool stats are delivered via `clPoolStatsData`
  const tvlDisplay = formatGatewayUsd(gateway);
  const volumeDisplay = formatGatewayUsd(gateway);
  const feesDisplay = formatGatewayUsd(gateway);
  const swapAprDisplay = formatAPR("0");
  const pointDistDisplay = "-";
  const feeDisplay = `${(d.tickSpacing ?? 0) > 0 ? (d.tickSpacing! / 10000 * 100).toFixed(4) : "0.00"}%`;
  const stableLabel = t("pool.volatile"); // CL pools shown here are volatile

  const usd0 =
    (parseFloat(d.amount0 || "0") || 0) * (prices[pool.token0.symbol] ?? 0);
  const usd1 =
    (parseFloat(d.amount1 || "0") || 0) * (prices[pool.token1.symbol] ?? 0);
  const totalUsd = usd0 + usd1;
  const totalDepositLabel =
    totalUsd > 0 ? `$${totalUsd.toFixed(2)}` : "$0.00";
  const depositRatioLabel =
    totalUsd > 0
      ? `${(d.depositRatio.ratio0 * 100).toFixed(1)}% / ${(d.depositRatio.ratio1 * 100).toFixed(1)}%`
      : "—";

  const isExceeding0 =
    !!d.balance0 &&
    !!d.amount0 &&
    parseFloat(d.amount0) > parseFloat(d.balance0);
  const isExceeding1 =
    !!d.balance1 &&
    !!d.amount1 &&
    parseFloat(d.amount1) > parseFloat(d.balance1);

  // Step-1 "Next" is enabled only when a usable range is set.
  const rangeReady = d.tickRange.tickLower < d.tickRange.tickUpper;

  return (
    <SitePageShell className="bg-brand-bg" showFooter={false}>
      <main className="flex-1 flex flex-col gap-2 px-4 pt-2 pb-2">
        {/* Pair info — same component on both steps; users can collapse it on
            the price step to free up screen real estate for the chart. */}
        <PairInfoCollapsible
          pool={pool}
          isStableLabel={stableLabel}
          feeLabel={feeDisplay}
          tvl={tvlDisplay}
          volume={volumeDisplay}
          fees={feesDisplay}
          pointDistPct={pointDistDisplay}
          swapApr={swapAprDisplay}
        />

        {step === 0 ? (
          /* Step 1: Set Price Range. Re-uses the desktop `PriceRangeSelector`
              chart + handles + low/high inputs — it's already self-contained
              and width-fluid, so it fits a 390px viewport without changes. */
          <section className="bg-white rounded-[20px] flex flex-col gap-2.5 pb-4">
            <PriceRangeSelector
              token0Symbol={pool.token0.symbol}
              token1Symbol={pool.token1.symbol}
              token0Decimals={pool.token0.decimals}
              token1Decimals={pool.token1.decimals}
              tickSpacing={pool.tickSpacing ?? 50}
              currentTick={d.effectiveTick}
              poolAddress={pool.address}
              onRangeChange={d.handleRangeChange}
              defaultFullRange={d.isPoolImbalanced}
            />
          </section>
        ) : (
          /* Step 2: amount inputs + summary + lock — same shape as the
              Basic-pool mobile flow, plus the Numbers section pulls the
              `Deposit Ratio` from the tick range instead of the USD split. */
          <section className="bg-white rounded-[20px] py-4 flex flex-col gap-2.5">
            <div className="px-4 flex flex-col items-center gap-2.5">
              <AmountRow
                side={0}
                tokenSymbol={pool.token0.symbol}
                tokenAddress={pool.token0.address}
                tokenDecimals={pool.token0.decimals}
                balance={d.balance0}
                amount={d.amount0}
                usdValue={usd0}
                onAmountChange={d.handleAmount0Change}
                isExceeding={isExceeding0}
                disabled={d.disableToken0}
              />
              <PlusBadge />
              <AmountRow
                side={1}
                tokenSymbol={pool.token1.symbol}
                tokenAddress={pool.token1.address}
                tokenDecimals={pool.token1.decimals}
                balance={d.balance1}
                amount={d.amount1}
                usdValue={usd1}
                onAmountChange={d.handleAmount1Change}
                isExceeding={isExceeding1}
                disabled={d.disableToken1}
              />
            </div>

            <div className="px-4 flex flex-col gap-2.5">
              <NumberRow
                label={t("deposit.totalDeposit")}
                value={totalDepositLabel}
              />
              <NumberRow
                label={t("deposit.depositRatio")}
                value={depositRatioLabel}
              />
              <div className="flex items-center justify-between w-full">
                <span className="body-12-medium text-gray-100">
                  {t("swap.slippage")}
                </span>
                <button
                  type="button"
                  onClick={() => setIsSlippageModalOpen(true)}
                  className="bg-gray-30 hover:bg-gray-40 rounded-[10px] px-2 py-1 flex items-center gap-1 transition-colors"
                >
                  <span className="body-12-medium text-gray-100">
                    {autoSlippage ? t("deposit.auto") : `${activeSlippage}%`}
                  </span>
                  <ChevronDownIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-4">
              <LiquidityLockSegmented
                value={d.lockOption}
                onChange={d.setLockOption}
              />
            </div>
          </section>
        )}
      </main>

      {/* Sticky bottom CTA — buttons differ per step (Back/Next vs
          Back/Deposit). On step 1 we've not minted yet so dismissing
          back navigates to /liquidity; on step 2 it just steps back. */}
      <div className="sticky bottom-0 z-10 bg-brand-bg/95 backdrop-blur-sm pt-4 pb-5 px-4 flex flex-col gap-2">
        {step === 0 ? (
          <div className="flex gap-2.5 items-center w-full">
            <button
              type="button"
              onClick={d.handleChangePool}
              className="flex-1 px-5 py-2.5 rounded-[20px] bg-gray-70 hover:bg-gray-80 text-white body-16-bold transition-colors min-h-[44px]"
            >
              {t("common.back")}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={!rangeReady}
              className="flex-1 px-5 py-2.5 rounded-[20px] bg-green-10 hover:bg-brand-green text-green-30 body-16-bold transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("common.next")}
            </button>
          </div>
        ) : (
          <div className="flex gap-2.5 items-center w-full">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="flex-1 px-5 py-2.5 rounded-[20px] bg-gray-70 hover:bg-gray-80 text-white body-16-bold transition-colors min-h-[44px]"
            >
              {t("common.back")}
            </button>
            <button
              type="button"
              onClick={d.handleDepositClick}
              disabled={d.buttonState.disabled}
              className="flex-1 px-5 py-2.5 rounded-[20px] bg-brand-green hover:bg-primary-200 text-gray-100 body-16-bold transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {d.buttonState.text}
            </button>
          </div>
        )}
      </div>

      <ApprovalModal
        isOpen={d.isApprovalModalOpen}
        onClose={() => d.setIsApprovalModalOpen(false)}
        steps={d.approvalStepsWithStatus}
        onApprove={d.handleApprove}
        onAddLiquidity={d.handleMintPosition}
        isAddingLiquidity={d.isMinting || d.isConfirming || d.isMockSubmitting}
      />

      <DepositGradeWarningModal
        grade={d.poolGrade}
        isOpen={d.isGradeWarningOpen}
        onConfirm={d.handleGradeWarningConfirm}
        onCancel={() => d.setIsGradeWarningOpen(false)}
      />

      {/* Slippage modal — same options/labels as the Basic mobile flow. */}
      {isSlippageModalOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setIsSlippageModalOpen(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md sm:mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="heading-6 text-gray-100">
                {t("swap.slippageTitle")}
              </h3>
              <button
                type="button"
                onClick={() => setIsSlippageModalOpen(false)}
                className="text-gray-70 hover:text-gray-100 transition-colors"
                aria-label={t("common.close")}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <p className="body-14 text-gray-70 mb-5 leading-relaxed">
              {t("deposit.slippageDepositDescription")}
            </p>
            <div
              className={`mb-4 rounded-xl px-4 py-3 flex items-center gap-2 border ${
                autoSlippage
                  ? "bg-gray-10 border-gray-30"
                  : "bg-primary-50 border-primary-200"
              }`}
            >
              <input
                type="text"
                inputMode="decimal"
                value={
                  autoSlippage ? "" : customSlippageInput || String(activeSlippage)
                }
                onChange={(e) => handleCustomSlippageChange(e.target.value)}
                placeholder={autoSlippage ? t("deposit.auto") : "1"}
                className="flex-1 bg-transparent text-gray-100 heading-5 outline-none placeholder:text-gray-50"
              />
              <span className="text-gray-100 heading-6">%</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAutoSlippageClick}
                className={`flex-1 py-2.5 rounded-lg body-14-medium transition-all ${
                  autoSlippage
                    ? "bg-gray-100 text-white"
                    : "bg-gray-10 text-gray-90 hover:bg-gray-20 border border-gray-30"
                }`}
              >
                {t("deposit.auto")}
              </button>
              {PRESET_SLIPPAGES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handlePresetSlippageClick(value)}
                  className={`flex-1 py-2.5 rounded-lg body-14-medium transition-all ${
                    activeSlippage === value && !autoSlippage && !isCustomSlippage
                      ? "bg-gray-100 text-white"
                      : "bg-gray-10 text-gray-90 hover:bg-gray-20 border border-gray-30"
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>
            {activeSlippage > 5 && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl text-orange-700 body-14">
                ⚠️ {t("deposit.slippageWarningHighDeposit")}
              </div>
            )}
            {activeSlippage < 0.5 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-700 body-14">
                ⚠️ {t("deposit.slippageWarningLow")}
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsSlippageModalOpen(false)}
              className="w-full mt-6 py-3 bg-brand-green hover:bg-primary-200 text-gray-100 rounded-xl body-16-bold transition-colors"
            >
              {t("common.confirm")}
            </button>
          </div>
        </div>
      )}
    </SitePageShell>
  );
}
