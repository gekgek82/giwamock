"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useTokenByAddress } from "@/hooks/useContractAddresses";
import { TokenIcon } from "@/components/common/TokenIcon";

interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
}

interface TokenDepositInputsProps {
  token0: TokenInfo;
  token1: TokenInfo;
  amount0: string;
  amount1: string;
  onAmount0Change: (value: string) => void;
  onAmount1Change: (value: string) => void;
  onTokenSwitch?: () => void;
  slippage?: number;
  onSlippageChange?: (value: number) => void;
  isAutoSlippage?: boolean;
  onAutoSlippageChange?: (isAuto: boolean) => void;
  /**
   * Capital allocation ratio for the current tick range — the single source of
   * truth for the "Deposit Ratio" display. When omitted the component falls
   * back to USD-based computation from the entered amounts.
   */
  depositRatio?: { ratio0: number; ratio1: number };
  /** Lock token0 input: the current range expects 0% token0 (above range). */
  disableToken0?: boolean;
  /** Lock token1 input: the current range expects 0% token1 (below range). */
  disableToken1?: boolean;
  /**
   * Optional "Deposit price range" value shown in the summary row. Basic pools
   * pass "Full Range" here since they always cover 0 → ∞; concentrated pools
   * surface the range via the PriceRangeSelector card instead and omit this.
   */
  depositPriceRangeLabel?: string;
  /**
   * Extra content rendered inside the same white card, below the summary.
   * Basic pools pack the liquidity-lock section and action row here so
   * everything shares the 40px-rounded card.
   */
  children?: React.ReactNode;
}

const PRESET_SLIPPAGES = [0.5, 1, 3, 5];
const AUTO_SLIPPAGE_VALUE = 0.5; // Auto mode uses 0.5% as default

// Mock data indicator badge
function MockDataBadge({ label }: { label: string }) {
  return (
    <span
      className="ml-1 px-1.5 py-0.5 text-[10px] bg-yellow-100 text-yellow-700 rounded font-medium"
      title="Mock data - not real"
    >
      {label}
    </span>
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

export function TokenDepositInputs({
  token0,
  token1,
  amount0,
  amount1,
  onAmount0Change,
  onAmount1Change,
  slippage: externalSlippage,
  onSlippageChange,
  isAutoSlippage: externalIsAuto,
  onAutoSlippageChange,
  depositRatio,
  disableToken0 = false,
  disableToken1 = false,
  depositPriceRangeLabel,
  children,
}: TokenDepositInputsProps) {
  const t = useTranslations();
  // Sticker URLs from token registry
  const token0Data = useTokenByAddress(token0.address);
  const token1Data = useTokenByAddress(token1.address);
  const sticker0 = token0Data?.stickerUrl;
  const sticker1 = token1Data?.stickerUrl;
  // Internal slippage state (used if not controlled externally)
  const [internalSlippage, setInternalSlippage] = useState(AUTO_SLIPPAGE_VALUE);
  const [internalIsAuto, setInternalIsAuto] = useState(true); // Default to Auto
  const [isSlippageModalOpen, setIsSlippageModalOpen] = useState(false);
  const [customSlippageInput, setCustomSlippageInput] = useState("");

  // Use external state if provided, otherwise use internal
  const slippage = externalSlippage ?? internalSlippage;
  const isAutoSlippage = externalIsAuto ?? internalIsAuto;

  const setSlippage = (value: number) => {
    if (onSlippageChange) {
      onSlippageChange(value);
    } else {
      setInternalSlippage(value);
    }
  };

  const setIsAuto = (value: boolean) => {
    if (onAutoSlippageChange) {
      onAutoSlippageChange(value);
    } else {
      setInternalIsAuto(value);
    }
  };

  // Check if current slippage is a custom value (not in presets and not auto)
  const isCustom = useMemo(() => {
    if (isAutoSlippage) return false;
    return customSlippageInput !== "" || !PRESET_SLIPPAGES.includes(slippage);
  }, [customSlippageInput, slippage, isAutoSlippage]);

  const handleAutoClick = () => {
    setIsAuto(true);
    setSlippage(AUTO_SLIPPAGE_VALUE);
    setCustomSlippageInput("");
  };

  const handleCustomSlippageChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setCustomSlippageInput(value);
      setIsAuto(false); // Switch to manual mode when user types
      if (value && !isNaN(parseFloat(value))) {
        setSlippage(parseFloat(value));
      }
    }
  };

  const handlePresetClick = (value: number) => {
    setIsAuto(false); // Switch to manual mode
    setSlippage(value);
    setCustomSlippageInput("");
  };

  // Percentage slider state for each token
  const [showSlider0, setShowSlider0] = useState(false);
  const [showSlider1, setShowSlider1] = useState(false);
  const [sliderPercent0, setSliderPercent0] = useState(50);
  const [sliderPercent1, setSliderPercent1] = useState(50);

  // Real data: wallet connection status
  const { isConnected } = useAccount();

  // Real data: token balances from wallet
  const { data: balance0, isLoading: isLoadingBalance0 } = useTokenBalance({
    tokenAddress: token0.address,
    decimals: token0.decimals,
  });
  const { data: balance1, isLoading: isLoadingBalance1 } = useTokenBalance({
    tokenAddress: token1.address,
    decimals: token1.decimals,
  });

  // Sync slider percentage when amount changes externally
  useEffect(() => {
    if (balance0 && parseFloat(balance0) > 0 && amount0) {
      const percent = Math.round(
        (parseFloat(amount0) / parseFloat(balance0)) * 100,
      );
      setSliderPercent0(Math.min(100, Math.max(0, percent)));
    } else if (!amount0) {
      setSliderPercent0(0);
    }
  }, [amount0, balance0]);

  useEffect(() => {
    if (balance1 && parseFloat(balance1) > 0 && amount1) {
      const percent = Math.round(
        (parseFloat(amount1) / parseFloat(balance1)) * 100,
      );
      setSliderPercent1(Math.min(100, Math.max(0, percent)));
    } else if (!amount1) {
      setSliderPercent1(0);
    }
  }, [amount1, balance1]);

  // Token prices (may be mock if indexer not configured)
  const { prices, isMockData: isPriceMockData } = useTokenPrices([
    token0.symbol,
    token1.symbol,
  ]);

  // Calculate USD values using real or mock prices
  const usdValue0 = useMemo(() => {
    if (!amount0) return 0;
    const price = prices[token0.symbol] ?? 0;
    return parseFloat(amount0) * price;
  }, [amount0, token0.symbol, prices]);

  const usdValue1 = useMemo(() => {
    if (!amount1) return 0;
    const price = prices[token1.symbol] ?? 0;
    return parseFloat(amount1) * price;
  }, [amount1, token1.symbol, prices]);

  const totalDeposit = usdValue0 + usdValue1;

  // Deposit ratio: prefer the tick-range-derived ratio passed in from the
  // parent (single source of truth, agrees with the "In Range" badge). Only
  // fall back to USD shares when we don't have range info — this avoids
  // confusing 0/100 readings when one of the auto-computed amounts blows up
  // near the tick boundary.
  const ratio0 = useMemo(() => {
    if (depositRatio) return (depositRatio.ratio0 * 100).toFixed(1);
    return totalDeposit > 0 ? ((usdValue0 / totalDeposit) * 100).toFixed(1) : "0";
  }, [depositRatio, usdValue0, totalDeposit]);

  const ratio1 = useMemo(() => {
    if (depositRatio) return (depositRatio.ratio1 * 100).toFixed(1);
    return totalDeposit > 0 ? ((usdValue1 / totalDeposit) * 100).toFixed(1) : "0";
  }, [depositRatio, usdValue1, totalDeposit]);

  // Check if amounts exceed balance
  const isExceedingBalance0 = useMemo(() => {
    if (!amount0 || !balance0) return false;
    return parseFloat(amount0) > parseFloat(balance0);
  }, [amount0, balance0]);

  const isExceedingBalance1 = useMemo(() => {
    if (!amount1 || !balance1) return false;
    return parseFloat(amount1) > parseFloat(balance1);
  }, [amount1, balance1]);

  const handleAmount0Change = (value: string) => {
    if (disableToken0) return;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      onAmount0Change(value);
    }
  };

  const handleAmount1Change = (value: string) => {
    if (disableToken1) return;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      onAmount1Change(value);
    }
  };

  const handleMax0 = () => {
    if (disableToken0) return;
    onAmount0Change(balance0);
  };

  const handleMax1 = () => {
    if (disableToken1) return;
    onAmount1Change(balance1);
  };

  const handleHalf0 = () => {
    if (disableToken0) return;
    onAmount0Change((parseFloat(balance0) / 2).toString());
  };

  const handleHalf1 = () => {
    if (disableToken1) return;
    onAmount1Change((parseFloat(balance1) / 2).toString());
  };

  // Handle percentage slider for token 0
  const handleSliderChange0 = (percent: number) => {
    setSliderPercent0(percent);
    const amount = ((parseFloat(balance0) * percent) / 100).toString();
    onAmount0Change(amount);
  };

  // Handle percentage slider for token 1
  const handleSliderChange1 = (percent: number) => {
    setSliderPercent1(percent);
    const amount = ((parseFloat(balance1) * percent) / 100).toString();
    onAmount1Change(amount);
  };

  // Toggle slider visibility for token 0
  const toggleSlider0 = () => {
    setShowSlider0(!showSlider0);
    if (!showSlider0) {
      // When opening, calculate current percentage
      const currentPercent =
        balance0 && parseFloat(balance0) > 0
          ? Math.round(
              (parseFloat(amount0 || "0") / parseFloat(balance0)) * 100,
            )
          : 0;
      setSliderPercent0(Math.min(100, Math.max(0, currentPercent)));
    }
  };

  // Toggle slider visibility for token 1
  const toggleSlider1 = () => {
    setShowSlider1(!showSlider1);
    if (!showSlider1) {
      // When opening, calculate current percentage
      const currentPercent =
        balance1 && parseFloat(balance1) > 0
          ? Math.round(
              (parseFloat(amount1 || "0") / parseFloat(balance1)) * 100,
            )
          : 0;
      setSliderPercent1(Math.min(100, Math.max(0, currentPercent)));
    }
  };

  const renderTokenInputBox = (
    side: 0 | 1,
  ) => {
    const isSide0 = side === 0;
    const token = isSide0 ? token0 : token1;
    const amount = isSide0 ? amount0 : amount1;
    const disabled = isSide0 ? disableToken0 : disableToken1;
    const isExceeding = isSide0 ? isExceedingBalance0 : isExceedingBalance1;
    const sticker = isSide0 ? sticker0 : sticker1;
    const onAmountChange = isSide0 ? handleAmount0Change : handleAmount1Change;
    const usd = isSide0 ? usdValue0 : usdValue1;
    const showSliderState = isSide0 ? showSlider0 : showSlider1;

    return (
      <>
        {showSliderState && (
          <div className="px-2">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={isSide0 ? sliderPercent0 : sliderPercent1}
                onChange={(e) =>
                  isSide0
                    ? handleSliderChange0(Number(e.target.value))
                    : handleSliderChange1(Number(e.target.value))
                }
                className="flex-1 h-2 bg-gray-30 rounded-lg appearance-none cursor-pointer accent-green-10"
              />
              <span className="w-12 text-right body-14-medium text-gray-80">
                {isSide0 ? sliderPercent0 : sliderPercent1}%
              </span>
            </div>
          </div>
        )}
        <div
          className={`rounded-[20px] flex items-center justify-between gap-3 px-[20px] py-[16px] md:px-[30px] md:py-[20px] ${
            isExceeding
              ? "bg-red-10 border border-red-30"
              : disabled
              ? "bg-gray-20 opacity-60"
              : "bg-gray-20"
          }`}
        >
          {/* Token Selector */}
          <button className="shrink-0 flex items-center gap-2.5 p-2 md:p-4 bg-white rounded-full transition-colors hover:bg-gray-10">
            <TokenIcon
              address={token.address}
              symbol={token.symbol}
              size={24}
            />
            <span className="body-16-semibold text-gray-100 flex items-center gap-1">
              {token.symbol}
              {sticker && (
                <Image
                  src={sticker}
                  alt="sticker"
                  width={18}
                  height={18}
                  className="object-contain"
                />
              )}
            </span>
            <svg
              className="w-6 h-6 text-gray-90"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Amount Input */}
          <div className="flex-1 min-w-0 text-right">
            <input
              type="text"
              value={disabled ? "0" : amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0"
              className={`w-full text-right font-bold bg-transparent outline-none placeholder:text-gray-50 disabled:cursor-not-allowed text-[20px] md:text-[24px] leading-[30px] md:leading-[36px] ${
                isExceeding ? "text-red-40" : "text-gray-100"
              }`}
              disabled={!isConnected || disabled}
            />
            <div
              className={`body-12 md:body-14-medium flex items-center justify-end ${
                isExceeding ? "text-red-40" : "text-gray-80"
              }`}
            >
              ~$
              {usd.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
              {isPriceMockData && <MockDataBadge label="MOCK" />}
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="bg-white rounded-[20px] md:rounded-[40px] p-4 md:p-[30px] h-full flex flex-col gap-5">
      {/* Token Inputs (relative for absolute-centered plus button on md+) */}
      <div className="flex flex-col gap-2.5 md:gap-[30px] md:relative">
        {/* Token 1 Input */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-end justify-between">
            <span className="body-16-semibold text-gray-100">
              {t("deposit.token1")}
            </span>
            <div className="flex items-center gap-2 md:gap-4">
              <span className="body-14-medium text-gray-90 text-right">
                {isLoadingBalance0 ? "..." : parseFloat(balance0).toFixed(4)}{" "}
                {token0.symbol}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleHalf0}
                  disabled={!isConnected || disableToken0}
                  className="px-2 py-1 rounded-[10px] bg-gray-30 text-gray-90 body-14-medium hover:bg-gray-40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  50%
                </button>
                <button
                  onClick={handleMax0}
                  disabled={!isConnected || disableToken0}
                  className="px-2 py-1 rounded-[10px] bg-gray-30 text-gray-90 body-14-medium hover:bg-gray-40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  100%
                </button>
                <button
                  onClick={toggleSlider0}
                  disabled={!isConnected || disableToken0}
                  aria-label="Toggle percentage slider"
                  className="rounded-[10px] transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PercentIcon />
                </button>
              </div>
            </div>
          </div>
          {renderTokenInputBox(0)}
          {disableToken0 && !isExceedingBalance0 && (
            <div className="body-12 text-gray-60">
              {t("deposit.tokenNotRequiredForRange", { symbol: token0.symbol })}
            </div>
          )}
          {isExceedingBalance0 && (
            <div className="flex items-center gap-1 text-red-40 body-12">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{t("errors.insufficientBalance")}</span>
            </div>
          )}
        </div>

        {/* Plus Button between tokens */}
        <div className="flex justify-center md:absolute md:left-0 md:right-0 md:top-1/2 md:-translate-y-1/2 md:pointer-events-none">
          <div className="md:pointer-events-auto p-2.5 rounded-full bg-green-10 shadow-[inset_0px_-1px_2px_0px_rgba(0,0,0,0.1),inset_0px_1px_1px_0px_rgba(255,255,255,0.6)]">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M12 5v14M5 12h14"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Token 2 Input */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-end justify-between">
            <span className="body-16-semibold text-gray-100">
              {t("deposit.token2")}
            </span>
            <div className="flex items-center gap-2 md:gap-4">
              <span className="body-14-medium text-gray-90 text-right">
                {isLoadingBalance1 ? "..." : parseFloat(balance1).toFixed(4)}{" "}
                {token1.symbol}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleHalf1}
                  disabled={!isConnected || disableToken1}
                  className="px-2 py-1 rounded-[10px] bg-gray-30 text-gray-90 body-14-medium hover:bg-gray-40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  50%
                </button>
                <button
                  onClick={handleMax1}
                  disabled={!isConnected || disableToken1}
                  className="px-2 py-1 rounded-[10px] bg-gray-30 text-gray-90 body-14-medium hover:bg-gray-40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  100%
                </button>
                <button
                  onClick={toggleSlider1}
                  disabled={!isConnected || disableToken1}
                  aria-label="Toggle percentage slider"
                  className="rounded-[10px] transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PercentIcon />
                </button>
              </div>
            </div>
          </div>
          {renderTokenInputBox(1)}
          {disableToken1 && !isExceedingBalance1 && (
            <div className="body-12 text-gray-60">
              {t("deposit.tokenNotRequiredForRange", { symbol: token1.symbol })}
            </div>
          )}
          {isExceedingBalance1 && (
            <div className="flex items-center gap-1 text-red-40 body-12">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{t("errors.insufficientBalance")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Summary Section */}
      <div className="flex flex-col gap-3.5">
        {/* Total Deposit */}
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <span className="body-16-semibold text-gray-90">
              {t("deposit.totalDeposit")}
            </span>
            {isPriceMockData && <MockDataBadge label="MOCK" />}
          </div>
          <span className="heading-6 text-gray-100 text-right">
            $
            {totalDeposit.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </span>
        </div>

        {/* Deposit Ratio */}
        <div className="flex justify-between items-center">
          <span className="body-16-semibold text-gray-90">
            {t("deposit.depositRatio")}
          </span>
          <span className="heading-6 text-gray-100 text-right">
            {ratio0}% / {ratio1}%
          </span>
        </div>

        {/* Deposit Price Range (basic pool only — concentrated shows its
            range via the PriceRangeSelector card) */}
        {depositPriceRangeLabel && (
          <div className="flex justify-between items-center">
            <span className="body-16-semibold text-gray-90">
              {t("deposit.depositPriceRange")}
            </span>
            <span className="heading-6 text-gray-100 text-right">
              {depositPriceRangeLabel}
            </span>
          </div>
        )}

        {/* Slippage */}
        <div className="flex justify-between items-center">
          <span className="body-16-semibold text-gray-90">
            {t("swap.slippage")}
          </span>
          <div className="relative">
            <button
              onClick={() => setIsSlippageModalOpen(true)}
              className="flex items-center gap-2 px-2 py-1.5 bg-gray-30 hover:bg-gray-40 rounded-[10px] text-gray-100 body-14-medium transition-colors"
            >
              {isAutoSlippage ? t("deposit.auto") : `${slippage}%`}
              <svg
                className="w-4 h-4 text-gray-90"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Extra content packed into the same card (basic pool — lock settings,
          warning, action row). Concentrated pool leaves this empty and falls
          through to the flex-1 spacer. */}
      {children}

      {/* Spacer — pushes slippage modal anchors to bottom on tall cards. Only
          applies when no children are provided; basic-pool content flows
          naturally without it. */}
      {!children && <div className="flex-1" />}

      {/* Slippage Modal */}
      {isSlippageModalOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center"
          onClick={() => setIsSlippageModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-neutral-1000 heading-6">
                {t("swap.slippageTitle")}
              </h3>
              <button
                onClick={() => setIsSlippageModalOpen(false)}
                className="text-neutral-600 hover:text-neutral-900 transition-all"
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

            {/* Description */}
            <p className="text-neutral-700 body-14 mb-6 leading-relaxed">
              {t("deposit.slippageDepositDescription")}
            </p>

            {/* Custom Input */}
            <div
              className={`mb-4 rounded-xl p-4 flex items-center gap-2 border ${
                isAutoSlippage
                  ? "bg-neutral-100 border-neutral-200"
                  : "bg-primary-200 border-primary-300"
              }`}
            >
              <input
                type="text"
                value={isAutoSlippage ? "" : customSlippageInput || slippage}
                onChange={(e) => handleCustomSlippageChange(e.target.value)}
                placeholder={isAutoSlippage ? t("deposit.auto") : "1"}
                className="flex-1 bg-transparent text-neutral-1000 heading-4 outline-none placeholder:text-neutral-500"
              />
              <span className="text-neutral-1000 heading-5">%</span>
            </div>

            {/* Preset Buttons with Auto */}
            <div className="flex gap-2">
              {/* Auto Button */}
              <button
                onClick={handleAutoClick}
                className={`flex-1 py-2.5 rounded-lg body-14-medium transition-all ${
                  isAutoSlippage
                    ? "bg-primary-800 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-300"
                }`}
              >
                {t("deposit.auto")}
              </button>
              {PRESET_SLIPPAGES.map((value) => (
                <button
                  key={value}
                  onClick={() => handlePresetClick(value)}
                  className={`flex-1 py-2.5 rounded-lg body-14-medium transition-all ${
                    slippage === value && !isAutoSlippage && !isCustom
                      ? "bg-primary-800 text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-300"
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>

            {/* Warning for high slippage */}
            {slippage > 5 && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl text-orange-700 body-14">
                ⚠️ {t("deposit.slippageWarningHighDeposit")}
              </div>
            )}

            {/* Warning for low slippage */}
            {slippage < 0.5 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-700 body-14">
                ⚠️ {t("deposit.slippageWarningLow")}
              </div>
            )}

            {/* Confirm Button */}
            <button
              onClick={() => setIsSlippageModalOpen(false)}
              className="w-full mt-6 py-3 bg-primary-100 hover:bg-primary-200 text-neutral-1000 rounded-xl body-16-bold transition-colors"
            >
              {t("common.confirm")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
