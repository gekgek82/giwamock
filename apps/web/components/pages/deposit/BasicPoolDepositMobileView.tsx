"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { parseUnits, formatUnits } from "viem";
import { SitePageShell } from "@/components/pages/_lib/SitePageShell";
import { TokenIcon } from "@/components/common/TokenIcon";
import { ApprovalModal } from "@/components/pool/ApprovalModal";
import { DepositGradeWarningModal } from "@/components/deposit/DepositGradeWarningModal";
import type { LiquidityLockOption } from "@/components/deposit/LiquidityLockSettings";
import { formatUSD, formatAPR } from "@/hooks/useIndexerStats";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { GIWASCAN_URL } from "@/lib/config";
import { useBasicPoolDeposit } from "./useBasicPoolDeposit";

/* ────────────────────────────────────────────────────────────────────────── */
/* Inline icons — sized to match the Figma vector exports.                    */
/* ────────────────────────────────────────────────────────────────────────── */

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

function PercentBadge({
  active,
  disabled,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label="Toggle percentage slider"
      className={`rounded-[10px] p-1.5 flex items-center justify-center shrink-0 transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${
        active ? "bg-green-30" : "bg-green-10"
      }`}
    >
      <svg
        className="w-4 h-4 text-white"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="3" y1="13" x2="13" y2="3" />
        <circle cx="4.5" cy="4.5" r="1" />
        <circle cx="11.5" cy="11.5" r="1" />
      </svg>
    </button>
  );
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
        <span aria-hidden="true" className="text-gray-50 body-12">—</span>
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

/**
 * Segmented-control variant of `LiquidityLockSettings` tuned for the mobile
 * deposit card. Same options + handler as the desktop widget — only the
 * presentation differs so it sits comfortably inside the 20px-radius card
 * alongside the Numbers section instead of breaking out of it.
 */
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
      <div className="flex items-center justify-between gap-2">
        <h3 className="body-14-bold text-gray-100">
          {t("deposit.liquidityLockTitle")}
        </h3>
      </div>
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

/**
 * Read-only token row used inside the success summary. Same visual rhythm as
 * the editable `AmountRow` (gray-20 pill + token chip + amount + USD), minus
 * the inputs and percent helpers.
 */
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

interface DepositSuccessSummary {
  token0: { symbol: string; address: string };
  token1: { symbol: string; address: string };
  amount0: string;
  amount1: string;
  usd0: number;
  usd1: number;
  totalUsd: number;
  ratio0Pct: number;
  ratio1Pct: number;
  slippage: number;
  isAutoSlippage: boolean;
  txHash?: `0x${string}`;
}

/**
 * Mobile success screen shown after a confirmed deposit. Mirrors the Figma
 * "Deposit / Completed successfully" layout — token amounts, summary, and
 * the dual View Confirmation / Go Portfolio CTAs at the bottom.
 *
 * `View Confirmation` opens GiwaScan when a real tx hash is available; for
 * mock-driven previews it just dismisses the success view and hands the user
 * back to the (now-empty) deposit form.
 */
function DepositSuccessView({
  summary,
  onDismiss,
}: {
  summary: DepositSuccessSummary;
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
      {/* Top nav — back arrow only. Cancel was dropped per design feedback
          (the deposit already landed, so there's nothing to cancel). */}
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

      {/* Title + divider */}
      <div className="px-4 flex flex-col gap-2">
        <h1 className="body-16-bold text-gray-100">
          {t("deposit.completedSuccessfully")}
        </h1>
        <span aria-hidden="true" className="block w-full h-px bg-gray-30" />
      </div>

      <main className="flex-1 px-4 pt-5 pb-2 flex flex-col gap-2.5">
        {/* Token amount cards */}
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

        {/* Numbers section — same content as the form's summary, but wrapped
            in the gray-20 pill the success page uses. */}
        <section className="bg-gray-20 rounded-[20px] px-3 py-2 flex flex-col gap-2.5">
          <NumberRow
            label={t("deposit.totalDeposit")}
            value={totalDepositLabel}
          />
          <NumberRow label={t("deposit.depositRatio")} value={ratioLabel} />
          <NumberRow
            label={t("deposit.depositPriceRange")}
            value={t("deposit.fullRange")}
          />
          <div className="flex items-center justify-between w-full">
            <span className="body-12-medium text-gray-100">
              {t("swap.slippage")}
            </span>
            <span className="bg-gray-30 rounded-[10px] px-2 py-1 flex items-center gap-1 body-12-medium text-gray-100">
              {summary.isAutoSlippage
                ? t("deposit.auto")
                : `${summary.slippage}%`}
              <ChevronDownIcon className="w-4 h-4" />
            </span>
          </div>
        </section>

        {/* Logo + success message */}
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

      {/* Bottom CTAs */}
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

interface AmountRowProps {
  /** Pair slot — `0` is the first token (Token1), `1` is the second (Token2). */
  side: 0 | 1;
  tokenSymbol: string;
  tokenAddress: string;
  tokenDecimals: number;
  balance?: string;
  amount: string;
  usdValue: number;
  onAmountChange: (value: string) => void;
  active: boolean;
  /** Highlight the input red when the user has typed more than they hold. */
  isExceeding?: boolean;
}

function AmountRow({
  side,
  tokenSymbol,
  tokenAddress,
  tokenDecimals,
  balance,
  amount,
  usdValue,
  onAmountChange,
  active,
  isExceeding = false,
}: AmountRowProps) {
  const t = useTranslations();

  const [showSlider, setShowSlider] = useState(false);
  const [sliderPercent, setSliderPercent] = useState(0);

  // Keep the slider thumb in sync when the amount or balance changes from
  // outside (e.g. paired-amount auto-fill, balance refetch). Mirrors the
  // desktop `TokenDepositInputs` sync — without it the thumb drifts away
  // from the visible amount as soon as the other token's input is edited.
  useEffect(() => {
    if (balance && parseFloat(balance) > 0 && amount) {
      const percent = Math.round(
        (parseFloat(amount) / parseFloat(balance)) * 100,
      );
      setSliderPercent(Math.min(100, Math.max(0, percent)));
    } else if (!amount) {
      setSliderPercent(0);
    }
  }, [amount, balance]);

  const hasBalance = balance != null && parseFloat(balance) > 0;

  const balanceLabel = useMemo(() => {
    if (!balance) return `0 ${tokenSymbol}`;
    const num = parseFloat(balance);
    if (!Number.isFinite(num)) return `0 ${tokenSymbol}`;
    return `${num.toFixed(num >= 1 ? 2 : 6)} ${tokenSymbol}`;
  }, [balance, tokenSymbol]);

  const handlePercent = (percent: number) => {
    if (!balance) return;
    try {
      const balRaw = parseUnits(balance, tokenDecimals);
      const portion = (balRaw * BigInt(percent)) / BigInt(100);
      onAmountChange(formatUnits(portion, tokenDecimals));
    } catch {
      // ignore
    }
  };

  const handleSliderChange = (percent: number) => {
    setSliderPercent(percent);
    if (!balance) return;
    try {
      const balRaw = parseUnits(balance, tokenDecimals);
      const portion = (balRaw * BigInt(percent)) / BigInt(100);
      onAmountChange(formatUnits(portion, tokenDecimals));
    } catch {
      // ignore
    }
  };

  const toggleSlider = () => {
    if (!hasBalance) return;
    setShowSlider((prev) => !prev);
  };

  const usdLabel =
    usdValue > 0 ? `~${formatUSD(String(usdValue))}` : "—";

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
              className="bg-gray-30 hover:bg-gray-40 rounded-[10px] px-2 py-1 body-14-medium text-gray-100 transition-colors"
            >
              50%
            </button>
            <button
              type="button"
              onClick={() => handlePercent(100)}
              className="bg-gray-30 hover:bg-gray-40 rounded-[10px] px-2 py-1 body-14-medium text-gray-100 transition-colors"
            >
              100%
            </button>
            <PercentBadge
              active={showSlider}
              disabled={!hasBalance}
              onClick={toggleSlider}
            />
          </div>
        </div>
      </div>
      {showSlider && (
        <div className="px-1 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={sliderPercent}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            aria-label={`${tokenSymbol} percentage of balance`}
            className="flex-1 h-2 bg-gray-30 rounded-lg appearance-none cursor-pointer accent-green-10"
          />
          <span className="w-10 text-right body-14-medium text-gray-100">
            {sliderPercent}%
          </span>
        </div>
      )}
      <div
        className={`rounded-[20px] px-5 py-2.5 flex items-center justify-between gap-2 ${
          isExceeding
            ? "bg-red-10 border border-red-30"
            : active
              ? "bg-gray-20 border-2 border-green-10"
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
            value={amount}
            onChange={(e) => {
              // Allow only digits and a single decimal separator.
              const raw = e.target.value.replace(/,/g, ".");
              if (raw === "" || /^\d*\.?\d*$/.test(raw)) onAmountChange(raw);
            }}
            placeholder="0"
            className={`w-full bg-transparent text-right outline-none heading-bold-20 placeholder:text-gray-100 ${
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
/* Main view                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export function BasicPoolDepositMobileView() {
  const t = useTranslations();
  const d = useBasicPoolDeposit();

  const symbols = [
    d.selectedPool?.token0.symbol ?? "",
    d.selectedPool?.token1.symbol ?? "",
  ].filter(Boolean);
  const { prices } = useTokenPrices(symbols);

  // Slippage modal state — kept here (not in the shared hook) since it's pure
  // UI for the modal interaction. Mirrors the desktop `TokenDepositInputs`
  // modal so the available choices, validation, and warnings stay identical.
  const [isSlippageModalOpen, setIsSlippageModalOpen] = useState(false);
  const [customSlippageInput, setCustomSlippageInput] = useState("");

  const isCustomSlippage = useMemo(() => {
    if (d.isAutoSlippage) return false;
    return (
      customSlippageInput !== "" || !PRESET_SLIPPAGES.includes(d.slippage)
    );
  }, [customSlippageInput, d.slippage, d.isAutoSlippage]);

  const handleAutoSlippageClick = () => {
    d.setIsAutoSlippage(true);
    d.setSlippage(AUTO_SLIPPAGE_VALUE);
    setCustomSlippageInput("");
  };

  const handlePresetSlippageClick = (value: number) => {
    d.setIsAutoSlippage(false);
    d.setSlippage(value);
    setCustomSlippageInput("");
  };

  const handleCustomSlippageChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setCustomSlippageInput(value);
      d.setIsAutoSlippage(false);
      const parsed = parseFloat(value);
      if (!Number.isNaN(parsed)) {
        d.setSlippage(parsed);
      }
    }
  };

  // Loading: waiting for indexer or token info
  if (d.isLoading || (!d.selectedPool && d.isOnChainLoading)) {
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

  if (!d.selectedPool) {
    return (
      <SitePageShell className="bg-brand-bg" showFooter={false}>
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="heading-6 text-gray-100">{t("common.loading")}</p>
          <p className="body-14 text-gray-70">
            {t("deposit.tokenInfoRequired")}
          </p>
          <button
            type="button"
            onClick={d.handleChangePool}
            className="px-5 py-2.5 rounded-[20px] bg-brand-green text-gray-100 body-16-bold"
          >
            {t("common.backToPoolList")}
          </button>
        </main>
      </SitePageShell>
    );
  }

  const pool = d.selectedPool;

  // Post-deposit success screen — takes over the whole route once the hook
  // captures a snapshot of the most recent successful deposit. Dismissing it
  // (back arrow / Cancel / `View Confirmation` for mock submits) returns the
  // user to the (now-cleared) deposit form.
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
          slippage: d.slippage,
          isAutoSlippage: d.isAutoSlippage,
          txHash: d.lastDeposit.txHash,
        }}
        onDismiss={d.dismissLastDeposit}
      />
    );
  }

  const gateway = d.indexerPool?.gateway;

  const tvlDisplay = formatGatewayUsd(gateway?.tvlDisplayUsd);
  const volumeDisplay = formatGatewayUsd(gateway?.volume24hUsd);
  const feesDisplay = formatGatewayUsd(gateway?.feesDayUsd);
  // Pre-TGE: gauges don't exist on-chain yet. Surface "N/A" rather than 0%
  // so the row reads as "no emissions today" instead of an empty value.
  const emissionAprDisplay = d.indexerPool?.hasGauge ? "-" : "N/A";
  const swapAprDisplay = formatAPR(String(gateway?.swapAprApprox ?? 0));

  const feeDisplay = (() => {
    const fee = d.indexerPool?.effectiveFeeBps;
    if (fee != null && Number.isFinite(fee)) {
      return `${(fee / 100).toFixed(2)}%`;
    }
    return d.isStableParam ? "0.05%" : "0.30%";
  })();

  const usd0 =
    (parseFloat(d.amount0 || "0") || 0) * (prices[pool.token0.symbol] ?? 0);
  const usd1 =
    (parseFloat(d.amount1 || "0") || 0) * (prices[pool.token1.symbol] ?? 0);
  const totalUsd = usd0 + usd1;

  const totalDepositLabel =
    totalUsd > 0 ? `$${totalUsd.toFixed(2)}` : "$0.00";

  // Basic-pool deposit ratio is implicit — it equals the USD split between the
  // two amounts the user typed. We surface that so the user can sanity-check
  // before confirming.
  const depositRatioLabel = (() => {
    if (totalUsd <= 0) return "—";
    const r0 = ((usd0 / totalUsd) * 100).toFixed(1);
    const r1 = ((usd1 / totalUsd) * 100).toFixed(1);
    return `${r0}% / ${r1}%`;
  })();

  const showInitialPriceWarning =
    d.isInitialLiquidity &&
    parseFloat(d.amount0 || "0") > 0 &&
    parseFloat(d.amount1 || "0") > 0;

  const isExceeding0 =
    !!d.balance0 &&
    !!d.amount0 &&
    parseFloat(d.amount0) > parseFloat(d.balance0);
  const isExceeding1 =
    !!d.balance1 &&
    !!d.amount1 &&
    parseFloat(d.amount1) > parseFloat(d.balance1);

  const hasAmounts =
    parseFloat(d.amount0 || "0") > 0 && parseFloat(d.amount1 || "0") > 0;

  const expectedLpLabel = (() => {
    if (!hasAmounts) return null;
    if (d.isQuoteLoading) return t("common.calculating");
    const q = parseFloat(d.expectedLpTokens || "0");
    if (q > 0) return `${q.toFixed(6)} LP`;
    const est = d.estimatedInitialLpHuman
      ? parseFloat(d.estimatedInitialLpHuman)
      : 0;
    if (est > 0) return `~${est.toFixed(6)} LP`;
    if (d.isQuoteError) return t("deposit.lpQuoteUnavailable");
    return "-";
  })();

  return (
    <SitePageShell className="bg-brand-bg" showFooter={false}>
      <main className="flex-1 flex flex-col gap-2.5 px-4 pt-2 pb-2">
        {/* Pair info card */}
        <section className="bg-white rounded-[20px] p-4 flex flex-col gap-3.5">
          {/* Header strip */}
          <header className="bg-gray-20 rounded-[10px] p-2.5 flex items-center justify-between gap-2">
            <span className="body-14-bold text-gray-100 truncate min-w-0">
              {pool.token0.symbol} - {pool.token1.symbol}
            </span>
            <div className="flex gap-1 items-center body-12 font-medium text-gray-100 whitespace-nowrap">
              <span>{t("pool.basic").toUpperCase()}</span>
              <span>{d.isStableParam ? t("pool.stable") : t("pool.volatile")}</span>
              <span>{feeDisplay}</span>
            </div>
          </header>

          {/* Stats grid: two rows of three columns */}
          <div className="flex flex-col gap-3.5">
            <div className="flex items-start gap-2">
              <StatColumn label={t("pool.tvl")} value={tvlDisplay} />
              <StatColumn label={t("pool.volume24h")} value={volumeDisplay} />
              <StatColumn
                label={t("pool.accumulatedFees")}
                value={feesDisplay}
              />
            </div>
            <div className="flex items-start gap-2">
              <StatColumn
                label={t("pool.emissionAPR")}
                value={emissionAprDisplay}
              />
              <StatColumn label={t("pool.swapFeeAPR")} value={swapAprDisplay} />
              <AddressColumn poolAddress={pool.address} gaugeAddress={null} />
            </div>
          </div>
        </section>

        {/* Deposit (two-token) card */}
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
              active={false}
              isExceeding={isExceeding0}
            />

            {/* Visual divider — deposits add BOTH tokens (not a swap), so this
                is a plus glyph and not a click target. Matches the desktop
                `TokenDepositInputs` divider. */}
            <div
              aria-hidden="true"
              className="bg-green-10 rounded-full p-2.5 flex items-center justify-center shadow-[inset_0_-1px_2px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.6)]"
            >
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 5v14M5 12h14"
                  stroke="white"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <AmountRow
              side={1}
              tokenSymbol={pool.token1.symbol}
              tokenAddress={pool.token1.address}
              tokenDecimals={pool.token1.decimals}
              balance={d.balance1}
              amount={d.amount1}
              usdValue={usd1}
              onAmountChange={d.handleAmount1Change}
              active
              isExceeding={isExceeding1}
            />
          </div>

          {/* Numbers section */}
          <div className="px-4 flex flex-col gap-2.5">
            <NumberRow
              label={t("deposit.totalDeposit")}
              value={totalDepositLabel}
            />
            <NumberRow
              label={t("deposit.depositRatio")}
              value={depositRatioLabel}
            />
            <NumberRow
              label={t("deposit.depositPriceRange")}
              value={t("deposit.fullRange")}
            />
            {expectedLpLabel != null && (
              <NumberRow
                label={t("liquidity.expectedLpTokens")}
                value={expectedLpLabel}
              />
            )}
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
                  {d.isAutoSlippage
                    ? t("deposit.auto")
                    : `${d.slippage}%`}
                </span>
                <ChevronDownIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Liquidity lock — same options as the desktop widget (and same
              data binding through the shared hook), but rendered as a compact
              segmented control so the section blends with the rest of the
              mobile deposit card rather than breaking out of its 20px radius. */}
          <div className="px-4">
            <LiquidityLockSegmented
              value={d.lockOption}
              onChange={d.setLockOption}
            />
          </div>
        </section>
      </main>

      {/* Sticky bottom action bar — sits over content so the deposit CTA stays
          reachable without scrolling on tall pair-info layouts. */}
      <div className="sticky bottom-0 z-10 bg-brand-bg/95 backdrop-blur-sm pt-4 pb-5 px-4 flex flex-col gap-2">
        {showInitialPriceWarning && (
          <div className="flex gap-1 items-center">
            <AlertTriangleIcon />
            <p className="body-12-medium text-red-30">
              {t("liquidity.initialPriceWarning")}
            </p>
          </div>
        )}
        <div className="flex gap-2.5 items-center w-full">
          <button
            type="button"
            onClick={d.handleChangePool}
            className="flex-1 px-5 py-2.5 rounded-[20px] bg-gray-70 hover:bg-gray-80 text-white body-16-bold transition-colors min-h-[44px]"
          >
            {t("liquidity.changePool")}
          </button>
          <button
            type="button"
            onClick={d.handleLiquidityButtonClick}
            disabled={d.buttonState.disabled}
            className="flex-1 px-5 py-2.5 rounded-[20px] bg-brand-green hover:bg-primary-200 text-gray-100 body-16-bold transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {d.buttonState.text}
          </button>
        </div>
      </div>

      <ApprovalModal
        isOpen={d.isApprovalModalOpen}
        onClose={() => d.setIsApprovalModalOpen(false)}
        steps={d.approvalStepsWithStatus}
        onApprove={d.handleApprove}
        onAddLiquidity={d.handleAddLiquidity}
        isAddingLiquidity={d.isAdding || d.isConfirming}
      />

      <DepositGradeWarningModal
        grade={d.poolGrade}
        isOpen={d.isGradeWarningOpen}
        onConfirm={d.handleGradeWarningConfirm}
        onCancel={() => d.setIsGradeWarningOpen(false)}
      />

      {/* Slippage modal — same options as the desktop deposit screen
          (Auto, 0.5/1/3/5 presets, custom input, and the high/low warnings). */}
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
                d.isAutoSlippage
                  ? "bg-gray-10 border-gray-30"
                  : "bg-primary-50 border-primary-200"
              }`}
            >
              <input
                type="text"
                inputMode="decimal"
                value={
                  d.isAutoSlippage
                    ? ""
                    : customSlippageInput || String(d.slippage)
                }
                onChange={(e) => handleCustomSlippageChange(e.target.value)}
                placeholder={d.isAutoSlippage ? t("deposit.auto") : "1"}
                className="flex-1 bg-transparent text-gray-100 heading-5 outline-none placeholder:text-gray-50"
              />
              <span className="text-gray-100 heading-6">%</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAutoSlippageClick}
                className={`flex-1 py-2.5 rounded-lg body-14-medium transition-all ${
                  d.isAutoSlippage
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
                    d.slippage === value &&
                    !d.isAutoSlippage &&
                    !isCustomSlippage
                      ? "bg-gray-100 text-white"
                      : "bg-gray-10 text-gray-90 hover:bg-gray-20 border border-gray-30"
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>

            {d.slippage > 5 && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl text-orange-700 body-14">
                ⚠️ {t("deposit.slippageWarningHighDeposit")}
              </div>
            )}

            {d.slippage < 0.5 && (
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
