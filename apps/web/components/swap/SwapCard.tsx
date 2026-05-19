"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";
import {
  useRegisteredTokens,
  type TokenInfo,
} from "@/hooks/useContractAddresses";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useSwapStore } from "@/lib/store";
import { TokenSelect } from "./TokenSelect";
import { SwapButton, type SwapStatus } from "./SwapButton";
import { SwapPending } from "./SwapPending";
import { SwapCompleted } from "./SwapCompleted";
import { SwapInfo } from "./SwapInfo";
import {
  SwapMobilePending,
  SwapMobileCompleted,
} from "./SwapMobileFlow";
import { useSwapInOut } from "@/hooks/useSwapInOut";
import { usePoolFees } from "@/hooks/usePoolFees";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, parseUnits } from "viem";
import { gatewayBrokerApi } from "@/lib/gatewayBrokerApi";
import { useSettingsStore, getDeadlineTimestamp } from "@/lib/store";
import { WGIWA_ADDRESS } from "@/lib/config";
import { LivePriceBadge } from "./LivePriceBadge";
import { showToast } from "@/components/common/NotificationToast";

function SwapToggleIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M8 4v16m0 0l-4-4m4 4l4-4M16 20V4m0 0l-4 4m4-4l4 4"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PercentIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12.6673 3.3335L3.33398 12.6668M5.66732 4.66683C5.66732 5.21912 5.21961 5.66683 4.66732 5.66683C4.11503 5.66683 3.66732 5.21912 3.66732 4.66683C3.66732 4.11455 4.11503 3.66683 4.66732 3.66683C5.21961 3.66683 5.66732 4.11455 5.66732 4.66683ZM12.334 11.3335C12.334 11.8858 11.8863 12.3335 11.334 12.3335C10.7817 12.3335 10.334 11.8858 10.334 11.3335C10.334 10.7812 10.7817 10.3335 11.334 10.3335C11.8863 10.3335 12.334 10.7812 12.334 11.3335Z"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SwapCard() {
  const { isConnected, address } = useAccount();
  const { slippage } = useSwapStore();
  const { deadlineMinutes } = useSettingsStore();
  const t = useTranslations();
  const tokens = useRegisteredTokens();

  // Default tokens (first two from registered tokens, null if not loaded yet)
  const defaultFromToken = useMemo(() => tokens[0] ?? null, [tokens]);
  const defaultToToken = useMemo(() => tokens[1] ?? null, [tokens]);

  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [fromAmount, setFromAmount] = useState("");

  // Percentage slider state
  const [showSlider, setShowSlider] = useState(false);
  const [sliderPercent, setSliderPercent] = useState(0);

  // Debounce fromAmount for quote fetching (400ms)
  const [debouncedFromAmount, setDebouncedFromAmount] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFromAmount(fromAmount);
    }, 400);
    return () => clearTimeout(timer);
  }, [fromAmount]);

  // Right panel state management.
  // `failed` renders the same SwapPending UI as `pending` (matches Figma 1448:25270
  // swap_fail where the panel stays visually identical to pending and a toast is shown).
  type RightPanelMode = "info" | "pending" | "completed" | "failed";
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>("info");
  const [swapTxHash, setSwapTxHash] = useState<string | undefined>();

  // Use selected tokens or fallback to defaults
  const activeFromToken = fromToken ?? defaultFromToken;
  const activeToToken = toToken ?? defaultToToken;
  const hasTokens = activeFromToken !== null && activeToToken !== null;

  const isNativeSelected = (tok: TokenInfo | null): boolean => {
    if (!tok) return false;
    // Current token catalog is ERC20-only; treat "GIWA" at WGIWA address as native intent.
    // Selecting the wrapped token should use symbol like "WGIWA" / "WETH" etc.
    return (
      tok.address.toLowerCase() === WGIWA_ADDRESS.toLowerCase() &&
      tok.symbol.trim().toUpperCase() === "GIWA"
    );
  };
  const fromIsNative = isNativeSelected(activeFromToken);
  const toIsNative = isNativeSelected(activeToToken);

  const { data: fromBalance, isLoading: isFromBalanceLoading, refetch: refetchFromBalance } = useTokenBalance({
    tokenAddress: (activeFromToken?.address ??
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
    decimals: activeFromToken?.decimals ?? 18,
    isNative: fromIsNative,
  });
  const { data: toBalance, refetch: refetchToBalance } = useTokenBalance({
    tokenAddress: (activeToToken?.address ??
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
    decimals: activeToToken?.decimals ?? 18,
    isNative: toIsNative,
  });
  const {
    isLoading: isQuoteLoading,
    isError,
    priceImpact,
    path,
    insufficientLiquidity,
    maxOutputReserve,
  } = useSwapInOut(
    (activeFromToken?.address ??
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
    (activeToToken?.address ??
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
    hasTokens ? debouncedFromAmount : "",
    activeFromToken?.decimals ?? 18,
    activeToToken?.decimals ?? 18,
  );

  const amountInWeiForRoutes =
    activeFromToken && debouncedFromAmount && parseFloat(debouncedFromAmount) > 0
      ? parseUnits(debouncedFromAmount, activeFromToken.decimals ?? 18).toString()
      : undefined;

  const { data: swapRouteInfo } = useQuery({
    queryKey: [
      "swap",
      "swap-routes",
      activeFromToken?.address,
      activeToToken?.address,
      amountInWeiForRoutes,
    ],
    queryFn: () =>
      gatewayBrokerApi.getSwapRoute({
        from: (activeFromToken?.address ?? "") as string,
        to: (activeToToken?.address ?? "") as string,
        amountInWei: amountInWeiForRoutes,
      }),
    enabled: !!(
      activeFromToken?.address &&
      activeToToken?.address &&
      amountInWeiForRoutes &&
      gatewayBrokerApi.isConfigured?.()
    ),
    staleTime: 10_000,
  });

  const amountOutMinWeiForTx =
    swapRouteInfo?.amountOutWei && swapRouteInfo.amountOutWei !== "0"
      ? ((BigInt(swapRouteInfo.amountOutWei) * BigInt(Math.max(0, 10_000 - Math.floor(slippage * 100)))) /
          10_000n
        ).toString()
      : undefined;

  const deadlineSec = getDeadlineTimestamp(deadlineMinutes);
  const deadlineSecStr = deadlineSec.toString();

  const { data: swapRouteTx } = useQuery({
    queryKey: [
      "swap",
      "swap-routes-tx",
      activeFromToken?.address,
      activeToToken?.address,
      amountInWeiForRoutes,
      amountOutMinWeiForTx,
      address,
      deadlineSecStr,
    ],
    queryFn: () =>
      gatewayBrokerApi.getSwapRouteTx({
        from: (activeFromToken?.address ?? "") as string,
        to: (activeToToken?.address ?? "") as string,
        amountInWei: amountInWeiForRoutes!,
        amountOutMinWei: amountOutMinWeiForTx!,
        recipient: address as string,
        deadline: deadlineSecStr,
        fromIsNative,
        toIsNative,
      }),
    enabled: !!(
      address &&
      activeFromToken?.address &&
      activeToToken?.address &&
      amountInWeiForRoutes &&
      amountOutMinWeiForTx &&
      gatewayBrokerApi.isConfigured?.()
    ),
    staleTime: 5_000,
  });

  // Get dynamic fees from contract
  const {
    fees: routeFees,
    totalFeePercent,
    totalFeeDisplay,
  } = usePoolFees(
    path,
    path?.map((r) => r.poolAddress),
  );

  // Prefer broker `/swap-routes` amountOutWei for UI when available.
  // Keep mapping consistent (in/out): fromAmount ↔ amountInWei, toAmount ↔ amountOutWei.
  const toAmount =
    swapRouteInfo?.amountOutWei &&
    activeToToken &&
    swapRouteInfo.amountOutWei !== "0"
      ? formatUnits(
          BigInt(swapRouteInfo.amountOutWei),
          activeToToken.decimals ?? 18,
        )
      : swapRouteInfo?.exchangeRate &&
          Number.isFinite(swapRouteInfo.exchangeRate) &&
          swapRouteInfo.exchangeRate > 0 &&
          fromAmount &&
          parseFloat(fromAmount) > 0
        ? (parseFloat(fromAmount) / swapRouteInfo.exchangeRate).toPrecision(12)
        : "";

  const isInsufficientBalance =
    fromAmount !== "" &&
    !isFromBalanceLoading &&
    !!activeFromToken &&
    parseFloat(fromAmount) > parseFloat(fromBalance ?? "0");

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return "0";
    if (num >= 1)
      return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return num.toPrecision(4);
  };

  // Sync slider percentage when fromAmount changes externally
  useEffect(() => {
    if (fromBalance && parseFloat(fromBalance) > 0 && fromAmount) {
      const percent = Math.round(
        (parseFloat(fromAmount) / parseFloat(fromBalance)) * 100,
      );
      setSliderPercent(Math.min(100, Math.max(0, percent)));
    } else if (!fromAmount) {
      setSliderPercent(0);
    }
  }, [fromAmount, fromBalance]);

  const handleSliderChange = (percent: number) => {
    setSliderPercent(percent);
    if (!fromBalance) return;
    const amount = (parseFloat(fromBalance) * percent) / 100;
    setFromAmount(amount > 0 ? amount.toString() : "");
    if (rightPanelMode !== "info") {
      setRightPanelMode("info");
    }
  };

  const toggleSlider = () => {
    setShowSlider(!showSlider);
    if (!showSlider && fromBalance && parseFloat(fromBalance) > 0) {
      const currentPercent = fromAmount
        ? Math.round((parseFloat(fromAmount) / parseFloat(fromBalance)) * 100)
        : 0;
      setSliderPercent(Math.min(100, Math.max(0, currentPercent)));
    }
  };

  const handleFromAmountChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setFromAmount(value);
      // Reset right panel to info when user starts entering a new amount
      if (rightPanelMode !== "info") {
        setRightPanelMode("info");
      }
    }
  };

  const handlePercentageClick = (percent: number) => {
    if (!fromBalance) return;
    const amount = parseFloat(fromBalance) * (percent / 100);
    if (amount > 0) {
      setFromAmount(amount.toString());
      if (rightPanelMode !== "info") {
        setRightPanelMode("info");
      }
    }
  };

  const handleFromTokenSelect = (token: TokenInfo) => {
    if (activeToToken && token.address.toLowerCase() === activeToToken.address.toLowerCase()) {
      setToToken(activeFromToken);
    }
    setFromToken(token);
  };

  const handleToTokenSelect = (token: TokenInfo) => {
    if (activeFromToken && token.address.toLowerCase() === activeFromToken.address.toLowerCase()) {
      setFromToken(activeToToken);
    }
    setToToken(token);
  };

  const handleSwapTokens = () => {
    const currentFrom = activeFromToken;
    const currentTo = activeToToken;
    setFromToken(currentTo);
    setToToken(currentFrom);
    // 입력값은 유지하고 방향만 반전 — quote는 토큰 변경에 의해 자동 re-fetch됨
  };

  const handleSwapSuccess = () => {
    // Reset form
    setFromAmount("");

    // Refetch balances
    refetchFromBalance();
    refetchToBalance();
  };

  const handleSwapStatusChange = useCallback(
    (status: SwapStatus, txHash?: string) => {
      if (status === "pending" || status === "confirming") {
        setRightPanelMode("pending");
        if (txHash) setSwapTxHash(txHash);
      } else if (status === "success") {
        setRightPanelMode("completed");
        if (txHash) setSwapTxHash(txHash);
      } else if (status === "error") {
        // Figma 1448:25270 — keep the pending-style panel visible and surface a
        // bottom-center toast with Retry. Both Retry and X return the user to the
        // form so they can adjust inputs or re-submit.
        setRightPanelMode("failed");
        const resetToForm = () => setRightPanelMode("info");
        showToast({
          message: t("swap.transactionFailedRetry"),
          retryLabel: t("swap.retry"),
          onRetry: resetToForm,
          onClose: resetToForm,
          duration: Infinity,
          id: "swap-failed",
        });
      }
    },
    [t],
  );

  const handleChangeClick = () => {
    setRightPanelMode("info");
  };

  const exchangeRate =
    fromAmount && toAmount && parseFloat(fromAmount) > 0 && parseFloat(toAmount) > 0
      ? (parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)
      : swapRouteInfo?.exchangeRate && Number.isFinite(swapRouteInfo.exchangeRate)
        ? (1 / swapRouteInfo.exchangeRate).toFixed(6)
        : "0.000000";

  const minimumReceived =
    fromAmount && parseFloat(toAmount) > 0 
      ? (parseFloat(toAmount) * (1 - slippage / 100)).toFixed(6)
      : "0";

  const hasInput =
    !!fromAmount && parseFloat(fromAmount) > 0 && !!toAmount && parseFloat(toAmount) > 0;
  const apiPriceImpact = swapRouteInfo?.routePriceImpactPercent ?? null;
  const priceImpactToShow =
    apiPriceImpact !== null && apiPriceImpact !== undefined && Number.isFinite(apiPriceImpact)
      ? apiPriceImpact
      : priceImpact;
  const highPriceImpactVisible = hasInput && priceImpactToShow >= 3;

  const routeFeesFromApi =
    swapRouteInfo?.hops && swapRouteInfo.hops.length > 0
      ? swapRouteInfo.hops.map((h) => ({
          route: { from: h.tokenIn as `0x${string}`, to: h.tokenOut as `0x${string}` },
          feeDisplay: `${(h.feeBps / 100).toFixed(2)}%`,
        }))
      : undefined;

  const avgFeeDisplayFromApi =
    swapRouteInfo?.averageFeeBps !== null &&
    swapRouteInfo?.averageFeeBps !== undefined &&
    Number.isFinite(swapRouteInfo.averageFeeBps)
      ? `${(swapRouteInfo.averageFeeBps / 100).toFixed(2)}%`
      : totalFeeDisplay;

  const totalFeeUsdDisplayFromApi =
    swapRouteInfo?.totalFeeUsd !== null &&
    swapRouteInfo?.totalFeeUsd !== undefined &&
    Number.isFinite(swapRouteInfo.totalFeeUsd)
      ? `~$${swapRouteInfo.totalFeeUsd.toFixed(2)}`
      : undefined;

  // Mobile-only: Buy box gets a green outline once a valid quote is in (Figma 811:11817).
  const buyQuoteValid =
    hasInput && !isInsufficientBalance && !insufficientLiquidity && !isError;

  // Error visualization (Figma 1446:21352 Swap_Error): when high price impact (≥3%),
  // both Sell and Buy input boxes flip to the red error palette. Sell also keeps its
  // pre-existing red treatment for insufficient balance.
  const sellHasError = isInsufficientBalance || highPriceImpactVisible;
  const buyHasError = highPriceImpactVisible;

  // Shared swap-detail bundle for mobile pending/completed views.
  const mobileSwapDetails = {
    fromToken: activeFromToken,
    toToken: activeToToken,
    fromAmount,
    toAmount,
    exchangeRate,
    minimumReceived,
    priceImpact: priceImpactToShow,
    tokens,
    routeFees: routeFeesFromApi ?? routeFees,
    totalFeePercent,
    totalFeeDisplay: avgFeeDisplayFromApi,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
      {/* Left Panel - Swap Input.
          On mobile, hide the form when the flow has moved to pending/completed —
          the mobile pending/completed view replaces the form entirely. */}
      <div
        className={`bg-white rounded-[20px] md:rounded-[40px] p-4 md:p-0 md:pb-[30px] shadow-sm flex-col gap-2.5 md:gap-[30px] ${
          rightPanelMode !== "info" ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Desktop-only page header with divider */}
        <div className="hidden md:flex flex-col gap-3 pt-[30px]">
          <div className="px-[30px] flex items-center gap-3">
            <h2 className="text-gray-100 heading-6">{t("swap.title")}</h2>
            {/* TODO: undo when Figma design is ready — testing WS live price only */}
            <LivePriceBadge
              pool={path?.[0]?.poolAddress}
              fromSymbol={activeFromToken?.symbol ?? ""}
              toSymbol={activeToToken?.symbol ?? ""}
            />
          </div>
          <div className="h-px w-full bg-gray-30" />
        </div>

        <div className="flex flex-col gap-2.5 md:gap-[9px] md:px-[30px]">
          {/* Sell Section */}
          <div className="flex flex-col gap-2.5 md:gap-0 md:pb-[48px] md:relative">
            <div className="flex items-center justify-between">
              <label className="text-gray-90 body-16-semibold">
                {t("swap.sell")}
              </label>
              <div className="flex items-center gap-2 md:gap-4">
                <span
                  className={`body-14-medium text-right ${
                    sellHasError ? "text-red-30" : "text-gray-90"
                  }`}
                >
                  {fromBalance ? formatBalance(fromBalance) : "0"}{" "}
                  {activeFromToken?.symbol ?? "---"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePercentageClick(50)}
                    disabled={!isConnected || !fromBalance}
                    className="px-2 py-1 rounded-[10px] bg-gray-30 text-gray-90 body-14-medium hover:bg-gray-40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    50%
                  </button>
                  <button
                    onClick={() => handlePercentageClick(100)}
                    disabled={!isConnected || !fromBalance}
                    className="px-2 py-1 rounded-[10px] bg-gray-30 text-gray-90 body-14-medium hover:bg-gray-40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    100%
                  </button>
                  <button
                    onClick={toggleSlider}
                    disabled={!isConnected}
                    aria-label="Toggle percentage slider"
                    className="bg-green-10 p-1.5 rounded-[10px] flex items-center justify-center transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PercentIcon />
                  </button>
                </div>
              </div>
            </div>
            {showSlider && (
              <div className="mt-2 px-2">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={sliderPercent}
                    onChange={(e) => handleSliderChange(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-30 rounded-lg appearance-none cursor-pointer accent-green-10"
                  />
                  <span className="w-12 text-right body-14-medium text-gray-80">
                    {sliderPercent}%
                  </span>
                </div>
              </div>
            )}
            <div
              className={`mt-2.5 rounded-[20px] flex items-center justify-between gap-3 px-5 py-2.5 md:p-[30px] ${
                sellHasError
                  ? "bg-red-10 border-2 border-red-20 md:border md:border-red-30"
                  : "bg-gray-20"
              }`}
            >
              <TokenSelect
                selectedToken={activeFromToken ?? undefined}
                onSelect={handleFromTokenSelect}
                size="sm"
              />
              <div className="flex-1 flex flex-col items-end min-w-0">
                <input
                  type="text"
                  value={fromAmount}
                  onChange={(e) => handleFromAmountChange(e.target.value)}
                  placeholder="0"
                  className={`w-full font-bold outline-none bg-transparent text-right leading-[30px] md:leading-[48px] text-[20px] md:text-[32px] placeholder:text-gray-50 ${
                    sellHasError ? "text-red-30" : "text-gray-90"
                  }`}
                  disabled={!hasTokens}
                />
                <div className="text-right body-12 md:body-14-medium text-gray-70">
                  ~$0
                </div>
              </div>
            </div>

            {/* Desktop: switch button is absolutely centered between Sell & Buy */}
            <div className="hidden md:flex justify-center absolute left-0 right-0 -bottom-[calc(24px-4.5px)] pointer-events-none">
              <button
                onClick={handleSwapTokens}
                disabled={!isConnected}
                aria-label="Swap tokens"
                className="pointer-events-auto p-2.5 rounded-full bg-green-10 hover:bg-green-20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[inset_0px_-1px_2px_0px_rgba(0,0,0,0.1),inset_0px_1px_1px_0px_rgba(255,255,255,0.6)]"
              >
                <SwapToggleIcon />
              </button>
            </div>
          </div>

          {/* Mobile: switch button between Sell/Buy, stacked vertically */}
          <div className="flex md:hidden justify-center">
            <button
              onClick={handleSwapTokens}
              disabled={!isConnected}
              aria-label="Swap tokens"
              className="p-2.5 rounded-full bg-green-10 hover:bg-green-20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[inset_0px_-1px_2px_0px_rgba(0,0,0,0.1),inset_0px_1px_1px_0px_rgba(255,255,255,0.6)]"
            >
              <SwapToggleIcon />
            </button>
          </div>

          {/* Buy Section */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-gray-90 body-16-semibold">
                {t("swap.buy")}
              </label>
              <div className="flex items-center gap-2 md:gap-4">
                <span
                  className={`body-14-medium text-right ${
                    buyHasError ? "text-red-30" : "text-gray-90"
                  }`}
                >
                  {toBalance ? formatBalance(toBalance) : "0"}{" "}
                  {activeToToken?.symbol ?? "---"}
                </span>
              </div>
            </div>
            <div
              className={`rounded-[20px] flex items-center justify-between gap-3 px-5 py-2.5 md:p-[30px] ${
                buyHasError
                  ? "bg-red-10 border-2 border-red-20 md:border md:border-red-30"
                  : buyQuoteValid
                    ? "bg-gray-20 border-2 border-green-10 md:border-0"
                    : "bg-gray-20"
              }`}
            >
              <TokenSelect
                selectedToken={activeToToken ?? undefined}
                onSelect={handleToTokenSelect}
                size="sm"
              />
              <div
                className={`flex-1 flex flex-col items-end min-w-0 transition-opacity duration-300 ${
                  isQuoteLoading ? "opacity-50" : "opacity-100"
                }`}
              >
                <input
                  type="text"
                  value={toAmount}
                  readOnly
                  placeholder="0"
                  className={`w-full font-bold outline-none bg-transparent text-right leading-[30px] md:leading-[48px] text-[20px] md:text-[32px] placeholder:text-gray-50 ${
                    buyHasError ? "text-red-30" : "text-gray-90"
                  }`}
                />
                <div className="text-right body-12 md:body-14-medium text-gray-70">
                  ~$0
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error messages — respect desktop card inner padding */}
        {((insufficientLiquidity && fromAmount && parseFloat(fromAmount) > 0) ||
          (isError && !insufficientLiquidity && fromAmount && parseFloat(fromAmount) > 0)) && (
          <div className="md:px-[30px]">
            {insufficientLiquidity && fromAmount && parseFloat(fromAmount) > 0 && (
              <div className="p-3 bg-orange-100/10 border border-orange-100/20 rounded-xl text-orange-100 body-14">
                ⚠️{" "}
                {maxOutputReserve
                  ? t("swap.insufficientLiquidityWithReserve", {
                      reserve: maxOutputReserve.amount.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      }),
                      symbol: maxOutputReserve.symbol,
                    })
                  : t("swap.insufficientLiquidity")}
              </div>
            )}

            {isError &&
              !insufficientLiquidity &&
              fromAmount &&
              parseFloat(fromAmount) > 0 && (
                <div className="mt-2 p-3 bg-orange-100/10 border border-orange-100/20 rounded-xl text-orange-100 body-14">
                  ⚠️ {t("swap.noQuoteError")}
                </div>
              )}
          </div>
        )}
      </div>

      {/* Right Panel - Swap Info / Pending / Completed */}
      <div className="flex flex-col min-w-0">
        {/* SwapInfo (always mounted to preserve SwapButton wagmi state) */}
        <div className={rightPanelMode === "info" ? "" : "hidden"}>
          <SwapInfo
            hasInput={hasInput}
            fromAmount={fromAmount}
            toAmount={toAmount}
            activeFromToken={activeFromToken}
            activeToToken={activeToToken}
            tokens={tokens}
            exchangeRate={exchangeRate}
            minimumReceived={minimumReceived}
            priceImpact={priceImpactToShow}
            routeFees={routeFeesFromApi ?? routeFees}
            totalFeePercent={totalFeePercent}
            totalFeeDisplay={avgFeeDisplayFromApi}
            averageFeeBps={swapRouteInfo?.averageFeeBps ?? null}
            totalFeeUsdDisplay={totalFeeUsdDisplayFromApi}
            isQuoteLoading={isQuoteLoading}
            highPriceImpactVisible={highPriceImpactVisible}
            swapButton={
              <SwapButton
                fromToken={activeFromToken ?? undefined}
                toToken={activeToToken ?? undefined}
                fromAmount={fromAmount}
                minimumReceived={minimumReceived}
                routes={path || []}
                routerTx={swapRouteTx?.tx as any}
                insufficientLiquidity={insufficientLiquidity}
                onSwapSuccess={handleSwapSuccess}
                onStatusChange={handleSwapStatusChange}
              />
            }
          />
        </div>

        {(rightPanelMode === "pending" || rightPanelMode === "failed") && (
          <>
            <div className="hidden md:flex bg-white rounded-[40px] p-[30px] shadow-sm flex-col">
              <SwapPending onChangeClick={handleChangeClick} />
            </div>
            <div className="md:hidden">
              <SwapMobilePending
                details={mobileSwapDetails}
                onCancel={handleChangeClick}
              />
            </div>
          </>
        )}
        {rightPanelMode === "completed" && swapTxHash && (
          <>
            <div className="hidden md:flex bg-white rounded-[40px] p-[30px] shadow-sm flex-col">
              <SwapCompleted txHash={swapTxHash} />
            </div>
            <div className="md:hidden">
              <SwapMobileCompleted
                details={mobileSwapDetails}
                txHash={swapTxHash}
                onClose={handleChangeClick}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
