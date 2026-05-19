"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { parseUnits, formatUnits } from "viem";
import { useAccount } from "wagmi";
import { Button } from "@/components/common/Button";
import { Checkbox } from "@/components/common/Checkbox";
import { TokenIcon } from "@/components/common/TokenIcon";
import { DecorativeBanner } from "@/components/common/DecorativeBanner";
import {
  useRegisteredTokens,
  type TokenInfo,
} from "@/hooks/useContractAddresses";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useTokenPrice } from "@/hooks/useTokenPrices";
import { useVoteEpoch } from "@/hooks/useVoteEpoch";
import { useAddVoteIncentive } from "@/hooks/useAddVoteIncentive";
import type { VotePoolInfo } from "@/types/indexer";

type Step = "form" | "approve" | "confirm" | "success";

interface AddIncentiveFormProps {
  pool: VotePoolInfo;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0s";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatTokenAmount(value: string): string {
  const num = parseFloat(value);
  if (!isFinite(num) || num === 0) return "0";
  if (num >= 1) return num.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return num.toFixed(6);
}

function formatUsd(num: number): string {
  if (!isFinite(num) || num <= 0) return "~$0";
  if (num >= 1_000_000) return `~$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000)
    return `~$${num.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `~$${num.toFixed(2)}`;
}

function AlertTriangleIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      className="w-6 h-6 text-gray-90"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function PercentIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="28" height="28" rx="10" fill="#00D185" />
      <path
        d="M11.8789 17.642C11.8789 18.5167 11.1669 19.2259 10.2885 19.2259C9.4102 19.2259 8.69817 18.5167 8.69817 17.642C8.69817 16.7672 9.4102 16.0581 10.2885 16.0581C11.1669 16.0581 11.8789 16.7672 11.8789 17.642Z"
        fill="white"
      />
      <path
        d="M19.3005 10.2504C19.3005 11.1252 18.5885 11.8343 17.7102 11.8343C16.8318 11.8343 16.1198 11.1252 16.1198 10.2504C16.1198 9.37564 16.8318 8.6665 17.7102 8.6665C18.5885 8.6665 19.3005 9.37564 19.3005 10.2504Z"
        fill="white"
      />
      <path
        d="M19.3327 19.3332L8.66602 8.70975M11.8789 17.642C11.8789 18.5167 11.1669 19.2259 10.2885 19.2259C9.4102 19.2259 8.69817 18.5167 8.69817 17.642C8.69817 16.7672 9.4102 16.0581 10.2885 16.0581C11.1669 16.0581 11.8789 16.7672 11.8789 17.642ZM19.3005 10.2504C19.3005 11.1252 18.5885 11.8343 17.7102 11.8343C16.8318 11.8343 16.1198 11.1252 16.1198 10.2504C16.1198 9.37564 16.8318 8.6665 17.7102 8.6665C18.5885 8.6665 19.3005 9.37564 19.3005 10.2504Z"
        stroke="#F8FAFC"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface SummaryCardProps {
  token: TokenInfo;
  amount: string;
  amountUsd: number;
}

function SelectedPoolRow({ pool }: { pool: VotePoolInfo }) {
  const t = useTranslations();
  const strategyLabel = pool.poolType === "CL" ? "Concentrated" : "Basic";
  const stabilityLabel = pool.isStable ? t("pool.stable") : t("pool.volatile");

  return (
    <div className="flex items-center justify-between gap-2.5 border border-gray-30 rounded-[10px] px-2.5 py-3.5">
      <div className="flex items-center gap-5 body-14-medium text-gray-100 whitespace-nowrap">
        <span>
          {pool.token0.symbol}-{pool.token1.symbol}
        </span>
        <span>{strategyLabel}</span>
        <span>{stabilityLabel}</span>
        <span>{pool.feePercent}%</span>
      </div>
    </div>
  );
}

function IncentiveAmountCard({ token, amount, amountUsd }: SummaryCardProps) {
  return (
    <div className="flex items-center justify-between gap-2.5 bg-gray-20 rounded-[20px] px-[30px] py-5">
      <div className="flex items-center gap-2.5 bg-gray-10 rounded-full px-4 py-4">
        <div className="flex items-center gap-1">
          <TokenIcon
            address={token.address}
            symbol={token.symbol}
            iconUrl={token.iconUrl}
            size={24}
          />
          <span className="body-16-semibold text-gray-100 whitespace-nowrap">
            {token.symbol}
          </span>
          {token.stickerUrl && (
            <Image
              src={token.stickerUrl}
              alt="sticker"
              width={18}
              height={18}
              className="object-contain"
            />
          )}
        </div>
      </div>
      <div className="flex flex-col items-end text-right text-gray-100">
        <span className="text-[24px] font-bold leading-[36px] whitespace-nowrap">
          {formatTokenAmount(amount)}
        </span>
        <span className="body-14-medium whitespace-nowrap">
          {formatUsd(amountUsd)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input step — token/amount entry with consent + live deadline
// ---------------------------------------------------------------------------
interface InputStepProps {
  token: TokenInfo | undefined;
  onSelectToken: (t: TokenInfo) => void;
  allTokens: TokenInfo[];
  amount: string;
  setAmount: (v: string) => void;
  consent: boolean;
  setConsent: (v: boolean) => void;
  endsInSeconds: number;
  totalEmission: string;
  poolVotes: string;
  onCancel: () => void;
  onIncentivize: () => void;
}

function InputStep({
  token,
  onSelectToken,
  allTokens,
  amount,
  setAmount,
  consent,
  setConsent,
  endsInSeconds,
  totalEmission,
  poolVotes,
  onCancel,
  onIncentivize,
}: InputStepProps) {
  const t = useTranslations();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const [sliderPercent, setSliderPercent] = useState(0);
  const { data: balance } = useTokenBalance(
    token?.address as `0x${string}` | undefined,
  );
  const { price: tokenPrice } = useTokenPrice(token?.symbol);
  const isWhitelisted = token?.isWhitelisted ?? false;

  const amountNum = parseFloat(amount || "0");
  const balanceNum = parseFloat(balance || "0");
  const isInsufficient = amountNum > balanceNum && amountNum > 0;
  const amountUsd = tokenPrice ? amountNum * tokenPrice : 0;

  // Keep slider position in sync with external amount edits so typing or
  // hitting 50%/100% moves the thumb accordingly. Matches the swap card.
  useEffect(() => {
    if (balanceNum <= 0) {
      setSliderPercent(0);
      return;
    }
    const pct = Math.round((amountNum / balanceNum) * 100);
    setSliderPercent(Math.min(100, Math.max(0, pct)));
  }, [amountNum, balanceNum]);

  const handlePct = (pct: number) => {
    if (!consent || !token) return;
    const val = (balanceNum * pct) / 100;
    if (val === 0) return;
    setAmount(String(val));
  };

  const handleSliderChange = (pct: number) => {
    setSliderPercent(pct);
    if (!consent || !token || balanceNum <= 0) return;
    const val = (balanceNum * pct) / 100;
    setAmount(val > 0 ? String(val) : "");
  };

  const handleToggleSlider = () => {
    if (!consent) return;
    setShowSlider((v) => !v);
  };

  const canSubmit =
    consent &&
    !!token &&
    isWhitelisted &&
    amountNum > 0 &&
    !isInsufficient;

  return (
    <div className="mx-auto flex w-full max-w-[670px] flex-col bg-white rounded-[20px] pb-[30px]">
      {/* Header */}
      <div className="flex flex-col gap-3 pt-[30px]">
        <div className="flex flex-col gap-2.5 px-[30px]">
          <h1 className="text-[20px] font-bold leading-[30px] text-gray-100">
            {t("voteIncentive.inputTitle")}
          </h1>
          <div className="body-14-medium text-gray-90 space-y-0">
            <p className="leading-[21px]">
              {t("voteIncentive.inputDescription1")}
            </p>
            <p className="leading-[21px]">
              {t("voteIncentive.inputDescription2")}
            </p>
          </div>
        </div>
        <div className="h-px w-full bg-gray-30" />
      </div>

      {/* Status panel */}
      <div className="px-[30px] pt-5">
        <div className="flex flex-col gap-5 rounded-[20px] bg-gray-20 p-5 text-gray-100">
          <StatusRow
            label={t("voteIncentive.poolVotes")}
            value={poolVotes}
            unit=""
          />
          <StatusRow
            label={t("voteIncentive.totalNewEmissions")}
            value={totalEmission}
            unit={t("voteIncentive.pointUnit")}
          />
          <div className="flex items-center justify-between w-full">
            <p className="body-16-semibold flex-1 min-w-0">
              {t("voteIncentive.deadline")}
            </p>
            <div className="flex items-baseline gap-1 whitespace-nowrap text-right">
              <span className="body-16-medium">
                {t("voteIncentive.endsIn")}
              </span>
              <span className="text-[20px] font-bold leading-[30px]">
                {formatCountdown(endsInSeconds)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Consent */}
      <div className="px-[30px] pt-5">
        <button
          type="button"
          onClick={() => setConsent(!consent)}
          className="w-full text-left border border-gray-30 rounded-[20px] px-5 py-4 flex flex-col gap-2.5 hover:bg-gray-10 transition-colors"
        >
          <div className="flex items-center gap-1">
            <AlertTriangleIcon className="size-6 shrink-0 text-red-30" />
            <p className="body-14-bold text-red-30">
              {t("voteIncentive.consentTitle")}
            </p>
          </div>
          <p className="body-14-medium text-red-30 leading-[21px]">
            {t("voteIncentive.consentBody")}
          </p>
          <div className="flex items-center gap-1">
            <Checkbox checked={consent} />
            <p className="body-14-bold text-gray-100">
              {t("voteIncentive.yesIAgree")}
            </p>
          </div>
        </button>
      </div>

      {/* Incentive token + amount */}
      <div className="px-[30px] pt-5">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-end justify-between w-full">
            <p className="body-16-semibold text-gray-100 whitespace-nowrap">
              {t("voteIncentive.incentive")}
            </p>
            <div className="flex items-center gap-4">
              <span
                className={`body-14-medium whitespace-nowrap ${
                  isInsufficient ? "text-red-30" : "text-gray-100"
                }`}
              >
                {formatTokenAmount(balance || "0")} {token?.symbol ?? ""}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={!consent}
                  onClick={() => handlePct(50)}
                  className="bg-gray-20 hover:bg-gray-30 disabled:opacity-50 disabled:cursor-not-allowed rounded-[10px] px-2 py-1 body-14-medium text-gray-100"
                >
                  50%
                </button>
                <button
                  type="button"
                  disabled={!consent}
                  onClick={() => handlePct(100)}
                  className="bg-gray-20 hover:bg-gray-30 disabled:opacity-50 disabled:cursor-not-allowed rounded-[10px] px-2 py-1 body-14-medium text-gray-100"
                >
                  100%
                </button>
                <button
                  type="button"
                  disabled={!consent}
                  onClick={handleToggleSlider}
                  aria-label="Toggle percentage slider"
                  className="rounded-[10px] transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PercentIcon />
                </button>
              </div>
            </div>
          </div>

          {showSlider && (
            <div className="mt-1 px-2">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  disabled={!consent || balanceNum <= 0}
                  value={sliderPercent}
                  onChange={(e) =>
                    handleSliderChange(Number(e.target.value))
                  }
                  className="flex-1 h-2 bg-gray-30 rounded-lg appearance-none cursor-pointer accent-green-10 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="w-12 text-right body-14-medium text-gray-80">
                  {sliderPercent}%
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between bg-gray-20 rounded-[20px] px-[30px] py-5">
            {/* Token selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-2.5 bg-gray-10 hover:bg-gray-20 border border-transparent hover:border-gray-30 rounded-full p-4 transition-colors"
              >
                {token ? (
                  <div className="flex items-center gap-1">
                    <TokenIcon
                      address={token.address}
                      symbol={token.symbol}
                      iconUrl={token.iconUrl}
                      size={24}
                    />
                    <span className="body-16-semibold text-gray-100">
                      {token.symbol}
                    </span>
                    {token.stickerUrl && (
                      <Image
                        src={token.stickerUrl}
                        alt="sticker"
                        width={18}
                        height={18}
                        className="object-contain"
                      />
                    )}
                  </div>
                ) : (
                  <span className="body-16-semibold text-gray-50">---</span>
                )}
                <ChevronDownIcon />
              </button>

              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute left-0 mt-2 w-72 max-h-80 overflow-auto bg-white border border-gray-30 rounded-[20px] shadow-lg z-20">
                    {allTokens.map((ti) => {
                      const isDisabled = !ti.isWhitelisted;
                      return (
                        <button
                          type="button"
                          key={ti.address}
                          disabled={isDisabled}
                          onClick={() => {
                            if (isDisabled) return;
                            onSelectToken(ti);
                            setDropdownOpen(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-gray-10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2.5 transition-colors"
                        >
                          <TokenIcon
                            address={ti.address}
                            symbol={ti.symbol}
                            iconUrl={ti.iconUrl}
                            size={28}
                          />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="body-14-bold text-gray-100 truncate">
                              {ti.symbol}
                              {!ti.isWhitelisted && (
                                <span className="ml-1 body-12 text-gray-50">
                                  ({t("voteIncentive.notWhitelisted")})
                                </span>
                              )}
                            </span>
                            <span className="body-12 text-gray-60 truncate">
                              {ti.name}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Amount input */}
            <div className="flex flex-col items-end text-right">
              <input
                type="text"
                inputMode="decimal"
                disabled={!consent || !token}
                value={amount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
                }}
                placeholder="0"
                className={`bg-transparent text-right text-[24px] font-bold leading-[36px] text-gray-100 placeholder:text-gray-50 w-56 focus:outline-none disabled:opacity-60 ${
                  isInsufficient ? "text-red-30" : ""
                }`}
              />
              <span className="body-14-medium text-gray-100">
                {formatUsd(amountUsd)}
              </span>
            </div>
          </div>

          {/* Errors */}
          {token && !isWhitelisted && (
            <p className="body-12 text-red-30">
              {t("voteIncentive.tokenNotWhitelisted")}
            </p>
          )}
          {isInsufficient && (
            <p className="body-12 text-red-30">
              {t("voteIncentive.insufficientBalance", {
                symbol: token?.symbol ?? "",
              })}
            </p>
          )}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex items-center justify-center gap-5 px-[30px] pt-10">
        <Button
          variant="secondary"
          size="lg"
          className="max-w-[295px]"
          onClick={onCancel}
        >
          {t("common.cancel")}
        </Button>
        <Button
          size="lg"
          className="max-w-[295px]"
          disabled={!canSubmit}
          onClick={onIncentivize}
        >
          {t("voteIncentive.incentivize")}
        </Button>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="flex items-center justify-between w-full">
      <p className="body-16-semibold flex-1 min-w-0">{label}</p>
      <div className="flex items-baseline gap-1 whitespace-nowrap text-right">
        <span className="text-[20px] font-bold leading-[30px]">{value}</span>
        {unit && <span className="body-16 text-gray-100">{unit}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary step (approve + confirm + complete share the layout)
// ---------------------------------------------------------------------------

interface SummaryStepProps {
  title: string;
  description: React.ReactNode;
  pool: VotePoolInfo;
  token: TokenInfo;
  amount: string;
  amountUsd: number;
  leftButtonText: string;
  onLeft: () => void;
  leftDisabled?: boolean;
  rightButtonText: string;
  onRight: () => void;
  rightLoading?: boolean;
  rightDisabled?: boolean;
}

function SummaryStep({
  title,
  description,
  pool,
  token,
  amount,
  amountUsd,
  leftButtonText,
  onLeft,
  leftDisabled,
  rightButtonText,
  onRight,
  rightLoading,
  rightDisabled,
}: SummaryStepProps) {
  const t = useTranslations();
  return (
    <div className="mx-auto flex w-full max-w-[670px] flex-col bg-white rounded-[20px] pb-[30px]">
      {/* Header */}
      <div className="flex flex-col gap-3 pt-[30px]">
        <div className="flex flex-col gap-2.5 px-[30px]">
          <h1 className="text-[20px] font-bold leading-[30px] text-gray-100">
            {title}
          </h1>
          <div className="body-14-medium text-gray-90 space-y-0">
            {description}
          </div>
        </div>
        <div className="h-px w-full bg-gray-30" />
      </div>

      {/* 1. Selected pool */}
      <div className="px-[30px] pt-5 flex flex-col gap-2.5">
        <p className="body-14-medium text-gray-100">
          <span className="ms-[21px]">1. {t("voteIncentive.selectedPool")}</span>
        </p>
        <SelectedPoolRow pool={pool} />
      </div>

      {/* 2. Added incentive */}
      <div className="px-[30px] pt-5 flex flex-col gap-2.5">
        <p className="body-14-medium text-gray-100">
          <span className="ms-[21px]">
            2. {t("voteIncentive.addedIncentive")}
          </span>
        </p>
        <IncentiveAmountCard
          token={token}
          amount={amount}
          amountUsd={amountUsd}
        />
      </div>

      {/* Decorative banner */}
      <div className="px-[30px] pt-5">
        <DecorativeBanner>
          <div className="text-center body-16-bold text-white leading-6">
            <p>{t("voteIncentive.bannerLine1")}</p>
            <p>{t("voteIncentive.bannerLine2")}</p>
          </div>
        </DecorativeBanner>
      </div>

      {/* CTAs */}
      <div className="flex items-center justify-center gap-5 px-[30px] pt-10">
        <Button
          variant="secondary"
          size="lg"
          className="max-w-[295px]"
          onClick={onLeft}
          disabled={leftDisabled}
        >
          {leftButtonText}
        </Button>
        <Button
          size="lg"
          className="max-w-[295px]"
          onClick={onRight}
          loading={rightLoading}
          disabled={rightDisabled}
        >
          {rightButtonText}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main multi-step form
// ---------------------------------------------------------------------------

export function AddIncentiveForm({ pool }: AddIncentiveFormProps) {
  const router = useRouter();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { isConnected } = useAccount();

  const allTokens = useRegisteredTokens();
  const whitelisted = useMemo(
    () => allTokens.filter((x) => x.isWhitelisted),
    [allTokens],
  );

  const { epoch } = useVoteEpoch();

  // Live countdown — endsInSeconds is refreshed every 60s by useVoteEpoch, but
  // we also tick a local clock once a second so the user sees a smooth
  // countdown near the deadline.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const endsInSeconds = useMemo(() => {
    if (!epoch?.endsAt) return 0;
    const ms = new Date(epoch.endsAt).getTime() - now;
    return Math.max(0, Math.floor(ms / 1000));
  }, [epoch?.endsAt, now]);

  const [step, setStep] = useState<Step>("form");
  const [token, setToken] = useState<TokenInfo | undefined>(undefined);
  const [amount, setAmount] = useState("");
  const [consent, setConsent] = useState(false);
  const [signedPayload, setSignedPayload] = useState<{
    signature: string;
    message: string;
  } | null>(null);

  // Default selection: first whitelisted token
  useEffect(() => {
    if (!token && whitelisted.length > 0) {
      setToken(whitelisted[0]);
    }
  }, [token, whitelisted]);

  const { price: tokenPrice } = useTokenPrice(token?.symbol);
  const amountNum = parseFloat(amount || "0");
  const amountUsd = tokenPrice ? amountNum * tokenPrice : 0;

  const { sign, submit, isSigning, isSubmitting } = useAddVoteIncentive();

  const handleCancel = () => {
    router.push("/vote");
  };

  const handleProceedToApprove = () => {
    if (!isConnected) return;
    setStep("approve");
  };

  const handleApprove = async () => {
    if (!token || amountNum <= 0 || !epoch) return;
    const amountWei = parseUnits(amount, token.decimals).toString();
    const params = {
      poolAddress: pool.poolAddress,
      tokenAddress: token.address,
      tokenSymbol: token.symbol,
      tokenDecimals: token.decimals,
      amountWei,
      amountUsd: amountUsd > 0 ? amountUsd.toFixed(10) : undefined,
      epoch: epoch.epochNumber,
    };
    const signed = await sign(params);
    if (!signed) return;
    setSignedPayload(signed);
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!token || !signedPayload || !epoch) return;
    const amountWei = parseUnits(amount, token.decimals).toString();
    const result = await submit({
      poolAddress: pool.poolAddress,
      tokenAddress: token.address,
      tokenSymbol: token.symbol,
      tokenDecimals: token.decimals,
      amountWei,
      amountUsd: amountUsd > 0 ? amountUsd.toFixed(10) : undefined,
      epoch: epoch.epochNumber,
      signature: signedPayload.signature,
      message: signedPayload.message,
    });
    if (!result) return;
    // Invalidate caches so the vote page reflects the new incentive total.
    queryClient.invalidateQueries({ queryKey: ["vote"] });
    queryClient.invalidateQueries({ queryKey: ["vote-incentives"] });
    setStep("success");
  };

  const handleGoPortfolio = () => {
    router.push("/portfolio");
  };

  const handleEdit = () => {
    setStep("form");
    setSignedPayload(null);
  };

  // Total emission display. The epoch summary today only carries USD totals
  // for fees/incentives/rewards — the new-point-emission figure isn't exposed
  // yet. Keep the slot but show '—' until a source is wired up.
  const totalEmission = "—";

  // Pool vote weight (currently on-chain + pre-TGE aggregate) in human units.
  const poolVotes = useMemo(() => {
    const raw = pool.voteWeight ?? "0";
    try {
      const parsed = parseFloat(formatUnits(BigInt(raw), 18));
      if (!isFinite(parsed)) return "0";
      if (parsed >= 1_000_000) return `${(parsed / 1_000_000).toFixed(2)}M`;
      if (parsed >= 1_000)
        return parsed.toLocaleString("en-US", { maximumFractionDigits: 2 });
      return parsed.toFixed(2);
    } catch {
      return "0";
    }
  }, [pool.voteWeight]);

  if (step === "form") {
    return (
      <InputStep
        token={token}
        onSelectToken={setToken}
        allTokens={allTokens}
        amount={amount}
        setAmount={setAmount}
        consent={consent}
        setConsent={setConsent}
        endsInSeconds={endsInSeconds}
        totalEmission={totalEmission}
        poolVotes={poolVotes}
        onCancel={handleCancel}
        onIncentivize={handleProceedToApprove}
      />
    );
  }

  if (!token) return null;

  if (step === "approve") {
    return (
      <SummaryStep
        title={t("voteIncentive.approveTitle")}
        description={
          <>
            <p className="leading-[21px]">
              {t("voteIncentive.approveDescription1")}
            </p>
            <p className="leading-[21px]">
              {t("voteIncentive.approveDescription2")}
            </p>
            <p className="leading-[21px]">
              {t("voteIncentive.approveDescription3")}
            </p>
          </>
        }
        pool={pool}
        token={token}
        amount={amount}
        amountUsd={amountUsd}
        leftButtonText={t("vote.edit")}
        onLeft={handleEdit}
        leftDisabled={isSigning}
        rightButtonText={
          isSigning ? t("common.approving") : t("common.approve")
        }
        onRight={handleApprove}
        rightLoading={isSigning}
      />
    );
  }

  if (step === "confirm") {
    return (
      <SummaryStep
        title={t("voteIncentive.confirmTitle")}
        description={
          <>
            <p className="leading-[21px]">
              {t("voteIncentive.confirmDescription1")}
            </p>
            <p className="leading-[21px]">
              {t("voteIncentive.confirmDescription2")}
            </p>
          </>
        }
        pool={pool}
        token={token}
        amount={amount}
        amountUsd={amountUsd}
        leftButtonText={t("vote.edit")}
        onLeft={handleEdit}
        leftDisabled={isSubmitting}
        rightButtonText={
          isSubmitting
            ? t("vote.confirming")
            : t("voteIncentive.addIncentive")
        }
        onRight={handleConfirm}
        rightLoading={isSubmitting}
      />
    );
  }

  // success
  return (
    <SummaryStep
      title={t("voteIncentive.completeTitle")}
      description={
        <p className="leading-[21px]">
          {t("voteIncentive.completeDescription")}
        </p>
      }
      pool={pool}
      token={token}
      amount={amount}
      amountUsd={amountUsd}
      leftButtonText={t("vote.viewConfirmation")}
      onLeft={handleEdit /* no tx hash in off-chain flow — fall back */}
      leftDisabled
      rightButtonText={t("vote.goPortfolio")}
      onRight={handleGoPortfolio}
    />
  );
}
