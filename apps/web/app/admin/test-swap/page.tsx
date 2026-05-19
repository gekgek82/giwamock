"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/admin/ui/Card";
import { Badge } from "@/components/admin/ui/Badge";
import { Input } from "@/components/admin/ui/Input";
import { usePools, type PoolInfo } from "@/hooks/usePools";
import {
  useRegisteredTokens,
  usePoolFactoryAddress,
  type TokenInfo,
} from "@/hooks/useContractAddresses";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { usePoolFees } from "@/hooks/usePoolFees";
import { usePoolStatsFromIndexer } from "@/hooks/useIndexerStats";
import { useDirectPoolQuote } from "@/hooks/useDirectPoolQuote";
import { SwapButton, type SwapStatus } from "@/components/swap/SwapButton";

// ============================================================================
// Helpers
// ============================================================================

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatReserve(value: string | undefined, decimals: number = 4) {
  if (!value) return "-";
  const num = parseFloat(value);
  if (num === 0) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(decimals);
}

function priceImpactVariant(impact: number): "green" | "yellow" | "warning" | "destructive" {
  if (impact < 1) return "green";
  if (impact < 3) return "yellow";
  if (impact < 5) return "warning";
  return "destructive";
}

function priceImpactColor(impact: number) {
  if (impact < 1) return "text-ds-green-600";
  if (impact < 3) return "text-ds-yellow-600";
  if (impact < 5) return "text-ds-orange-600";
  return "text-ds-red-400";
}

// Derive display orientation from pool — mirrors broker's 3-rule logic
function getDisplayPair(pool: PoolInfo) {
  const base = pool.displayBase ?? pool.token0;
  const quote = pool.displayQuote ?? pool.token1;
  return { base, quote };
}

// ============================================================================
// SwapPreviewCard
// ============================================================================

interface SwapPreviewProps {
  fromSymbol: string;
  fromDecimals: number;
  fromAmount: string;
  toSymbol: string;
  quoteOutput: string;
  minimumReceived: string;
  priceImpact: number;
  isQuoteLoading: boolean;
  isQuoteError: boolean;
  feeDisplay: string | null;
  feeBasisPoints: number | null;
  isDynamicFee: boolean;
  poolType: string;
  tickSpacing?: number | null;
  isStable?: boolean;
  poolAddress: string;
}

function SwapPreviewCard({
  fromSymbol,
  fromDecimals,
  fromAmount,
  toSymbol,
  quoteOutput,
  minimumReceived,
  priceImpact,
  isQuoteLoading,
  isQuoteError,
  feeDisplay,
  feeBasisPoints,
  isDynamicFee,
  poolType,
  tickSpacing,
  isStable,
  poolAddress,
}: SwapPreviewProps) {
  const hasOutput = !!quoteOutput && quoteOutput !== "0" && !isQuoteError;
  const fromNum = parseFloat(fromAmount) || 0;
  const toNum = parseFloat(quoteOutput) || 0;

  const exchangeRate = hasOutput && fromNum > 0 ? toNum / fromNum : null;

  // Estimated fee amount in from-token
  const feeAmountDisplay = useMemo(() => {
    if (!hasOutput || !feeBasisPoints || !fromAmount) return null;
    const fee = (parseFloat(fromAmount) * feeBasisPoints) / 10_000;
    if (fee === 0) return null;
    return `~${fee.toFixed(6)} ${fromSymbol}`;
  }, [hasOutput, feeBasisPoints, fromAmount, fromSymbol]);

  const poolTypeLabel =
    poolType === "CL"
      ? `CL${tickSpacing ?? ""}`
      : isStable
        ? "Basic Stable"
        : "Basic Volatile";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Route visualization */}
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="font-semibold text-ds-gray-1000">{fromSymbol}</span>
          <svg className="w-4 h-4 text-ds-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-ds-gray-200 border border-ds-gray-400">
            <span className="text-xs text-ds-gray-700">{poolTypeLabel}</span>
            {feeDisplay && (
              <span className="text-xs text-ds-gray-600">· {feeDisplay}{isDynamicFee ? " (dyn)" : ""}</span>
            )}
          </div>
          <svg className="w-4 h-4 text-ds-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="font-semibold text-ds-gray-1000">{toSymbol}</span>
        </div>

        {/* Output display */}
        <div className="rounded-lg border border-ds-gray-400 bg-ds-background-200 p-4">
          {isQuoteLoading ? (
            <div className="text-sm text-ds-gray-600 animate-pulse">Calculating…</div>
          ) : isQuoteError ? (
            <div className="text-sm text-ds-red-400">No liquidity or quote error</div>
          ) : hasOutput ? (
            <div className="space-y-1">
              <div className="text-xs text-ds-gray-600">Estimated output</div>
              <div className="text-2xl font-semibold text-ds-gray-1000 tabular-nums">
                {parseFloat(quoteOutput).toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </div>
              <div className="text-sm text-ds-gray-700">{toSymbol}</div>
            </div>
          ) : (
            <div className="text-sm text-ds-gray-600">Enter an amount to see preview</div>
          )}
        </div>

        {/* Detail rows */}
        {hasOutput && (
          <div className="space-y-2 text-sm">
            {exchangeRate !== null && (
              <div className="flex justify-between">
                <span className="text-ds-gray-700">Exchange rate</span>
                <span className="text-ds-gray-1000 tabular-nums">
                  1 {fromSymbol} = {exchangeRate.toLocaleString(undefined, { maximumFractionDigits: 6 })} {toSymbol}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-ds-gray-700">Price impact</span>
              <span className={`font-medium tabular-nums ${priceImpactColor(priceImpact)}`}>
                {priceImpact.toFixed(2)}%
              </span>
            </div>

            {feeDisplay && (
              <div className="flex justify-between">
                <span className="text-ds-gray-700">
                  Pool fee{isDynamicFee ? " (dynamic)" : ""}
                </span>
                <div className="text-right">
                  <span className="text-ds-gray-1000">{feeDisplay}</span>
                  {feeAmountDisplay && (
                    <span className="text-xs text-ds-gray-600 ml-1">({feeAmountDisplay})</span>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-ds-gray-700">Minimum received</span>
              <span className="text-ds-gray-1000 tabular-nums">
                {parseFloat(minimumReceived).toLocaleString(undefined, { maximumFractionDigits: 6 })} {toSymbol}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-ds-gray-700">Pool</span>
              <span className="text-ds-gray-1000 font-mono text-xs">{truncateAddress(poolAddress)}</span>
            </div>
          </div>
        )}

        {/* High price impact warning */}
        {hasOutput && priceImpact >= 3 && (
          <div className="rounded-md border border-ds-red-700/20 bg-ds-red-700/5 px-3 py-2">
            <p className="text-xs text-ds-red-400">
              High price impact ({priceImpact.toFixed(2)}%). The output may be significantly less than expected.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Component
// ============================================================================

export default function TestSwapPage() {
  const { isConnected } = useAccount();
  const { pools, isLoading: isPoolsLoading } = usePools();
  const registeredTokens = useRegisteredTokens();
  const poolFactoryAddress = usePoolFactoryAddress();

  // ── Pool selection state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPool, setSelectedPool] = useState<PoolInfo | null>(null);

  // ── Swap form state ──
  // "forward" = displayBase → displayQuote; "reverse" = displayQuote → displayBase
  const [swapDirection, setSwapDirection] = useState<"forward" | "reverse">("forward");
  const [fromAmount, setFromAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5);

  // Debounce fromAmount (400ms)
  const [debouncedFromAmount, setDebouncedFromAmount] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFromAmount(fromAmount), 400);
    return () => clearTimeout(timer);
  }, [fromAmount]);

  // ── Derived orientation ──
  const { base: displayBase, quote: displayQuote } = useMemo(
    () => (selectedPool ? getDisplayPair(selectedPool) : { base: undefined, quote: undefined }),
    [selectedPool],
  );

  const fromPoolToken = swapDirection === "forward" ? displayBase : displayQuote;
  const toPoolToken = swapDirection === "forward" ? displayQuote : displayBase;

  // Look up full TokenInfo from registered tokens; fallback to pool metadata
  const resolveTokenInfo = useCallback(
    (
      poolToken: { address: `0x${string}`; symbol: string; name: string; decimals: number } | undefined,
    ): TokenInfo | null => {
      if (!poolToken) return null;
      const found = registeredTokens.find(
        (t) => t.address.toLowerCase() === poolToken.address.toLowerCase(),
      );
      if (found) return found;
      return {
        address: poolToken.address,
        symbol: poolToken.symbol,
        name: poolToken.name,
        decimals: poolToken.decimals,
        iconUrl: null,
      };
    },
    [registeredTokens],
  );

  const fromToken = resolveTokenInfo(fromPoolToken);
  const toToken = resolveTokenInfo(toPoolToken);

  // ── Build explicit route ──
  const route = useMemo(() => {
    if (!selectedPool || !fromToken || !toToken) return null;
    return {
      from: fromToken.address as `0x${string}`,
      to: toToken.address as `0x${string}`,
      stable: selectedPool.isStable,
      factory: (poolFactoryAddress ||
        "0x0000000000000000000000000000000000000000") as `0x${string}`,
      poolType: selectedPool.poolType,
      tickSpacing: selectedPool.tickSpacing ?? undefined,
    };
  }, [selectedPool, fromToken, toToken, poolFactoryAddress]);

  // ── Hooks ──
  const { data: fromBalance, refetch: refetchFromBalance } = useTokenBalance(
    fromToken?.address as `0x${string}` | undefined,
  );

  const {
    data: quoteOutput,
    isLoading: isQuoteLoading,
    isError: isQuoteError,
    priceImpact,
    route: quoteRoute,
  } = useDirectPoolQuote(
    route,
    debouncedFromAmount,
    fromToken?.decimals ?? 18,
    selectedPool?.address,
  );

  const { data: poolStats } = usePoolStatsFromIndexer(selectedPool?.address);

  const feeRoutes = useMemo(() => {
    if (!route) return null;
    return [{ from: route.from, to: route.to, stable: route.stable, factory: route.factory }];
  }, [route]);

  const poolFees = usePoolFees(
    feeRoutes,
    selectedPool ? [selectedPool.address] : undefined,
  );

  // ── Minimum received ──
  const minimumReceived = useMemo(() => {
    if (!quoteOutput || quoteOutput === "0") return "0";
    const out = parseFloat(quoteOutput);
    return (out * (1 - slippage / 100)).toString();
  }, [quoteOutput, slippage]);

  // ── Pool search/filter ──
  const filteredPools = useMemo(() => {
    if (!pools) return [];
    if (!searchQuery.trim()) return pools;
    const q = searchQuery.toLowerCase();
    return pools.filter(
      (p) =>
        p.token0.symbol.toLowerCase().includes(q) ||
        p.token1.symbol.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.token0.address.toLowerCase().includes(q) ||
        p.token1.address.toLowerCase().includes(q),
    );
  }, [pools, searchQuery]);

  // ── Swap callbacks ──
  const handleSwapSuccess = useCallback(() => {
    setFromAmount("");
    setDebouncedFromAmount("");
    refetchFromBalance();
  }, [refetchFromBalance]);

  const handleStatusChange = useCallback(
    (_status: SwapStatus, _txHash?: string) => {},
    [],
  );

  // ── Fee display ──
  const feeEntry = useMemo(() => {
    if (!poolFees?.fees || poolFees.fees.length === 0) return null;
    return poolFees.fees[0];
  }, [poolFees]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-ds-gray-1000">Test Swap</h1>
        <p className="text-sm text-ds-gray-700 mt-1">
          Bypass automatic routing and swap through a specific pool. For QA
          testing only.
        </p>
      </div>

      {/* Warning banner */}
      <div className="rounded-lg border border-ds-blue-700/20 bg-ds-blue-700/5 px-4 py-3">
        <p className="text-sm text-ds-blue-400">
          This page bypasses the BFS routing algorithm and stable/volatile price
          comparison. The swap will execute through the exact pool you select,
          regardless of whether a better rate exists elsewhere.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Pool Selection ── */}
        <Card>
          <CardHeader>
            <CardTitle>Select Pool</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search by token symbol or pool address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className="max-h-[400px] overflow-y-auto border border-ds-gray-400 rounded-md">
              {isPoolsLoading ? (
                <div className="p-4 text-center text-sm text-ds-gray-700">
                  Loading pools...
                </div>
              ) : filteredPools.length === 0 ? (
                <div className="p-4 text-center text-sm text-ds-gray-700">
                  No pools found
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-ds-background-200 border-b border-ds-gray-400">
                    <tr>
                      <th className="text-left px-3 py-2 text-ds-gray-700 font-medium">
                        Pair
                      </th>
                      <th className="text-left px-3 py-2 text-ds-gray-700 font-medium">
                        Type
                      </th>
                      <th className="text-left px-3 py-2 text-ds-gray-700 font-medium">
                        Address
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPools.map((pool) => {
                      const isSelected = selectedPool?.address === pool.address;
                      const { base, quote } = getDisplayPair(pool);
                      return (
                        <tr
                          key={pool.address}
                          onClick={() => {
                            setSelectedPool(pool);
                            setSwapDirection("forward");
                            setFromAmount("");
                            setDebouncedFromAmount("");
                          }}
                          className={`cursor-pointer border-b border-ds-gray-400 last:border-b-0 transition-colors ${
                            isSelected
                              ? "bg-ds-blue-700/10"
                              : "hover:bg-ds-gray-200"
                          }`}
                        >
                          <td className="px-3 py-2">
                            <span className="font-medium text-ds-gray-1000">
                              {base.symbol}/{quote.symbol}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              {pool.poolType === "CL" ? (
                                <Badge variant="purple">
                                  CL{pool.tickSpacing}
                                </Badge>
                              ) : (
                                <>
                                  <Badge variant="blue">BASIC</Badge>
                                  <Badge
                                    variant={
                                      pool.isStable ? "cyan" : "warning"
                                    }
                                  >
                                    {pool.isStable ? "Stable" : "Volatile"}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-ds-gray-700 font-mono text-xs">
                            {truncateAddress(pool.address)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Right: Pool Details, Swap Form, Preview ── */}
        <div className="space-y-6">
          {/* Pool Details */}
          {selectedPool && displayBase && displayQuote && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {displayBase.symbol}/{displayQuote.symbol}
                  </CardTitle>
                  <div className="flex items-center gap-1.5">
                    {selectedPool.poolType === "CL" ? (
                      <Badge variant="purple">
                        CL{selectedPool.tickSpacing}
                      </Badge>
                    ) : (
                      <>
                        <Badge variant="blue">BASIC</Badge>
                        <Badge
                          variant={selectedPool.isStable ? "cyan" : "warning"}
                        >
                          {selectedPool.isStable ? "Stable" : "Volatile"}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-ds-gray-700">Pool Address</span>
                    <p className="text-ds-gray-1000 font-mono text-xs mt-0.5">
                      {selectedPool.address}
                    </p>
                  </div>
                  <div>
                    <span className="text-ds-gray-700">Fee</span>
                    <p className="text-ds-gray-1000 mt-0.5">
                      {feeEntry?.feeDisplay ?? (poolStats?.feePercent || "-")}
                      {feeEntry?.isDynamicFee && (
                        <span className="ml-1 text-xs text-ds-gray-600">(dynamic)</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-ds-gray-700">
                      Reserve ({displayBase.symbol})
                    </span>
                    <p className="text-ds-gray-1000 mt-0.5">
                      {formatReserve(
                        displayBase.address === selectedPool.token0.address
                          ? poolStats?.reserve0
                          : poolStats?.reserve1,
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-ds-gray-700">
                      Reserve ({displayQuote.symbol})
                    </span>
                    <p className="text-ds-gray-1000 mt-0.5">
                      {formatReserve(
                        displayQuote.address === selectedPool.token1.address
                          ? poolStats?.reserve1
                          : poolStats?.reserve0,
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-ds-gray-700">TVL</span>
                    <p className="text-ds-gray-1000 mt-0.5">
                      ${formatReserve(poolStats?.tvl)}
                    </p>
                  </div>
                  <div>
                    <span className="text-ds-gray-700">Volume 24h</span>
                    <p className="text-ds-gray-1000 mt-0.5">
                      ${formatReserve(poolStats?.volume24h)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Swap Form */}
          {selectedPool && fromToken && toToken && (
            <Card>
              <CardHeader>
                <CardTitle>Swap</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Direction toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ds-gray-700">Direction:</span>
                  <button
                    onClick={() =>
                      setSwapDirection((d) =>
                        d === "forward" ? "reverse" : "forward",
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-ds-gray-400 bg-ds-background-100 text-sm text-ds-gray-1000 hover:bg-ds-gray-200 transition-colors"
                  >
                    <span className="font-medium">{fromToken.symbol}</span>
                    <svg
                      className="w-4 h-4 text-ds-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                    <span className="font-medium">{toToken.symbol}</span>
                  </button>
                  <span className="text-xs text-ds-gray-600">
                    (click to flip)
                  </span>
                </div>

                {/* From amount */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm text-ds-gray-700">
                      Sell ({fromToken.symbol})
                    </label>
                    <span className="text-xs text-ds-gray-600">
                      Balance: {parseFloat(fromBalance || "0").toFixed(4)}
                    </span>
                  </div>
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    min="0"
                    step="any"
                  />
                </div>

                {/* Quote output */}
                <div>
                  <label className="text-sm text-ds-gray-700 mb-1 block">
                    Buy ({toToken.symbol})
                  </label>
                  <div className="px-3 py-2 rounded-md border border-ds-gray-400 bg-ds-background-100 text-sm text-ds-gray-1000 min-h-[38px] flex items-center">
                    {isQuoteLoading ? (
                      <span className="text-ds-gray-600">Loading...</span>
                    ) : isQuoteError ? (
                      <span className="text-ds-red-400">
                        No liquidity or quote error
                      </span>
                    ) : quoteOutput && quoteOutput !== "0" ? (
                      parseFloat(quoteOutput).toFixed(6)
                    ) : (
                      <span className="text-ds-gray-600">-</span>
                    )}
                  </div>
                </div>

                {/* Slippage */}
                <div>
                  <label className="text-sm text-ds-gray-700 mb-1 block">
                    Slippage Tolerance
                  </label>
                  <div className="flex items-center gap-2">
                    {[0.5, 1, 3, 5, 10].map((val) => (
                      <button
                        key={val}
                        onClick={() => setSlippage(val)}
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                          slippage === val
                            ? "border-ds-blue-400 bg-ds-blue-700/10 text-ds-blue-400"
                            : "border-ds-gray-400 text-ds-gray-700 hover:bg-ds-gray-200"
                        }`}
                      >
                        {val}%
                      </button>
                    ))}
                    <Input
                      type="number"
                      value={slippage}
                      onChange={(e) =>
                        setSlippage(parseFloat(e.target.value) || 0)
                      }
                      className="w-20 text-xs"
                      min="0"
                      max="50"
                      step="0.1"
                    />
                  </div>
                </div>

                {/* Swap Button */}
                {isConnected && quoteRoute ? (
                  <SwapButton
                    fromToken={fromToken}
                    toToken={toToken}
                    fromAmount={fromAmount}
                    minimumReceived={minimumReceived}
                    routes={quoteRoute}
                    onSwapSuccess={handleSwapSuccess}
                    onStatusChange={handleStatusChange}
                  />
                ) : !isConnected ? (
                  <div className="text-center text-sm text-ds-gray-700 py-3">
                    Connect your wallet to swap
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* ── Preview Card ── */}
          {selectedPool && fromToken && toToken && (
            <SwapPreviewCard
              fromSymbol={fromToken.symbol}
              fromDecimals={fromToken.decimals}
              fromAmount={debouncedFromAmount}
              toSymbol={toToken.symbol}
              quoteOutput={quoteOutput ?? ""}
              minimumReceived={minimumReceived}
              priceImpact={priceImpact}
              isQuoteLoading={isQuoteLoading}
              isQuoteError={isQuoteError}
              feeDisplay={feeEntry?.feeDisplay ?? null}
              feeBasisPoints={feeEntry?.feeBasisPoints ?? null}
              isDynamicFee={feeEntry?.isDynamicFee ?? false}
              poolType={selectedPool.poolType}
              tickSpacing={selectedPool.tickSpacing}
              isStable={selectedPool.isStable}
              poolAddress={selectedPool.address}
            />
          )}

          {/* Empty state */}
          {!selectedPool && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-ds-gray-700">
                  Select a pool from the list to start testing swaps.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
