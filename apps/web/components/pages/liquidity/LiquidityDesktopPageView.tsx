"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { PageBanner } from "@/components/common/PageBanner";
import { SitePageShell } from "@/components/pages/_lib/SitePageShell";
import { GIWA_SEPOLIA_CHAIN_ID } from "@/lib/config";
import { useRouter } from "next/navigation";
import { usePools, type PoolInfo } from "@/hooks/usePools";
import { formatUSD, formatAPR } from "@/hooks/useIndexerStats";
import { sumGatewayMetrics } from "@/lib/gatewayPoolMetrics";
import { TokenPairIcon } from "@/components/common/TokenIcon";
import { Pagination } from "@/components/portfolio/Pagination";
import { usePoolFilters, type FilterButtonId } from "@/hooks/usePoolFilters";

// Sortable column fields
type SortField =
  | "realtimeFee"
  | "tvl"
  | "volume24h"
  | "feesTotal"
  | "apr7d"
  | "emissionApr";
type SortOrder = "desc" | "asc";

// Sort arrow indicator
function SortArrow({ direction }: { direction: SortOrder }) {
  return (
    <svg
      className="w-3 h-3 ml-0.5 inline-block"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {direction === "desc" ? (
        <path
          d="M7 3L7 11M7 11L3 7M7 11L11 7"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M7 11L7 3M7 3L3 7M7 3L11 7"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

// Tooltip info icon (placeholder bubble as in Figma)
function InfoIcon() {
  return (
    <span className="inline-flex items-center justify-center size-4 rounded-full bg-gray-20 text-gray-60 text-[10px] leading-none">
      i
    </span>
  );
}

// Single-pill filter button (All / Incentivized)
function SinglePillButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const base =
    "flex-1 min-w-0 flex items-center justify-center py-4 rounded-[10px] body-16-bold transition-colors";
  const state = active
    ? "bg-gray-100 text-white"
    : disabled
      ? "bg-gray-20 text-gray-50 opacity-60 cursor-not-allowed"
      : "bg-gray-20 text-black hover:bg-gray-30";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${state}`}
    >
      {children}
    </button>
  );
}

// Grouped filter pill (Basic | Concentrated, Stable | Volatile)
function GroupedFilterButtons({
  left,
  right,
}: {
  left: {
    id: FilterButtonId;
    label: string;
    active: boolean;
    disabled: boolean;
    onClick: () => void;
  };
  right: {
    id: FilterButtonId;
    label: string;
    active: boolean;
    disabled: boolean;
    onClick: () => void;
  };
}) {
  const groupDisabled = left.disabled && right.disabled;

  const itemClass = (active: boolean, disabled: boolean) => {
    if (active) return "bg-gray-100 text-white";
    if (disabled) return "text-gray-50 opacity-60 cursor-not-allowed";
    return "text-black hover:bg-white/60";
  };

  return (
    <div
      className={`flex-1 min-w-0 flex items-center justify-center gap-4 px-1 py-2 rounded-[10px] bg-gray-20 ${
        groupDisabled ? "opacity-70" : ""
      }`}
    >
      <button
        type="button"
        onClick={left.onClick}
        disabled={left.disabled}
        className={`px-4 py-2 rounded-[8px] body-16-bold transition-colors ${itemClass(
          left.active,
          left.disabled,
        )}`}
      >
        {left.label}
      </button>
      <span className="block w-px h-6 bg-gray-40" aria-hidden="true" />
      <button
        type="button"
        onClick={right.onClick}
        disabled={right.disabled}
        className={`px-4 py-2 rounded-[8px] body-16-bold transition-colors ${itemClass(
          right.active,
          right.disabled,
        )}`}
      >
        {right.label}
      </button>
    </div>
  );
}

// Sortable category subheader cell
function SortableHeader({
  field,
  currentField,
  sortOrder,
  onClick,
  children,
  width,
  showTooltip = false,
}: {
  field: SortField;
  currentField: SortField | null;
  sortOrder: SortOrder;
  onClick: (field: SortField) => void;
  children: React.ReactNode;
  width: string;
  showTooltip?: boolean;
}) {
  const isActive = currentField === field;
  return (
    <th className="p-[10px] w-full max-w-[140px] min-w-[100px] align-middle" style={{ width }}>
      <button
        type="button"
        onClick={() => onClick(field)}
        className={`inline-flex items-center justify-center gap-1 body-14-medium text-gray-100 hover:text-gray-90 transition-colors ${
          isActive ? "font-bold" : ""
        }`}
      >
        <span className="whitespace-nowrap">{children}</span>
        {showTooltip && <InfoIcon />}
        {isActive && <SortArrow direction={sortOrder} />}
      </button>
    </th>
  );
}

// Inner component that uses useSearchParams (needs Suspense boundary)
function LiquidityContent() {
  const { pools, isLoading, pairsFromGateway } = usePools();
  const t = useTranslations();
  const headerGateway = useMemo(() => sumGatewayMetrics(pools), [pools]);
  const { handleClick, isActive, isDisabled, filterPool, isAll } =
    usePoolFilters({ disableIncentivizedFilter: pairsFromGateway });
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const ITEMS_PER_PAGE = 20;

  const totalTVL = useMemo(() => {
    const v = headerGateway.tvlDisplayUsd;
    if (v > 0) return formatUSD(String(v));
    return "TBD";
  }, [headerGateway.tvlDisplayUsd]);

  const getSortValue = useCallback((pool: PoolInfo, field: SortField): number => {
    const g = pool.gateway;
    switch (field) {
      case "realtimeFee":
        if (
          pool.effectiveFeeBps !== undefined &&
          pool.effectiveFeeBps !== null &&
          Number.isFinite(pool.effectiveFeeBps)
        ) {
          return pool.effectiveFeeBps / 100;
        }
        if (pool.poolType === "CL") return 0;
        return pool.isStable ? 0.05 : 0.3;
      case "tvl":
        return g?.tvlDisplayUsd ?? 0;
      case "volume24h":
        return g?.volume24hUsd ?? 0;
      case "feesTotal":
        return g?.totalSwapFeesUsd ?? 0;
      case "apr7d":
        return g?.swapAprApprox ?? 0;
      case "emissionApr":
        return 0;
      default:
        return 0;
    }
  }, []);

  // Filter pools based on hierarchical filter and search query
  const filteredPools = useMemo(() => {
    const filtered = pools.filter((pool) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        searchQuery === "" ||
        pool.token0.symbol.toLowerCase().includes(q) ||
        pool.token1.symbol.toLowerCase().includes(q) ||
        pool.displayBase?.symbol.toLowerCase().includes(q) ||
        pool.displayQuote?.symbol.toLowerCase().includes(q) ||
        pool.name.toLowerCase().includes(q);

      return matchesSearch && filterPool(pool);
    });

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        const aVal = getSortValue(a, sortField);
        const bVal = getSortValue(b, sortField);
        return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
      });
    }

    return filtered;
  }, [pools, searchQuery, filterPool, sortField, sortOrder, getSortValue]);

  // Column sort click handler
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
      } else {
        setSortField(field);
        setSortOrder("desc");
      }
      setCurrentPage(1);
    },
    [sortField],
  );

  // Reset to page 1 when filters change
  const handleFilterClick = useCallback(
    (id: FilterButtonId) => {
      handleClick(id);
      setCurrentPage(1);
    },
    [handleClick],
  );

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  // Pagination
  const totalPages = Math.max(
    1,
    Math.ceil(filteredPools.length / ITEMS_PER_PAGE),
  );
  const paginatedPools = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPools.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPools, currentPage]);

  // Determine empty state message
  const emptyMessage = useMemo(() => {
    if (searchQuery) return t("pool.noSearchResults");
    if (!isAll) return t("pool.noFilterResults");
    return t("pool.noPoolsCreated");
  }, [searchQuery, isAll, t]);

  return (
    <SitePageShell>
      <PageBanner page="LIQUIDITY" pcWidth={1360} pcHeight={215} />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-12 w-full flex flex-col gap-4">
        {/* ── Pools Filter / Search / Stats Card ── */}
        <section className="bg-white rounded-[40px] py-[30px] flex flex-col gap-5 shadow-sm">
          {/* Title */}
          <div className="px-8">
            <h1 className="heading-5 text-gray-100">{t("pool.pools")}</h1>
          </div>

          {/* Filter Row */}
          <div className="px-[30px]">
            {/* Desktop (lg+): 4 flex-1 groups */}
            <div className="hidden lg:flex gap-3 items-center">
              <SinglePillButton
                active={isActive("all")}
                onClick={() => handleFilterClick("all")}
              >
                {t("vote.all")}
              </SinglePillButton>

              <GroupedFilterButtons
                left={{
                  id: "basic",
                  label: t("pool.basic"),
                  active: isActive("basic"),
                  disabled: isDisabled("basic"),
                  onClick: () => handleFilterClick("basic"),
                }}
                right={{
                  id: "concentrated",
                  label: t("pool.concentrated"),
                  active: isActive("concentrated"),
                  disabled: isDisabled("concentrated"),
                  onClick: () => handleFilterClick("concentrated"),
                }}
              />

              <GroupedFilterButtons
                left={{
                  id: "stable",
                  label: t("pool.stable"),
                  active: isActive("stable"),
                  disabled: isDisabled("stable"),
                  onClick: () => handleFilterClick("stable"),
                }}
                right={{
                  id: "volatile",
                  label: t("pool.volatile"),
                  active: isActive("volatile"),
                  disabled: isDisabled("volatile"),
                  onClick: () => handleFilterClick("volatile"),
                }}
              />

              <SinglePillButton
                active={isActive("incentivized")}
                disabled={isDisabled("incentivized")}
                onClick={() => handleFilterClick("incentivized")}
              >
                {t("pool.incentivized")}
              </SinglePillButton>
            </div>

            {/* Tablet & Mobile: horizontal scroll, single pills for each */}
            <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {(
                [
                  "all",
                  "basic",
                  "concentrated",
                  "stable",
                  "volatile",
                  "incentivized",
                ] as FilterButtonId[]
              ).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleFilterClick(id)}
                  disabled={isDisabled(id)}
                  className={`whitespace-nowrap shrink-0 px-4 py-3 rounded-[10px] body-14-medium transition-colors ${
                    isActive(id)
                      ? "bg-gray-100 text-white"
                      : isDisabled(id)
                        ? "bg-gray-20 text-gray-50 opacity-60 cursor-not-allowed"
                        : "bg-gray-20 text-black"
                  }`}
                >
                  {id === "all"
                    ? t("vote.all")
                    : id === "basic"
                      ? t("pool.basic")
                      : id === "concentrated"
                        ? t("pool.concentrated")
                        : id === "stable"
                          ? t("pool.stable")
                          : id === "volatile"
                            ? t("pool.volatile")
                            : t("pool.incentivized")}
                </button>
              ))}
            </div>
          </div>

          {/* Search + Stats + Launch Pool */}
          <div className="px-[30px] flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search */}
            <label className="flex w-full lg:max-w-[540px] lg:min-w-0 cursor-text items-center gap-3 rounded-full border border-gray-90 bg-white px-5 py-5 transition-colors focus-within:border-primary-200">
              <input
                type="text"
                placeholder={t("common.searchAll")}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent p-0 body-16-medium text-gray-100 placeholder:text-gray-90 outline-none"
              />
              <svg
                className="h-6 w-6 shrink-0 text-gray-90"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </label>

            {/* Right: Stats + Launch Pool */}
            <div className="flex items-stretch gap-4">
              <StatCard
                value={totalTVL.startsWith("~") ? totalTVL : `~${totalTVL}`}
                label={t("pool.tvl")}
              />
              <StatCard
                value={
                  headerGateway.volume24hUsd > 0
                    ? `~${formatUSD(String(headerGateway.volume24hUsd))}`
                    : "TBD"
                }
                label={t("pool.volume")}
              />
              <StatCard
                value={
                  headerGateway.feesDayUsd > 0
                    ? `~${formatUSD(String(headerGateway.feesDayUsd))}`
                    : "TBD"
                }
                label={t("vote.fees")}
              />

              {/* Launch Pool Button */}
              <Link
                href="/pool/launch"
                className="flex flex-col items-center justify-center gap-1 bg-primary-100 hover:bg-primary-200 text-black rounded-[20px] transition-colors w-[109px] shrink-0"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17.4004 9.82269L21.6004 11.9755L12.0004 16.8963L2.40039 11.9755L6.67715 9.78334M17.4004 14.5268L21.6004 16.6796L12.0004 21.6004L2.40039 16.6796L6.67715 14.4875M12.0004 2.40039L21.6004 7.32114L12.0004 12.2419L2.40039 7.32114L12.0004 2.40039Z"
                    stroke="black"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="body-14-bold whitespace-nowrap">
                  {t("liquidity.launchPool")}
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Pool Table Card ── */}
        <section className="bg-white rounded-[40px] py-[30px] px-[30px] shadow-sm">
          <div className="bg-gray-10 rounded-[20px] overflow-hidden">
            {isLoading ? (
              <div className="py-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-90" />
                <p className="text-gray-70 mt-4 body-14">
                  {t("common.loadingPools")}
                </p>
              </div>
            ) : paginatedPools.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-70 body-14">{emptyMessage}</p>
              </div>
            ) : (
              <div
                key={`${filteredPools.length}`}
                className="overflow-x-auto animate-[fadeIn_0.15s_ease] -mx-1 px-1"
              >
                <table className="w-full">
                  {/* Category Headers with underlines */}
                  <thead>
                    <tr>
                      <th
                        colSpan={2}
                        className="pt-[30px] px-[10px] pb-0 text-center"
                      >
                        <div className="flex flex-col items-center gap-5">
                          <span className="body-14-bold text-gray-100">
                            {t("pool.poolStrategy")}
                          </span>
                          <span className="block w-full h-px bg-gray-30" />
                        </div>
                      </th>
                      <th
                        colSpan={4}
                        className="pt-[30px] px-[10px] pb-0 text-center"
                      >
                        <div className="flex flex-col items-center gap-5">
                          <span className="body-14-bold text-gray-100">
                            {t("pool.poolStatistics")}
                          </span>
                          <span className="block w-full h-px bg-gray-30" />
                        </div>
                      </th>
                      <th
                        colSpan={3}
                        className="pt-[30px] px-[10px] pb-0 text-center"
                      >
                        <div className="flex flex-col items-center gap-5">
                          <span className="body-14-bold text-gray-100">
                            {t("pool.earningRates")}
                          </span>
                          <span className="block w-full h-px bg-gray-30" />
                        </div>
                      </th>
                    </tr>
                    {/* Sub Headers */}
                    <tr>
                      <th
                        className="p-[10px] text-center body-14-medium text-gray-100"
                        style={{ width: "165px" }}
                      >
                        {t("pool.tokenPair")}
                      </th>
                      <th
                        className="p-[10px] text-center body-14-medium text-gray-100"
                        style={{ width: "140px" }}
                      >
                        {t("pool.strategyColumn")}
                      </th>
                      <SortableHeader
                        field="realtimeFee"
                        currentField={sortField}
                        sortOrder={sortOrder}
                        onClick={handleSort}
                        width="140px"
                      >
                        {t("pool.realtimeFee")}
                      </SortableHeader>
                      <SortableHeader
                        field="tvl"
                        currentField={sortField}
                        sortOrder={sortOrder}
                        onClick={handleSort}
                        width="140px"
                      >
                        {t("pool.tvl")}
                      </SortableHeader>
                      <SortableHeader
                        field="volume24h"
                        currentField={sortField}
                        sortOrder={sortOrder}
                        onClick={handleSort}
                        width="140px"
                      >
                        {t("pool.volume24h")}
                      </SortableHeader>
                      <SortableHeader
                        field="feesTotal"
                        currentField={sortField}
                        sortOrder={sortOrder}
                        onClick={handleSort}
                        width="140px"
                      >
                        {t("pool.accumulatedFees")}
                      </SortableHeader>
                      <SortableHeader
                        field="apr7d"
                        currentField={sortField}
                        sortOrder={sortOrder}
                        onClick={handleSort}
                        width="140px"
                      >
                        {t("pool.swapFeeAPR")}
                      </SortableHeader>
                      <SortableHeader
                        field="emissionApr"
                        currentField={sortField}
                        sortOrder={sortOrder}
                        onClick={handleSort}
                        width="140px"
                        showTooltip
                      >
                        {t("pool.pointDistPercent")}
                      </SortableHeader>
                      <th
                        className="p-[10px]"
                        style={{ width: "90px" }}
                        aria-label="actions"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPools.map((pool, idx) => (
                      <PoolRow
                        key={pool.address}
                        pool={pool}
                        isLast={idx === paginatedPools.length - 1}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </section>
      </main>
    </SitePageShell>
  );
}

// Wrap with Suspense because usePoolFilters uses useSearchParams
export function LiquidityDesktopPageView() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-200" />
        </div>
      }
    >
      <LiquidityContent />
    </Suspense>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-end justify-center gap-[10px] px-[10px] py-5 border border-gray-30 rounded-[20px] w-[140px] shrink-0 text-right">
      <span className="body-16-semibold text-gray-100 w-full truncate">
        {value}
      </span>
      <span className="body-14-medium text-gray-100 w-full">{label}</span>
    </div>
  );
}

function PoolRow({
  pool,
  isLast,
}: {
  pool: PoolInfo;
  isLast: boolean;
}) {
  const router = useRouter();
  const t = useTranslations();

  // Pool type (stable/volatile) - now available directly from pool data (API v1.1)
  const isStable = pool.isStable;
  const isCL = pool.poolType === "CL";
  const strategyPrimary = isCL ? "Concentrated" : t("pool.basic");
  const strategySecondary = isCL
    ? pool.tickSpacing != null
      ? `CL ${pool.tickSpacing}`
      : "CL"
    : isStable
      ? t("pool.stable")
      : t("pool.volatile");

  // Fee display from broker static fee or fallback
  const feeDisplay = useMemo(() => {
    if (
      pool.effectiveFeeBps !== undefined &&
      pool.effectiveFeeBps !== null &&
      Number.isFinite(pool.effectiveFeeBps)
    ) {
      return `${(pool.effectiveFeeBps / 100).toFixed(2)}%`;
    }
    if (isCL) return "Dynamic";
    return isStable ? "0.05%" : "0.30%";
  }, [pool.effectiveFeeBps, isStable, isCL]);

  const tvlFormatted = useMemo(() => {
    return formatGatewayUsd(pool.gateway?.tvlDisplayUsd);
  }, [pool.gateway?.tvlDisplayUsd]);

  const emissionAPRFormatted = useMemo(() => {
    if (!pool.hasGauge) return "N/A";
    return "-";
  }, [pool.hasGauge]);

  const aprPercent = pool.gateway?.swapAprApprox ?? 0;
  const emissionPercent = 0;

  const handleDeposit = () => {
    // CL pools: positive tick spacing (1, 50, 100, ...)
    // Basic AMM pools: -1 for volatile, 0 for stable
    const poolType = isCL
      ? String(pool.tickSpacing ?? 1)
      : isStable
        ? "0"
        : "-1";

    const params = new URLSearchParams({
      token0: pool.token0.address,
      token1: pool.token1.address,
      type: poolType,
      chain0: GIWA_SEPOLIA_CHAIN_ID.toString(),
      chain1: GIWA_SEPOLIA_CHAIN_ID.toString(),
    });

    router.push(`/deposit?${params.toString()}`);
  };

  const rowBorder = isLast ? "" : "border-b border-gray-30";

  const pairLeft = pool.displayBase ?? pool.token0;
  const pairRight = pool.displayQuote ?? pool.token1;

  return (
    <tr className={`${rowBorder} hover:bg-gray-20/50 transition-colors`}>
      {/* Token Pair (BASE — QUOTE when broker orientation is present) */}
      <td
        className="py-5 pl-[10px] pr-[10px] align-middle min-w-[165px]"
        style={{ width: "165px" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <TokenPairIcon
            leftAddress={pairLeft.address}
            leftSymbol={pairLeft.symbol}
            rightAddress={pairRight.address}
            rightSymbol={pairRight.symbol}
            size={24}
          />
          <div className="flex flex-col min-w-0">
            <span className="body-14-bold text-gray-90 whitespace-nowrap">
              {pairLeft.symbol} - {pairRight.symbol}
            </span>
            <span className={`text-[11px] leading-[14px] font-medium whitespace-nowrap px-1.5 py-0.5 rounded-full w-fit mt-0.5 ${
              isCL
                ? "bg-blue-500/10 text-blue-400"
                : isStable
                  ? "bg-purple-500/10 text-purple-400"
                  : "bg-brand-green/10 text-brand-green"
            }`}>
              {strategySecondary}
            </span>
          </div>
        </div>
      </td>

      {/* Strategy (two lines) */}
      <td
        className="p-[10px] text-center align-middle min-w-[120px]"
        style={{ width: "140px" }}
      >
        <div className="flex flex-col gap-1 body-14-medium text-gray-90">
          <span>{strategyPrimary}</span>
          <span>{strategySecondary}</span>
        </div>
      </td>

      {/* Real-time Fee */}
      <td
        className="p-[10px] text-right body-14-medium text-gray-90 align-middle"
        style={{ width: "140px" }}
      >
        {feeDisplay}
      </td>

      {/* TVL */}
      <td
        className="p-[10px] text-right body-14-medium text-gray-90 align-middle"
        style={{ width: "140px" }}
      >
        <div className="flex flex-col items-end gap-1">
          <span>{tvlFormatted}</span>
        </div>
      </td>

      {/* Volume(24h) */}
      <td
        className="p-[10px] text-center body-14-medium text-gray-90 align-middle"
        style={{ width: "140px" }}
      >
        {formatGatewayUsd(pool.gateway?.volume24hUsd)}
      </td>

      {/* Fees: UTC-day (actual or estimate) + lifetime total */}
      <td
        className="p-[10px] text-right body-14-medium text-gray-90 align-middle"
        style={{ width: "140px" }}
      >
        <div className="flex flex-col items-end gap-0.5">
          <span>{formatGatewayUsd(pool.gateway?.feesDayUsd)}</span>
          {(pool.gateway?.totalSwapFeesUsd ?? 0) > 0 && (
            <span className="body-12-regular text-gray-60">
              Σ {formatGatewayUsd(pool.gateway?.totalSwapFeesUsd)}
            </span>
          )}
        </div>
      </td>

      {/* Swap fee APR */}
      <td
        className="p-[10px] w-full max-w-[140px] min-w-[100px] text-right body-14-medium text-gray-90 align-middle"
      >
        <ProgressCell
          value={formatAPR(String(pool.gateway?.swapAprApprox ?? 0))}
          percent={aprPercent}
        />
      </td>

      {/* Point Dist. % */}
      <td
        className="p-[10px] w-full max-w-[140px] min-w-[100px] text-right body-14-medium text-gray-90 align-middle"
      >
        <ProgressCell value={emissionAPRFormatted} percent={emissionPercent} />
      </td>

      {/* Deposit Button */}
      <td
        className="p-[10px] text-center align-middle w-[90px] min-w-[90px]"
        style={{ width: "90px" }}
      >
        <button
          type="button"
          onClick={handleDeposit}
          className="px-[10px] py-[6px] bg-primary-100 hover:bg-primary-200 text-gray-90 rounded-[10px] body-14-bold transition-colors"
        >
          Deposit
        </button>
      </td>
    </tr>
  );
}

function ProgressCell({ value, percent }: { value: string; percent: number }) {
  const safe = Number.isFinite(percent) ? percent : 0;
  const clamped = Math.max(0, Math.min(safe, 100));
  return (
    <div className="flex flex-col items-end gap-2">
      <span className="body-14-medium text-gray-90 w-full text-wrap">
        {value}
      </span>
      <div className="w-full min-w-[40px] h-[10px] bg-gray-30 rounded-[10px] overflow-hidden">
        <div
          className="h-full bg-green-10 rounded-[10px]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

/** Gateway USD amounts: show $0.00 at zero; `formatUSD` maps 0 to "-" which reads as missing data. */
function formatGatewayUsd(amount: number | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "-";
  if (amount <= 0) return "$0.00";
  return formatUSD(String(amount));
}
