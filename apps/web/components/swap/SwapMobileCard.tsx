"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useAccount } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { useQuery } from "@tanstack/react-query";
import { TokenSelect } from "./TokenSelect";
import { SwapButton, type SwapStatus } from "./SwapButton";
import {
  SwapMobilePending,
  SwapMobileCompleted,
  SwapMobileConfirm,
} from "./SwapMobileFlow";
import { useTranslations } from "next-intl";
import { SlippageSettings } from "./SlippageSettings";
import {
  useRegisteredTokens,
  type TokenInfo,
} from "@/hooks/useContractAddresses";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useSwapInOut } from "@/hooks/useSwapInOut";
import { usePoolFees } from "@/hooks/usePoolFees";
import {
  useSwapStore,
  useSettingsStore,
  getDeadlineTimestamp,
} from "@/lib/store";
import { gatewayBrokerApi } from "@/lib/gatewayBrokerApi";
import { WGIWA_ADDRESS } from "@/lib/config";

// ---- Icons -----------------------------------------------------------------

function ChevronDownIcon({ className = "size-6" }: { className?: string }) {
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
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function PercentIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M13.333 2.667 2.667 13.333"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle
        cx="4.333"
        cy="4.333"
        r="1.667"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="11.667"
        cy="11.667"
        r="1.667"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SwitchVerticalIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 4v16m0 0-4-4m4 4 4-4M16 20V4m0 0-4 4m4-4 4 4" />
    </svg>
  );
}

function InfoIcon({ className = "size-4" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full bg-gray-30 ${className}`}
    >
      <svg
        viewBox="0 0 12 12"
        className="size-2 text-gray-90"
        fill="currentColor"
      >
        <circle cx="6" cy="2.5" r="1" />
        <rect x="5.25" y="4.5" width="1.5" height="6" rx="0.6" />
      </svg>
    </span>
  );
}

function AlertTriangleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 2.667 1.333 14h13.334L8 2.667Z" />
      <path d="M8 6.667v3" />
      <circle cx="8" cy="11.667" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ---- AmountField -----------------------------------------------------------

interface AmountFieldProps {
  label: "Sell" | "Buy";
  token: TokenInfo | null;
  onTokenSelect?: (token: TokenInfo) => void;
  balanceLabel: string;
  amount: string;
  onAmountChange?: (next: string) => void;
  onPercentClick?: (percent: number) => void;
  onSliderToggle?: () => void;
  sliderExpanded?: boolean;
  sliderPercent?: number;
  onSliderChange?: (percent: number) => void;
  readonly?: boolean;
  highlight?: "none" | "error" | "valid";
  approxUsd: string;
  approxUsdEmphasis?: boolean;
  isLoading?: boolean;
}

function AmountField({
  label,
  token,
  onTokenSelect,
  balanceLabel,
  amount,
  onAmountChange,
  onPercentClick,
  onSliderToggle,
  sliderExpanded = false,
  sliderPercent = 0,
  onSliderChange,
  readonly = false,
  highlight = "none",
  approxUsd,
  approxUsdEmphasis = false,
  isLoading = false,
}: AmountFieldProps) {
  const containerHighlightClass =
    highlight === "error"
      ? "bg-red-10 border-2 border-red-20"
      : highlight === "valid"
        ? "bg-gray-20 border-2 border-green-10"
        : "bg-gray-20 border-2 border-transparent";

  const amountTextClass =
    highlight === "error" && readonly ? "text-red-30" : "text-gray-90";

  return (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="body-16-semibold text-gray-90">{label}</span>
        <div className="flex items-center gap-2.5">
          <span className="body-14-medium text-gray-90 text-right">
            {balanceLabel} {token?.symbol ?? "---"}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPercentClick?.(50)}
              className="px-2 py-1 rounded-[10px] bg-gray-30 text-gray-90 body-14-medium leading-[21px] hover:bg-gray-40 transition-colors disabled:opacity-50"
              disabled={readonly}
              aria-label={`Use 50% of ${token?.symbol ?? ""} balance`}
            >
              50%
            </button>
            <button
              type="button"
              onClick={() => onPercentClick?.(100)}
              className="px-2 py-1 rounded-[10px] bg-gray-30 text-gray-90 body-14-medium leading-[21px] hover:bg-gray-40 transition-colors disabled:opacity-50"
              disabled={readonly}
              aria-label={`Use 100% of ${token?.symbol ?? ""} balance`}
            >
              100%
            </button>
            <button
              type="button"
              onClick={onSliderToggle}
              className={`p-1.5 rounded-[10px] text-white shadow-[inset_0px_-1px_2px_0px_rgba(0,0,0,0.1),inset_0px_1px_1px_0px_rgba(255,255,255,0.6)] disabled:opacity-50 ${
                sliderExpanded ? "bg-green-20" : "bg-green-10"
              }`}
              disabled={readonly}
              aria-label="Use a custom percentage of balance"
              aria-expanded={sliderExpanded}
            >
              <PercentIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>
      {sliderExpanded && !readonly ? (
        <div className="flex items-center gap-3 px-2">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={sliderPercent}
            onChange={(e) => onSliderChange?.(Number(e.target.value))}
            aria-label={`${label} amount as percentage of balance`}
            className="flex-1 h-2 bg-gray-30 rounded-lg appearance-none cursor-pointer accent-green-10"
          />
          <span className="w-10 text-right body-14-medium text-gray-80 tabular-nums">
            {sliderPercent}%
          </span>
        </div>
      ) : null}
      <div
        className={`flex items-center justify-between gap-3 px-5 py-2.5 rounded-[20px] ${containerHighlightClass}`}
      >
        {onTokenSelect ? (
          <TokenSelect
            selectedToken={token ?? undefined}
            onSelect={onTokenSelect}
            size="sm"
          />
        ) : (
          <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-white shrink-0">
            <span className="body-14-bold text-gray-90 leading-[21px]">
              {token?.symbol ?? "---"}
            </span>
          </div>
        )}
        <div
          className={`flex flex-col items-end min-w-0 flex-1 transition-opacity duration-200 ${
            isLoading ? "opacity-50" : "opacity-100"
          }`}
        >
          {readonly ? (
            <span
              className={`w-full text-right font-bold leading-[30px] text-[20px] truncate ${amountTextClass}`}
            >
              {amount || "0"}
            </span>
          ) : (
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => onAmountChange?.(e.target.value)}
              placeholder="0"
              aria-label={`${label} amount`}
              className={`w-full bg-transparent text-right font-bold outline-none leading-[30px] text-[20px] placeholder:text-gray-50 ${amountTextClass}`}
            />
          )}
          <span
            className={`body-12 leading-[18px] font-medium text-right ${
              approxUsdEmphasis ? "text-gray-90" : "text-gray-70"
            }`}
          >
            {approxUsd}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---- SwapInfoRow -----------------------------------------------------------

interface SwapInfoRowProps {
  label: string;
  children: React.ReactNode;
}

function SwapInfoRow({ label, children }: SwapInfoRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 w-full">
      <div className="flex items-center gap-1 shrink-0">
        <span className="body-12 font-medium text-gray-90 leading-[18px] whitespace-nowrap">
          {label}
        </span>
        <InfoIcon />
      </div>
      <div className="flex items-center gap-1 justify-end min-w-0">
        {children}
      </div>
    </div>
  );
}

// ---- SwapInfoCard ----------------------------------------------------------

interface RouteFeeInfo {
  route: { from: string; to: string };
  feeDisplay: string;
}

interface SwapInfoCardProps {
  routeFees?: RouteFeeInfo[];
  tokens: TokenInfo[];
  fromSymbol: string;
  toSymbol: string;
  exchangeRate: string;
  minimumReceived: string;
  priceImpactPercent: number;
  totalFeeUsdDisplay: string;
  avgFeeRateDisplay: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  hasInput: boolean;
  isQuoteLoading?: boolean;
}

function SwapInfoCard({
  routeFees,
  tokens,
  fromSymbol,
  toSymbol,
  exchangeRate,
  minimumReceived,
  priceImpactPercent,
  totalFeeUsdDisplay,
  avgFeeRateDisplay,
  expanded,
  onToggleExpanded,
  hasInput,
  isQuoteLoading = false,
}: SwapInfoCardProps) {
  const isHighRisk = hasInput && priceImpactPercent >= 3;
  const showRoute = hasInput && routeFees && routeFees.length > 0;

  const getTokenSymbol = (address: string) => {
    const tok = tokens.find(
      (t) => t.address.toLowerCase() === address.toLowerCase(),
    );
    return tok?.symbol ?? "???";
  };

  return (
    <div
      className={`bg-white rounded-[20px] px-4 py-2.5 flex flex-col items-center gap-2 w-full transition-opacity duration-300 ${
        isQuoteLoading ? "opacity-50" : "opacity-100"
      }`}
    >
      <div className="flex flex-col gap-3 w-full">
        {/* Swap Route */}
        <div className="flex items-start justify-between w-full gap-2">
          <div className="flex items-center gap-1 shrink-0">
            <span className="body-12 font-medium text-gray-90 leading-[18px]">
              Swap Route
            </span>
            <InfoIcon />
          </div>
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

        {/* Exchange Rate */}
        <SwapInfoRow label="Exchange rate">
          <span className="body-12-bold text-gray-90 leading-[18px] text-right whitespace-nowrap">
            {hasInput
              ? `1 ${fromSymbol} = ${exchangeRate} ${toSymbol}`
              : "-"}
          </span>
        </SwapInfoRow>

        {/* Price Impact */}
        <SwapInfoRow label="Price impact">
          {isHighRisk ? (
            <span className="px-1 py-0.5 rounded-[20px] bg-red-30 text-gray-10 text-[10px] leading-tight font-medium">
              High Risk
            </span>
          ) : null}
          <span
            className={`body-12-bold leading-[18px] ${
              isHighRisk ? "text-red-30" : "text-gray-90"
            }`}
          >
            {hasInput ? `${priceImpactPercent.toFixed(3)}%` : "-"}
          </span>
        </SwapInfoRow>

        {/* Minimum Received */}
        <SwapInfoRow label="Minimum received">
          <SlippageSettings />
          <span className="body-12-bold text-gray-90 leading-[18px] whitespace-nowrap">
            {hasInput ? `${minimumReceived} ${toSymbol}` : "-"}
          </span>
        </SwapInfoRow>

        {expanded ? (
          <>
            <SwapInfoRow label="Est. Total Fee">
              <span className="body-12-bold text-gray-90 leading-[18px]">
                {totalFeeUsdDisplay}
              </span>
            </SwapInfoRow>
            <SwapInfoRow label="Avg. Fee Rate">
              <span className="body-12-bold text-gray-90 leading-[18px]">
                {avgFeeRateDisplay}
              </span>
            </SwapInfoRow>
          </>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex items-center gap-1 mt-1 px-1 py-0.5 rounded-md text-black hover:bg-gray-20 transition-colors"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse swap details" : "Expand swap details"}
      >
        <span className="body-12 font-medium leading-[18px]">
          {expanded ? "Less" : "More"}
        </span>
        <ChevronDownIcon
          className={`size-4 transition-transform ${
            expanded ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>
    </div>
  );
}

// ---- SwapMobileCard --------------------------------------------------------

type SwapView = "form" | "confirming" | "pending" | "completed";

export function SwapMobileCard() {
  const { address } = useAccount();
  const { slippage } = useSwapStore();
  const { deadlineMinutes } = useSettingsStore();
  const tokens = useRegisteredTokens();
  const t = useTranslations();

  const defaultFromToken = useMemo(() => tokens[0] ?? null, [tokens]);
  const defaultToToken = useMemo(() => tokens[1] ?? null, [tokens]);

  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [sliderExpanded, setSliderExpanded] = useState(false);
  const [sliderPercent, setSliderPercent] = useState(0);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [view, setView] = useState<SwapView>("form");
  const [pendingFailed, setPendingFailed] = useState(false);
  const [swapTxHash, setSwapTxHash] = useState<string | undefined>();

  // Debounce fromAmount 400ms before fetching quote
  const [debouncedFromAmount, setDebouncedFromAmount] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFromAmount(fromAmount), 400);
    return () => clearTimeout(timer);
  }, [fromAmount]);

  const activeFromToken = fromToken ?? defaultFromToken;
  const activeToToken = toToken ?? defaultToToken;
  const hasTokens = activeFromToken !== null && activeToToken !== null;

  const isNativeSelected = (tok: TokenInfo | null): boolean =>
    !!tok &&
    tok.address.toLowerCase() === WGIWA_ADDRESS.toLowerCase() &&
    tok.symbol.trim().toUpperCase() === "GIWA";

  const fromIsNative = isNativeSelected(activeFromToken);
  const toIsNative = isNativeSelected(activeToToken);

  const { data: fromBalance, refetch: refetchFromBalance } = useTokenBalance({
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
    priceImpact,
    path,
    insufficientLiquidity,
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
      ? parseUnits(
          debouncedFromAmount,
          activeFromToken.decimals ?? 18,
        ).toString()
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
        from: activeFromToken?.address ?? "",
        to: activeToToken?.address ?? "",
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
      ? (
          (BigInt(swapRouteInfo.amountOutWei) *
            BigInt(Math.max(0, 10_000 - Math.floor(slippage * 100)))) /
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
        from: activeFromToken?.address ?? "",
        to: activeToToken?.address ?? "",
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

  const { fees: routeFees, totalFeePercent, totalFeeDisplay } = usePoolFees(
    path,
    path?.map((r) => r.poolAddress),
  );

  // Prefer broker amountOutWei; fall back to exchange rate estimate
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
    fromBalance !== undefined &&
    parseFloat(fromAmount) > parseFloat(fromBalance);

  const hasInput =
    !!fromAmount &&
    parseFloat(fromAmount) > 0 &&
    !!toAmount &&
    parseFloat(toAmount) > 0;

  // Sync slider percent with fromAmount
  useEffect(() => {
    if (fromBalance && parseFloat(fromBalance) > 0 && fromAmount) {
      const pct = Math.round(
        (parseFloat(fromAmount) / parseFloat(fromBalance)) * 100,
      );
      setSliderPercent(Math.min(100, Math.max(0, pct)));
    } else if (!fromAmount) {
      setSliderPercent(0);
    }
  }, [fromAmount, fromBalance]);

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return "0";
    if (num >= 1)
      return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return num.toPrecision(4);
  };

  const minimumReceived =
    fromAmount && parseFloat(toAmount) > 0
      ? (parseFloat(toAmount) * (1 - slippage / 100)).toFixed(6)
      : "0";

  const exchangeRate =
    fromAmount &&
    toAmount &&
    parseFloat(fromAmount) > 0 &&
    parseFloat(toAmount) > 0
      ? (parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)
      : swapRouteInfo?.exchangeRate && Number.isFinite(swapRouteInfo.exchangeRate)
        ? (1 / swapRouteInfo.exchangeRate).toFixed(6)
        : "0.000000";

  // Build routeFees from API hops; fall back to on-chain pool fees
  const routeFeesFromApi =
    swapRouteInfo?.hops && swapRouteInfo.hops.length > 0
      ? swapRouteInfo.hops.map((h) => ({
          route: { from: h.tokenIn, to: h.tokenOut },
          feeDisplay: `${(h.feeBps / 100).toFixed(2)}%`,
        }))
      : undefined;

  const avgFeeRateDisplay =
    swapRouteInfo?.averageFeeBps !== null &&
    swapRouteInfo?.averageFeeBps !== undefined &&
    Number.isFinite(swapRouteInfo.averageFeeBps)
      ? `~${(swapRouteInfo.averageFeeBps / 100).toFixed(2)}%`
      : `~${totalFeeDisplay}`;

  const totalFeeUsdDisplay =
    swapRouteInfo?.totalFeeUsd !== null &&
    swapRouteInfo?.totalFeeUsd !== undefined &&
    Number.isFinite(swapRouteInfo.totalFeeUsd)
      ? `~$${swapRouteInfo.totalFeeUsd.toFixed(2)}`
      : hasInput
        ? `~$${(parseFloat(fromAmount) * totalFeePercent).toFixed(2)}`
        : "~$";

  const apiPriceImpact = swapRouteInfo?.routePriceImpactPercent ?? null;
  const priceImpactToShow =
    apiPriceImpact !== null &&
    apiPriceImpact !== undefined &&
    Number.isFinite(apiPriceImpact)
      ? apiPriceImpact
      : priceImpact;

  const highPriceImpactVisible = hasInput && priceImpactToShow >= 3;

  // Handlers
  const handleFromAmountChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) setFromAmount(value);
  };

  const handlePercentageClick = (percent: number) => {
    if (!fromBalance) return;
    const amount = parseFloat(fromBalance) * (percent / 100);
    if (amount > 0) setFromAmount(amount.toString());
  };

  const handleSliderChange = (percent: number) => {
    setSliderPercent(percent);
    if (!fromBalance) return;
    const amount = (parseFloat(fromBalance) * percent) / 100;
    setFromAmount(amount > 0 ? amount.toString() : "");
  };

  const handleFromTokenSelect = (token: TokenInfo) => {
    if (
      activeToToken &&
      token.address.toLowerCase() === activeToToken.address.toLowerCase()
    ) {
      setToToken(activeFromToken);
    }
    setFromToken(token);
  };

  const handleToTokenSelect = (token: TokenInfo) => {
    if (
      activeFromToken &&
      token.address.toLowerCase() === activeFromToken.address.toLowerCase()
    ) {
      setFromToken(activeToToken);
    }
    setToToken(token);
  };

  const handleSwapTokens = () => {
    setFromToken(activeToToken);
    setToToken(activeFromToken);
  };

  const handleSwapSuccess = () => {
    setFromAmount("");
    refetchFromBalance();
    refetchToBalance();
  };

  const handleSwapStatusChange = useCallback(
    (status: SwapStatus, txHash?: string) => {
      if (status === "pending" || status === "confirming") {
        setView("pending");
        setPendingFailed(false);
        if (txHash) setSwapTxHash(txHash);
      } else if (status === "success") {
        setView("completed");
        setPendingFailed(false);
        if (txHash) setSwapTxHash(txHash);
      } else if (status === "error") {
        // Keep the pending screen mounted and surface the inline failed banner
        // (Figma 1457:34516). The toast is shown by SwapButton internally.
        setView("pending");
        setPendingFailed(true);
      }
    },
    [],
  );

  const handleCancelFlow = () => {
    setView("form");
    setPendingFailed(false);
  };

  const handleRetryFromFailed = () => {
    // Bounce back to the confirmation step so the user re-confirms before the
    // next wallet approval prompt; SwapButton stays mounted so wagmi hooks
    // remain hot.
    setPendingFailed(false);
    setView("confirming");
  };

  const displayRouteFees: { route: { from: `0x${string}`; to: `0x${string}` }; feeDisplay: string }[] | undefined =
    routeFeesFromApi?.map((f) => ({
      route: { from: f.route.from as `0x${string}`, to: f.route.to as `0x${string}` },
      feeDisplay: f.feeDisplay,
    })) ??
    routeFees?.map((f) => ({
      route: { from: f.route.from as `0x${string}`, to: f.route.to as `0x${string}` },
      feeDisplay: f.feeDisplay,
    }));

  const mobileSwapDetails = {
    fromToken: activeFromToken,
    toToken: activeToToken,
    fromAmount,
    toAmount,
    exchangeRate,
    minimumReceived,
    priceImpact: priceImpactToShow,
    tokens,
    routeFees: displayRouteFees,
    totalFeePercent,
    totalFeeDisplay: avgFeeRateDisplay.replace(/^~/, ""),
  };

  // Desktop parity: high price impact (>=3%) marks both sides as error in
  // addition to the inline alert. Insufficient balance also flags both.
  const sellHasError = isInsufficientBalance || highPriceImpactVisible;
  const buyHasError = isInsufficientBalance || highPriceImpactVisible;

  const sellHighlight: "none" | "error" = sellHasError ? "error" : "none";
  const buyHighlight: "none" | "error" | "valid" = buyHasError
    ? "error"
    : hasInput
      ? "valid"
      : "none";

  const fromSymbol = activeFromToken?.symbol ?? "---";
  const toSymbol = activeToToken?.symbol ?? "---";

  return (
    <>
      {/* Form view — unmount when in pending/completed to keep layout clean */}
      {view === "form" && (
        <div className="flex flex-col gap-2.5 w-full">
          <section
            className="bg-white rounded-[20px] p-4 flex flex-col items-center gap-2.5"
            aria-label="Swap form"
          >
            <AmountField
              label="Sell"
              token={activeFromToken}
              onTokenSelect={handleFromTokenSelect}
              balanceLabel={fromBalance ? formatBalance(fromBalance) : "0"}
              amount={fromAmount}
              onAmountChange={handleFromAmountChange}
              onPercentClick={handlePercentageClick}
              onSliderToggle={() => setSliderExpanded((v) => !v)}
              sliderExpanded={sliderExpanded}
              sliderPercent={sliderPercent}
              onSliderChange={handleSliderChange}
              highlight={sellHighlight}
              approxUsd="~$0"
              isLoading={isQuoteLoading}
            />

            <button
              type="button"
              onClick={handleSwapTokens}
              aria-label="Swap from / to tokens"
              className="p-2.5 rounded-full bg-green-10 text-white shadow-[inset_0px_-1px_2px_0px_rgba(0,0,0,0.1),inset_0px_1px_1px_0px_rgba(255,255,255,0.6)] hover:bg-green-20 transition-colors"
            >
              <SwitchVerticalIcon />
            </button>

            <AmountField
              label="Buy"
              token={activeToToken}
              onTokenSelect={handleToTokenSelect}
              balanceLabel={toBalance ? formatBalance(toBalance) : "0"}
              amount={toAmount}
              readonly
              highlight={buyHighlight}
              approxUsd="~$0"
              approxUsdEmphasis={hasInput && !isInsufficientBalance}
              isLoading={isQuoteLoading}
            />
          </section>

          <SwapInfoCard
            routeFees={displayRouteFees}
            tokens={tokens}
            fromSymbol={fromSymbol}
            toSymbol={toSymbol}
            exchangeRate={exchangeRate}
            minimumReceived={minimumReceived}
            priceImpactPercent={priceImpactToShow}
            totalFeeUsdDisplay={totalFeeUsdDisplay}
            avgFeeRateDisplay={avgFeeRateDisplay}
            expanded={moreExpanded}
            onToggleExpanded={() => setMoreExpanded((v) => !v)}
            hasInput={hasInput}
            isQuoteLoading={isQuoteLoading}
          />

          {highPriceImpactVisible && (
            <div role="alert" className="flex items-center gap-1 text-red-30">
              <AlertTriangleIcon className="size-4" />
              <span className="body-12 font-medium leading-[18px]">
                High price impact. Proceed despite the potential loss?
              </span>
            </div>
          )}
        </div>
      )}

      {view === "confirming" && (
        <SwapMobileConfirm
          details={mobileSwapDetails}
          onCancel={handleCancelFlow}
          highPriceImpact={highPriceImpactVisible}
        />
      )}

      {/*
       * SwapButton is always mounted at the same DOM position so wagmi hooks
       * (useWaitForTransactionReceipt etc.) keep running through pending/completed.
       * The wrapper layout changes based on view; SwapButton itself is reused.
       * - form view: full-width "Swap" CTA that routes to the confirmation step.
       * - confirming view: Cancel + Confirm row (Confirm = real swap trigger).
       * - pending/completed: hidden.
       */}
      <div
        className={
          view === "form"
            ? "pt-4 pb-5"
            : view === "confirming"
              ? "px-4 pt-4 pb-5 flex gap-2.5 items-center w-full"
              : "hidden"
        }
      >
        {view === "confirming" && (
          <button
            type="button"
            onClick={handleCancelFlow}
            className="flex-1 bg-gray-70 text-gray-10 body-16-bold rounded-[20px] px-5 py-2.5 hover:bg-gray-80 transition-colors"
          >
            {t("common.cancel")}
          </button>
        )}
        <div className={view === "confirming" ? "flex-1" : ""}>
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
            onRequestConfirm={
              view === "form" ? () => setView("confirming") : undefined
            }
            submitLabel={view === "confirming" ? t("common.confirm") : undefined}
          />
        </div>
      </div>

      {view === "pending" && (
        <SwapMobilePending
          details={mobileSwapDetails}
          onCancel={handleCancelFlow}
          failed={pendingFailed}
          onRetry={pendingFailed ? handleRetryFromFailed : undefined}
        />
      )}

      {view === "completed" && swapTxHash && (
        <SwapMobileCompleted
          details={mobileSwapDetails}
          txHash={swapTxHash}
          onClose={handleCancelFlow}
        />
      )}
    </>
  );
}
