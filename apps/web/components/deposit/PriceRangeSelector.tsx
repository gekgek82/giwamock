"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  tickToPrice,
  priceToTick,
  nearestUsableTick,
  minUsableTick,
  maxUsableTick,
  formatPrice,
} from "@/lib/tickMath";
import { useLiquidityDistribution } from "@/hooks/useLiquidityDistribution";
import { useTokenPrices } from "@/hooks/useTokenPrices";

interface PriceRangeSelectorProps {
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  tickSpacing: number;
  currentTick: number | null;
  poolAddress?: string | null;
  onRangeChange?: (tickLower: number, tickUpper: number) => void;
  /**
   * When true, initialize the selector with Full Range instead of the
   * default ±10% preset. Used for imbalanced pools where any narrow range
   * near the current tick is effectively useless.
   */
  defaultFullRange?: boolean;
}

const PRESET_RANGES = [
  { label: "±1%", value: 0.01 },
  { label: "±3%", value: 0.03 },
  { label: "±5%", value: 0.05 },
  { label: "±8%", value: 0.08 },
  { label: "±10%", value: 0.10 },
  { label: "±15%", value: 0.15 },
];

// Uniform, slightly-varied skeleton bar heights (%) — designed to read as a
// loading placeholder rather than a legitimate distribution.
const SKELETON_BAR_HEIGHTS = [
  22, 28, 34, 40, 48, 58, 70, 82, 90, 82, 70, 58, 48, 40, 34, 28, 22, 18, 14, 12,
];

export function PriceRangeSelector({
  token0Symbol,
  token1Symbol,
  token0Decimals,
  token1Decimals,
  tickSpacing,
  currentTick,
  poolAddress,
  onRangeChange,
  defaultFullRange = false,
}: PriceRangeSelectorProps) {
  const t = useTranslations();

  const {
    data: liquidityData,
    isLoading: isLiquidityLoading,
    refetch: refetchLiquidity,
  } = useLiquidityDistribution(poolAddress ?? null);

  // USD prices for the "(~$value)" label next to the current exchange rate.
  const { prices: tokenUsdPrices } = useTokenPrices([token0Symbol, token1Symbol]);

  // Whether to show price as token1/token0 (false) or token0/token1 (true, i.e. inverted)
  const [isInverted, setIsInverted] = useState(false);

  // Selected preset (null means custom / full range)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(
    defaultFullRange ? null : 0.10
  );

  // Whether full range is selected
  const [isFullRange, setIsFullRange] = useState(defaultFullRange);

  // Internal tick state
  const [tickLower, setTickLower] = useState<number>(0);
  const [tickUpper, setTickUpper] = useState<number>(0);

  // Manual input state (string to allow free typing)
  const [lowPriceInput, setLowPriceInput] = useState<string>("");
  const [highPriceInput, setHighPriceInput] = useState<string>("");
  const [isEditingLow, setIsEditingLow] = useState(false);
  const [isEditingHigh, setIsEditingHigh] = useState(false);

  // Ref for the chart area (for drag position calculation)
  const chartRef = useRef<HTMLDivElement>(null);

  // Drag state: which handle is being dragged
  const [dragging, setDragging] = useState<"low" | "high" | null>(null);
  const draggingRef = useRef<"low" | "high" | null>(null);

  // Refs to avoid stale closures in drag handler
  const tickLowerRef = useRef(tickLower);
  const tickUpperRef = useRef(tickUpper);
  tickLowerRef.current = tickLower;
  tickUpperRef.current = tickUpper;

  // Current price derived from current tick
  const currentPrice = useMemo(() => {
    if (currentTick === null) return null;
    const price = tickToPrice(currentTick, token0Decimals, token1Decimals);
    return isInverted ? 1 / price : price;
  }, [currentTick, token0Decimals, token1Decimals, isInverted]);

  // USD approximation for "1.0 {base}" — uses the USD price of the base token
  // since "1.0 base = price quote" has the same USD value as 1.0 × USD(base).
  const baseUsdPrice = useMemo(() => {
    const baseSymbol = isInverted ? token1Symbol : token0Symbol;
    const usd = tokenUsdPrices[baseSymbol] ?? 0;
    return usd > 0 ? usd : null;
  }, [tokenUsdPrices, token0Symbol, token1Symbol, isInverted]);

  // Convert ticks to display prices, respecting inversion
  const tickToDisplayPrice = useCallback(
    (tick: number): number => {
      const price = tickToPrice(tick, token0Decimals, token1Decimals);
      return isInverted ? 1 / price : price;
    },
    [token0Decimals, token1Decimals, isInverted]
  );

  // Convert display price to tick, respecting inversion
  const displayPriceToTick = useCallback(
    (displayPrice: number): number => {
      const rawPrice = isInverted ? 1 / displayPrice : displayPrice;
      return priceToTick(rawPrice, token0Decimals, token1Decimals);
    },
    [token0Decimals, token1Decimals, isInverted]
  );

  // Display prices derived from tick state
  const lowPrice = useMemo(() => {
    if (isFullRange) {
      return isInverted ? Infinity : 0;
    }
    // When inverted, tickUpper maps to the lower display price
    const tick = isInverted ? tickUpper : tickLower;
    return tickToDisplayPrice(tick);
  }, [tickLower, tickUpper, isInverted, isFullRange, tickToDisplayPrice]);

  const highPrice = useMemo(() => {
    if (isFullRange) {
      return isInverted ? 0 : Infinity;
    }
    // When inverted, tickLower maps to the higher display price
    const tick = isInverted ? tickLower : tickUpper;
    return tickToDisplayPrice(tick);
  }, [tickLower, tickUpper, isInverted, isFullRange, tickToDisplayPrice]);

  // Initialize ticks from current tick when it becomes available. For
  // imbalanced pools we default to Full Range since any narrow range near
  // an extreme tick is effectively useless and shows astronomical amounts.
  useEffect(() => {
    if (currentTick === null) return;
    if (defaultFullRange) {
      applyFullRange();
    } else if (selectedPreset !== null) {
      applyPreset(selectedPreset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTick]);

  // Notify parent when ticks change
  useEffect(() => {
    onRangeChange?.(tickLower, tickUpper);
  }, [tickLower, tickUpper, onRangeChange]);

  // Sync display inputs when ticks change (and not actively editing)
  useEffect(() => {
    if (!isEditingLow) {
      setLowPriceInput(
        lowPrice === 0 ? "0" : lowPrice === Infinity ? "∞" : formatPrice(lowPrice)
      );
    }
  }, [lowPrice, isEditingLow]);

  useEffect(() => {
    if (!isEditingHigh) {
      setHighPriceInput(
        highPrice === Infinity ? "∞" : highPrice === 0 ? "0" : formatPrice(highPrice)
      );
    }
  }, [highPrice, isEditingHigh]);

  // Apply a preset range around current tick.
  // Works directly in tick space (Δtick = log(1±pct) / log(1.0001)) so the
  // math stays stable even when currentTick is at an extreme — going via
  // prices overflows to Infinity/0 when currentTick approaches MAX/MIN_TICK.
  const applyPreset = useCallback(
    (pct: number) => {
      if (currentTick === null) return;

      const LOG_BASE = Math.log(1.0001);
      const tickDeltaLow = Math.round(Math.log(1 - pct) / LOG_BASE);
      const tickDeltaHigh = Math.round(Math.log(1 + pct) / LOG_BASE);

      const lowTick = nearestUsableTick(currentTick + tickDeltaLow, tickSpacing);
      const highTick = nearestUsableTick(currentTick + tickDeltaHigh, tickSpacing);

      setTickLower(lowTick);
      setTickUpper(highTick);
      setIsFullRange(false);
      setSelectedPreset(pct);
    },
    [currentTick, tickSpacing]
  );

  // Apply full range
  const applyFullRange = useCallback(() => {
    const minTick = minUsableTick(tickSpacing);
    const maxTick = maxUsableTick(tickSpacing);
    setTickLower(minTick);
    setTickUpper(maxTick);
    setIsFullRange(true);
    setSelectedPreset(null);
  }, [tickSpacing]);

  // Handle +/- buttons for low price
  const handleLowPriceMinus = useCallback(() => {
    if (isFullRange) return;
    if (isInverted) {
      // Inverted: decreasing display low price = increasing tickUpper
      const newTick = tickUpper + tickSpacing;
      if (newTick <= maxUsableTick(tickSpacing)) {
        setTickUpper(newTick);
        setSelectedPreset(null);
      }
    } else {
      const newTick = tickLower - tickSpacing;
      if (newTick >= minUsableTick(tickSpacing)) {
        setTickLower(newTick);
        setSelectedPreset(null);
      }
    }
  }, [tickLower, tickUpper, tickSpacing, isInverted, isFullRange]);

  const handleLowPricePlus = useCallback(() => {
    if (isFullRange) return;
    if (isInverted) {
      const newTick = tickUpper - tickSpacing;
      if (newTick > tickLower) {
        setTickUpper(newTick);
        setSelectedPreset(null);
      }
    } else {
      const newTick = tickLower + tickSpacing;
      if (newTick < tickUpper) {
        setTickLower(newTick);
        setSelectedPreset(null);
      }
    }
  }, [tickLower, tickUpper, tickSpacing, isInverted, isFullRange]);

  // Handle +/- buttons for high price
  const handleHighPriceMinus = useCallback(() => {
    if (isFullRange) return;
    if (isInverted) {
      const newTick = tickLower + tickSpacing;
      if (newTick < tickUpper) {
        setTickLower(newTick);
        setSelectedPreset(null);
      }
    } else {
      const newTick = tickUpper - tickSpacing;
      if (newTick > tickLower) {
        setTickUpper(newTick);
        setSelectedPreset(null);
      }
    }
  }, [tickLower, tickUpper, tickSpacing, isInverted, isFullRange]);

  const handleHighPricePlus = useCallback(() => {
    if (isFullRange) return;
    if (isInverted) {
      const newTick = tickLower - tickSpacing;
      if (newTick >= minUsableTick(tickSpacing)) {
        setTickLower(newTick);
        setSelectedPreset(null);
      }
    } else {
      const newTick = tickUpper + tickSpacing;
      if (newTick <= maxUsableTick(tickSpacing)) {
        setTickUpper(newTick);
        setSelectedPreset(null);
      }
    }
  }, [tickLower, tickUpper, tickSpacing, isInverted, isFullRange]);

  // Handle manual price input commit
  const commitLowPrice = useCallback(() => {
    setIsEditingLow(false);
    const val = parseFloat(lowPriceInput);
    if (isNaN(val) || val <= 0) return;

    const tick = nearestUsableTick(displayPriceToTick(val), tickSpacing);
    if (isInverted) {
      if (tick > tickLower) {
        setTickUpper(tick);
        setSelectedPreset(null);
        setIsFullRange(false);
      }
    } else {
      if (tick < tickUpper) {
        setTickLower(tick);
        setSelectedPreset(null);
        setIsFullRange(false);
      }
    }
  }, [lowPriceInput, tickLower, tickUpper, tickSpacing, isInverted, displayPriceToTick]);

  const commitHighPrice = useCallback(() => {
    setIsEditingHigh(false);
    const val = parseFloat(highPriceInput);
    if (isNaN(val) || val <= 0) return;

    const tick = nearestUsableTick(displayPriceToTick(val), tickSpacing);
    if (isInverted) {
      if (tick < tickUpper) {
        setTickLower(tick);
        setSelectedPreset(null);
        setIsFullRange(false);
      }
    } else {
      if (tick > tickLower) {
        setTickUpper(tick);
        setSelectedPreset(null);
        setIsFullRange(false);
      }
    }
  }, [highPriceInput, tickLower, tickUpper, tickSpacing, isInverted, displayPriceToTick]);

  // Check if current price is in range
  const isInRange = useMemo(() => {
    if (currentTick === null) return true;
    return currentTick >= tickLower && currentTick <= tickUpper;
  }, [currentTick, tickLower, tickUpper]);

  // Base/quote token labels
  const baseToken = isInverted ? token1Symbol : token0Symbol;
  const quoteToken = isInverted ? token0Symbol : token1Symbol;

  // Whether the chart histogram data is still loading. While true, show a
  // skeleton placeholder instead of synthesizing fake flat bars — the latter
  // causes a visible flicker when real data eventually arrives.
  const isChartLoading = !liquidityData && isLiquidityLoading;

  // Generate histogram bars from real liquidity data. We deliberately return
  // an empty list while loading so the skeleton branch renders instead.
  //
  // bar.price from the broker is 1.0001^tick (raw, no decimal adjustment).
  // Multiply by 10^(dec0-dec1) to put it on the same scale as currentPrice,
  // lowPrice, and highPrice — which all go through tickToDisplayPrice().
  const histogramBars = useMemo(() => {
    if (liquidityData?.bars?.length) {
      const decimalFactor = Math.pow(10, token0Decimals - token1Decimals);
      const maxLiq = Math.max(
        ...liquidityData.bars.map((b) => Number(b.liquidity))
      );
      return liquidityData.bars.map((bar) => {
        const adjustedPrice = bar.price * decimalFactor;
        return {
          price: isInverted && adjustedPrice > 0 ? 1 / adjustedPrice : adjustedPrice,
          volume: maxLiq > 0 ? (Number(bar.liquidity) / maxLiq) * 100 : 0,
        };
      });
    }
    return [] as { price: number; volume: number }[];
  }, [liquidityData, isInverted, token0Decimals, token1Decimals]);

  // Effective price window for the chart x-axis.
  // When histogram data is present, use the bar price range.
  // When absent (no data yet), fall back to ±50 % around the current price so
  // the handles and price labels still render at sensible positions.
  const chartPriceRange = useMemo(() => {
    if (histogramBars.length > 0) {
      return { first: histogramBars[0].price, last: histogramBars[histogramBars.length - 1].price };
    }
    if (currentPrice !== null && currentPrice > 0) {
      return { first: currentPrice * 0.5, last: currentPrice * 1.5 };
    }
    return null;
  }, [histogramBars, currentPrice]);

  // Calculate marker positions for histogram
  const getMarkerPosition = useCallback(
    (price: number): number => {
      if (!chartPriceRange) return 50;
      const { first, last } = chartPriceRange;
      const range = last - first;
      if (range === 0) return 50;
      return Math.max(0, Math.min(100, ((price - first) / range) * 100));
    },
    [chartPriceRange]
  );

  const lowMarkerPos = useMemo(
    () => getMarkerPosition(lowPrice),
    [lowPrice, getMarkerPosition]
  );
  const highMarkerPos = useMemo(
    () => getMarkerPosition(highPrice === Infinity ? (chartPriceRange?.last ?? 0) : highPrice),
    [highPrice, getMarkerPosition, chartPriceRange]
  );
  const currentMarkerPos = useMemo(
    () => (currentPrice !== null ? getMarkerPosition(currentPrice) : 50),
    [currentPrice, getMarkerPosition]
  );

  // Five price labels spread evenly across the X-axis.
  const xAxisLabels = useMemo(() => {
    if (!chartPriceRange) return [] as string[];
    const { first, last } = chartPriceRange;
    return [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const p = first + (last - first) * t;
      return formatPrice(p);
    });
  }, [chartPriceRange]);

  // Convert a pixel X position within the chart to a price
  const positionToPrice = useCallback(
    (clientX: number): number | null => {
      if (!chartRef.current || !chartPriceRange) return null;
      const rect = chartRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return chartPriceRange.first + pct * (chartPriceRange.last - chartPriceRange.first);
    },
    [chartPriceRange]
  );

  // Drag start handler
  const handleDragStart = useCallback(
    (handle: "low" | "high") => (e: React.MouseEvent | React.TouchEvent) => {
      if (isFullRange) return;
      e.preventDefault();
      setDragging(handle);
      draggingRef.current = handle;
    },
    [isFullRange]
  );

  // Drag move + end handlers (attached to document during drag)
  useEffect(() => {
    if (!dragging) return;

    const getClientX = (e: MouseEvent | TouchEvent): number => {
      if ("touches" in e) return e.touches[0].clientX;
      return e.clientX;
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const handle = draggingRef.current;
      if (!handle) return;
      const price = positionToPrice(getClientX(e));
      if (price === null || price <= 0) return;

      const rawPrice = isInverted ? 1 / price : price;
      const tick = nearestUsableTick(
        priceToTick(rawPrice, token0Decimals, token1Decimals),
        tickSpacing
      );

      if (handle === "low") {
        if (isInverted) {
          if (tick > tickLowerRef.current) {
            setTickUpper(tick);
            setSelectedPreset(null);
          }
        } else {
          if (tick < tickUpperRef.current) {
            setTickLower(tick);
            setSelectedPreset(null);
          }
        }
      } else {
        if (isInverted) {
          if (tick < tickUpperRef.current) {
            setTickLower(tick);
            setSelectedPreset(null);
          }
        } else {
          if (tick > tickLowerRef.current) {
            setTickUpper(tick);
            setSelectedPreset(null);
          }
        }
      }
    };

    const handleEnd = () => {
      setDragging(null);
      draggingRef.current = null;
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd);

    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [dragging, isInverted, tickSpacing, token0Decimals, token1Decimals, positionToPrice]);

  // Set body cursor during drag to prevent flickering
  useEffect(() => {
    if (dragging) {
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging]);

  // Handle inversion toggle - swap displayed base/quote
  const handleToggleInversion = useCallback(
    (inverted: boolean) => {
      setIsInverted(inverted);
    },
    []
  );

  // Percentage offset of low/high price relative to current price — shown as
  // the small colored label above each handle (e.g. "-10%", "+20%").
  const lowOffsetPct = useMemo(() => {
    if (currentPrice === null || currentPrice === 0 || isFullRange) return null;
    if (lowPrice === 0 || lowPrice === Infinity) return null;
    return ((lowPrice - currentPrice) / currentPrice) * 100;
  }, [lowPrice, currentPrice, isFullRange]);

  const highOffsetPct = useMemo(() => {
    if (currentPrice === null || currentPrice === 0 || isFullRange) return null;
    if (highPrice === 0 || highPrice === Infinity) return null;
    return ((highPrice - currentPrice) / currentPrice) * 100;
  }, [highPrice, currentPrice, isFullRange]);

  const formatOffset = (pct: number): string => {
    const rounded = Math.round(pct);
    return `${rounded > 0 ? "+" : ""}${rounded}%`;
  };

  if (currentTick === null) {
    return (
      <div className="bg-white rounded-[20px] md:rounded-[40px] h-full flex items-center justify-center py-[27px]">
        <div className="flex items-center gap-3 text-gray-60">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-green" />
          <span className="body-14">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[20px] md:rounded-[40px] flex flex-col gap-5 pt-[27px] pb-[30px] h-full">
      {/* Header: title + current price + currency toggle */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4 px-5 md:px-[30px]">
          <h2 className="flex-1 heading-6 text-gray-100">
            {t("deposit.setPriceRange")}
          </h2>
          <div className="flex items-center gap-3.5">
            {currentPrice !== null && (
              <div className="body-14-medium text-gray-100 whitespace-nowrap hidden md:flex items-center gap-1.5">
                <span>
                  1.0 {baseToken} = {formatPrice(currentPrice)} {quoteToken}
                </span>
                {baseUsdPrice !== null && (
                  <span>(~${formatPrice(baseUsdPrice)})</span>
                )}
              </div>
            )}
            {/* Token Toggle */}
            <div className="bg-gray-20 rounded-full p-1 flex items-center">
              <button
                onClick={() => handleToggleInversion(false)}
                className={`px-1.5 py-1 rounded-full transition-colors ${
                  !isInverted
                    ? "bg-gray-100 text-white body-14-bold"
                    : "text-gray-100 body-14-medium"
                }`}
              >
                {token0Symbol}
              </button>
              <button
                onClick={() => handleToggleInversion(true)}
                className={`px-1.5 py-1 rounded-full transition-colors ${
                  isInverted
                    ? "bg-gray-100 text-white body-14-bold"
                    : "text-gray-100 body-14-medium"
                }`}
              >
                {token1Symbol}
              </button>
            </div>
          </div>
        </div>
        <div className="h-px bg-gray-30 w-full" />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-10 w-full px-5 md:px-[30px]">
        {/* Preset tabs + Chart */}
        <div className="flex flex-col gap-10 w-full">
          {/* Preset tabs */}
          <div className="border border-gray-30 rounded-[20px] flex pt-4 pb-3 px-5 gap-5">
            {PRESET_RANGES.map((range) => {
              const isActive = selectedPreset === range.value && !isFullRange;
              return (
                <button
                  key={range.label}
                  onClick={() => applyPreset(range.value)}
                  className="flex-1 flex flex-col items-center gap-1 min-w-0"
                >
                  <span
                    className={`whitespace-nowrap transition-colors ${
                      isActive
                        ? "body-16-bold text-brand-green"
                        : "body-16-medium text-gray-100 hover:text-gray-80"
                    }`}
                  >
                    {range.label}
                  </span>
                  <div
                    className={`h-0.5 w-full transition-colors ${
                      isActive ? "bg-brand-green" : "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
            <button
              onClick={applyFullRange}
              className="flex-1 flex flex-col items-center gap-1 min-w-0"
            >
              <span
                className={`whitespace-nowrap transition-colors ${
                  isFullRange
                    ? "body-16-bold text-brand-green"
                    : "body-16-medium text-gray-100 hover:text-gray-80"
                }`}
              >
                {t("deposit.fullRange")}
              </span>
              <div
                className={`h-0.5 w-full transition-colors ${
                  isFullRange ? "bg-brand-green" : "bg-transparent"
                }`}
              />
            </button>
          </div>

          {/* Chart area: histogram + handles + bottom price labels + zoom controls */}
          <div className="relative h-[220px]">
            {/* Histogram (or skeleton) */}
            {isChartLoading ? (
              <div className="flex items-end gap-px h-[190px] animate-pulse" aria-hidden="true">
                {SKELETON_BAR_HEIGHTS.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gray-30"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            ) : (
              <div
                ref={chartRef}
                className="flex items-end gap-px h-[190px]"
              >
                {histogramBars.map(
                  (bar: { price: number; volume: number }, index: number) => {
                    const barPrice = bar.price;
                    const inRange =
                      isFullRange ||
                      (barPrice >= lowPrice &&
                        barPrice <=
                          (highPrice === Infinity ? Infinity : highPrice));
                    return (
                      <div
                        key={index}
                        className={`flex-1 transition-all duration-200 ${
                          inRange ? "bg-green-10/30" : "bg-gray-30"
                        }`}
                        style={{ height: `${Math.max(2, bar.volume)}%` }}
                      />
                    );
                  },
                )}
              </div>
            )}

            {/* Range overlay + current price line — suppressed while loading */}
            {!isChartLoading && (
              <>
                {/* Range fill */}
                {!isFullRange && (
                  <div className="absolute top-0 left-0 right-0 h-[190px] pointer-events-none">
                    <div
                      className="absolute top-0 bottom-0 bg-brand-green/20"
                      style={{
                        left: `${lowMarkerPos}%`,
                        width: `${Math.max(0, highMarkerPos - lowMarkerPos)}%`,
                      }}
                    />

                    {/* Low Range handle */}
                    <div
                      className="absolute top-0 bottom-0 z-10 pointer-events-auto group"
                      style={{ left: `${lowMarkerPos}%` }}
                      onMouseDown={handleDragStart("low")}
                      onTouchStart={handleDragStart("low")}
                    >
                      <div className="absolute top-0 bottom-0 -left-2 w-4 cursor-ew-resize" />
                      {/* Vertical handle bar */}
                      <div
                        className={`absolute top-0 bottom-0 left-0 w-[5px] -translate-x-1/2 transition-colors ${
                          dragging === "low"
                            ? "bg-green-30"
                            : "bg-green-20 group-hover:bg-green-30"
                        }`}
                      />
                      {/* Grip indicator at top of bar */}
                      <div
                        className={`absolute top-0 left-0 -translate-x-1/2 w-4 h-7 rounded-[3px] flex items-center justify-center gap-1 cursor-ew-resize select-none transition-colors ${
                          dragging === "low" ? "bg-green-30" : "bg-green-20 group-hover:bg-green-30"
                        }`}
                      >
                        <span className="block w-px h-4 bg-white/70" />
                        <span className="block w-px h-4 bg-white/70" />
                      </div>
                      {/* Offset % label — sits OUTSIDE the range fill, to the left of the handle */}
                      <div
                        className={`absolute top-0 left-0 -translate-x-full -ml-1 flex items-center justify-center px-1.5 py-0.5 rounded-[5px] text-white text-[12px] leading-[18px] font-medium cursor-ew-resize select-none whitespace-nowrap transition-colors ${
                          dragging === "low" ? "bg-green-30" : "bg-green-20"
                        }`}
                      >
                        {lowOffsetPct !== null
                          ? formatOffset(lowOffsetPct)
                          : formatPrice(lowPrice)}
                      </div>
                    </div>

                    {/* High Range handle */}
                    <div
                      className="absolute top-0 bottom-0 z-10 pointer-events-auto group"
                      style={{ left: `${highMarkerPos}%` }}
                      onMouseDown={handleDragStart("high")}
                      onTouchStart={handleDragStart("high")}
                    >
                      <div className="absolute top-0 bottom-0 -left-2 w-4 cursor-ew-resize" />
                      {/* Vertical handle bar */}
                      <div
                        className={`absolute top-0 bottom-0 left-0 w-[5px] -translate-x-1/2 transition-colors ${
                          dragging === "high"
                            ? "bg-green-30"
                            : "bg-green-20 group-hover:bg-green-30"
                        }`}
                      />
                      {/* Grip indicator at top of bar */}
                      <div
                        className={`absolute top-0 left-0 -translate-x-1/2 w-4 h-7 rounded-[3px] flex items-center justify-center gap-1 cursor-ew-resize select-none transition-colors ${
                          dragging === "high" ? "bg-green-30" : "bg-green-20 group-hover:bg-green-30"
                        }`}
                      >
                        <span className="block w-px h-4 bg-white/70" />
                        <span className="block w-px h-4 bg-white/70" />
                      </div>
                      {/* Offset % label — sits OUTSIDE the range fill, to the right of the handle */}
                      <div
                        className={`absolute top-0 left-0 ml-2 flex items-center justify-center px-1.5 py-0.5 rounded-[5px] text-white text-[12px] leading-[18px] font-medium cursor-ew-resize select-none whitespace-nowrap transition-colors ${
                          dragging === "high" ? "bg-green-30" : "bg-green-20"
                        }`}
                      >
                        {highOffsetPct !== null
                          ? formatOffset(highOffsetPct)
                          : highPrice === Infinity
                            ? "∞"
                            : formatPrice(highPrice)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Current Price vertical line */}
                <div className="absolute top-0 left-0 right-0 h-[190px] pointer-events-none">
                  <div
                    className="absolute top-0 bottom-0 w-px bg-gray-100 z-20"
                    style={{ left: `${currentMarkerPos}%` }}
                  />
                </div>
              </>
            )}

            {/* Bottom baseline */}
            <div className="absolute left-0 right-0 top-[189px] h-px bg-gray-30" />

            {/* X-axis price labels */}
            {isChartLoading ? (
              <div className="absolute left-0 right-0 top-[199px] flex justify-between animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className="block h-[21px] w-14 bg-gray-30 rounded"
                  />
                ))}
              </div>
            ) : (
              <div className="absolute left-0 right-0 top-[199px] flex justify-between body-14-medium text-gray-100 whitespace-nowrap">
                {xAxisLabels.map((label, i) => (
                  <span key={i}>{label}</span>
                ))}
              </div>
            )}

            {/* Refresh control — the zoom/recenter buttons from the Figma design
                are intentionally omitted for now because the liquidity
                distribution endpoint returns a fixed window and client-side
                zoom hasn't been designed yet. */}
            <div className="absolute top-[95px] -translate-y-1/2 right-0 flex flex-col gap-2">
              <button
                type="button"
                aria-label="refresh"
                onClick={() => refetchLiquidity()}
                className="bg-gray-20 rounded-[5px] p-1 flex items-center justify-center text-gray-100 hover:bg-gray-30 transition-colors"
              >
                <svg className="size-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M3.5 10a6.5 6.5 0 0111.02-4.7M16.5 10a6.5 6.5 0 01-11.02 4.7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path d="M14.5 2v3.5H11M5.5 18v-3.5H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Low / High Input Fields — per Figma, + on the left, − on the right */}
        <div className="flex gap-5 w-full">
          {/* Low */}
          <div className="flex-1 min-w-0 flex flex-col gap-2.5">
            <label className="body-14-medium text-gray-100 w-full">
              {t("deposit.low")}
            </label>
            <div className="bg-gray-20 rounded-[20px] flex items-center gap-2.5 px-2.5 py-5">
              <button
                onClick={handleLowPricePlus}
                disabled={isFullRange}
                aria-label="increase low"
                className="shrink-0 size-6 flex items-center justify-center text-gray-100 hover:text-gray-80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  className="size-4"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M8 3v10M3 8h10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <input
                type="text"
                value={isFullRange ? (isInverted ? "∞" : "0") : lowPriceInput}
                disabled={isFullRange}
                onChange={(e) => {
                  if (/^\d*\.?\d*$/.test(e.target.value)) {
                    setLowPriceInput(e.target.value);
                  }
                }}
                onFocus={() => setIsEditingLow(true)}
                onBlur={commitLowPrice}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitLowPrice();
                }}
                className="flex-1 min-w-0 text-right body-16-bold text-gray-100 outline-none bg-transparent disabled:text-gray-50"
              />
              <button
                onClick={handleLowPriceMinus}
                disabled={isFullRange}
                aria-label="decrease low"
                className="shrink-0 size-6 flex items-center justify-center text-gray-100 hover:text-gray-80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  className="size-4"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 8h10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* High */}
          <div className="flex-1 min-w-0 flex flex-col gap-2.5">
            <label className="body-14-medium text-gray-100 w-full">
              {t("deposit.high")}
            </label>
            <div className="bg-gray-20 rounded-[20px] flex items-center gap-2.5 px-2.5 py-5">
              <button
                onClick={handleHighPricePlus}
                disabled={isFullRange}
                aria-label="increase high"
                className="shrink-0 size-6 flex items-center justify-center text-gray-100 hover:text-gray-80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  className="size-4"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M8 3v10M3 8h10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <input
                type="text"
                value={isFullRange ? (isInverted ? "0" : "∞") : highPriceInput}
                disabled={isFullRange}
                onChange={(e) => {
                  if (/^\d*\.?\d*$/.test(e.target.value)) {
                    setHighPriceInput(e.target.value);
                  }
                }}
                onFocus={() => setIsEditingHigh(true)}
                onBlur={commitHighPrice}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitHighPrice();
                }}
                className="flex-1 min-w-0 text-right body-16-bold text-gray-100 outline-none bg-transparent disabled:text-gray-50"
              />
              <button
                onClick={handleHighPriceMinus}
                disabled={isFullRange}
                aria-label="decrease high"
                className="shrink-0 size-6 flex items-center justify-center text-gray-100 hover:text-gray-80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  className="size-4"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 8h10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Out-of-range warning */}
        {!isInRange && !isFullRange && (
          <div className="p-3 bg-red-10 border border-red-30/30 rounded-xl text-red-40 body-12">
            {t("deposit.priceRangeWarning")}
          </div>
        )}
      </div>
    </div>
  );
}
