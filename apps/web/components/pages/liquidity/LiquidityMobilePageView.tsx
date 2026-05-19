"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageBanner } from "@/components/common/PageBanner";
import { SitePageShell } from "@/components/pages/_lib/SitePageShell";
import { formatAPR, formatUSD } from "@/hooks/useIndexerStats";
import { usePoolFilters, type FilterButtonId } from "@/hooks/usePoolFilters";
import { usePools, type PoolInfo } from "@/hooks/usePools";
import { GIWA_SEPOLIA_CHAIN_ID, MOCK_DATA_ENABLED } from "@/lib/config";
import { sumGatewayMetrics } from "@/lib/gatewayPoolMetrics";

const ITEMS_PER_PAGE = 10;

const FILTER_IDS: FilterButtonId[] = [
  "all",
  "concentrated",
  "basic",
  "volatile",
  "stable",
  "incentivized",
];

function LaunchPoolIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M17.4004 9.82269L21.6004 11.9755L12.0004 16.8963L2.40039 11.9755L6.67715 9.78334M17.4004 14.5268L21.6004 16.6796L12.0004 21.6004L2.40039 16.6796L6.67715 14.4875M12.0004 2.40039L21.6004 7.32114L12.0004 12.2419L2.40039 7.32114L12.0004 2.40039Z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="h-6 w-6 shrink-0 text-gray-60"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function getFilterLabel(id: FilterButtonId, t: (k: string) => string) {
  switch (id) {
    case "all":
      return t("vote.all");
    case "concentrated":
      return t("pool.concentrated");
    case "basic":
      return t("pool.basic");
    case "volatile":
      return t("pool.volatile");
    case "stable":
      return t("pool.stable");
    case "incentivized":
      return t("pool.incentivized");
  }
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-end gap-1 leading-[18px] whitespace-nowrap">
      <span className="body-12 font-medium">{label}</span>
      <span className="body-12-bold">{value}</span>
    </span>
  );
}

function MobilePagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  // Compact, dark-background pagination tuned for the mobile liquidity view.
  // The shared `Pagination` is light-themed and lives inside white cards.
  const pages = useMemo<(number | "...")[]>(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const items: (number | "...")[] = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) items.push("...");
    for (let i = start; i <= end; i++) items.push(i);
    if (end < totalPages - 1) items.push("...");
    items.push(totalPages);
    return items;
  }, [currentPage, totalPages]);

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-5 py-2"
    >
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className="w-6 h-6 flex items-center justify-center text-gray-40 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <svg
          className="w-3 h-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      {pages.map((p, idx) =>
        p === "..." ? (
          <span
            key={`gap-${idx}`}
            aria-hidden="true"
            className="text-gray-50 body-16"
          >
            …
          </span>
        ) : p === currentPage ? (
          <span
            key={p}
            aria-current="page"
            className="w-6 h-6 flex items-center justify-center rounded-full bg-green-10 text-white body-16-bold leading-6"
          >
            {p}
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className="text-gray-50 hover:text-white body-16 leading-6 transition-colors"
            aria-label={`Go to page ${p}`}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className="w-6 h-6 flex items-center justify-center text-gray-40 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <svg
          className="w-3 h-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </nav>
  );
}

function PoolMobileCard({ pool }: { pool: PoolInfo }) {
  const router = useRouter();
  const t = useTranslations();

  const isStable = pool.isStable;
  const isCL = pool.poolType === "CL";

  const strategyLabel = isCL ? t("pool.concentrated") : t("pool.basic");
  const typeLabel = isStable ? t("pool.stable") : t("pool.volatile");

  const feeDisplay = useMemo(() => {
    if (
      pool.effectiveFeeBps !== undefined &&
      pool.effectiveFeeBps !== null &&
      Number.isFinite(pool.effectiveFeeBps)
    ) {
      return `${(pool.effectiveFeeBps / 100).toFixed(2)}%`;
    }
    return isStable ? "0.05%" : "0.30%";
  }, [pool.effectiveFeeBps, isStable]);

  const tvlDisplay = formatGatewayUsd(pool.gateway?.tvlDisplayUsd);
  const volumeDisplay = formatGatewayUsd(pool.gateway?.volume24hUsd);
  const feesDisplay = formatGatewayUsd(pool.gateway?.feesDayUsd);
  const swapFeeApr = formatAPR(String(pool.gateway?.swapAprApprox ?? 0));
  // Pre-TGE: no on-chain gauge → emission APR is N/A. Once gauges exist this
  // becomes a real number.
  const emissionApr = pool.hasGauge ? "-" : "N/A";

  const pairLeft = pool.displayBase ?? pool.token0;
  const pairRight = pool.displayQuote ?? pool.token1;

  const handleDeposit = () => {
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

  return (
    <article className="bg-white rounded-[20px] p-4 flex flex-col gap-3.5">
      {/* Pair header */}
      <header className="bg-gray-20 rounded-[10px] p-2.5 flex items-center justify-between gap-2">
        <span className="body-14-bold text-gray-100 truncate min-w-0">
          {pairLeft.symbol} - {pairRight.symbol}
        </span>
        <div className="flex items-center gap-1 shrink-0 body-12 font-medium text-gray-100 whitespace-nowrap">
          <span>{strategyLabel}</span>
          <span>{typeLabel}</span>
          <span>{feeDisplay}</span>
        </div>
      </header>

      {/* Stats grid */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <PoolStatColumn label={t("pool.tvl")} value={tvlDisplay} />
          <PoolStatColumn label={t("pool.volume24h")} value={volumeDisplay} />
          <PoolStatColumn
            label={t("pool.accumulatedFees")}
            value={feesDisplay}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <PoolStatColumn label={t("pool.emissionAPR")} value={emissionApr} />
          <PoolStatColumn label={t("pool.swapFeeAPR")} value={swapFeeApr} />
          {/* Reserve the third slot so columns align with the row above. */}
          <span aria-hidden="true" />
        </div>
      </div>

      <button
        type="button"
        onClick={handleDeposit}
        className="w-full px-5 py-2.5 rounded-[20px] bg-brand-green text-gray-100 body-16-bold leading-6 hover:bg-primary-200 transition-colors min-h-[44px]"
      >
        Deposit
      </button>
    </article>
  );
}

function PoolStatColumn({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <span className="body-12-bold text-gray-100 text-center w-full break-keep">
        {label}
      </span>
      <span aria-hidden="true" className="h-px w-full bg-gray-30" />
      <span className="body-14-medium text-gray-100 text-center w-full truncate">
        {value}
      </span>
    </div>
  );
}

function LiquidityMobileContent() {
  const t = useTranslations();
  const { pools, isLoading, pairsFromGateway } = usePools();
  // The "Preview data" badge surfaces whenever the mock layer is active
  // (`NEXT_PUBLIC_MOCK_DATA=true`); `usePools` then resolves to canned data
  // injected at `apiFetch` (see `lib/mocks.ts`).
  const isUsingMockPools = MOCK_DATA_ENABLED;
  const headerGateway = useMemo(() => sumGatewayMetrics(pools), [pools]);
  const { handleClick, isActive, isDisabled, filterPool, isAll } =
    usePoolFilters({ disableIncentivizedFilter: pairsFromGateway });
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredPools = useMemo(() => {
    return pools.filter((pool) => {
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
  }, [pools, searchQuery, filterPool]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPools.length / ITEMS_PER_PAGE),
  );
  const paginatedPools = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPools.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPools, currentPage]);

  const tvlDisplay =
    headerGateway.tvlDisplayUsd > 0
      ? `~${formatUSD(String(headerGateway.tvlDisplayUsd))}`
      : "TBD";
  const volumeDisplay =
    headerGateway.volume24hUsd > 0
      ? `~${formatUSD(String(headerGateway.volume24hUsd))}`
      : "TBD";
  const feesDisplay =
    headerGateway.feesDayUsd > 0
      ? `~${formatUSD(String(headerGateway.feesDayUsd))}`
      : "TBD";

  const handleFilterClick = useCallback(
    (id: FilterButtonId) => {
      handleClick(id);
      setCurrentPage(1);
    },
    [handleClick],
  );

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    setCurrentPage(1);
  }, []);

  const emptyMessage = useMemo(() => {
    if (searchQuery) return t("pool.noSearchResults");
    if (!isAll) return t("pool.noFilterResults");
    return t("pool.noPoolsCreated");
  }, [searchQuery, isAll, t]);

  return (
    <SitePageShell className="relative bg-black">
      {/* Background image at the top, fading to black — mirrors `/swap` layout
          but scoped to this mobile view so the desktop layout is untouched. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-no-repeat bg-top bg-cover"
        style={{ backgroundImage: "url('/background.png')" }}
      >
        <div className="absolute inset-x-0 bottom-0 h-[200px] bg-linear-to-b from-transparent to-black" />
      </div>

      <main className="relative z-10 flex-1 pb-10">
        <PageBanner
          page="LIQUIDITY"
          pcWidth={1360}
          pcHeight={215}
          mobileWidth={390}
          mobileHeight={240}
        />

        {/* Stats + Launch Pool */}
        <section className="px-4 mt-10 flex flex-col items-center gap-2.5">
          <div className="flex flex-wrap items-end justify-center gap-x-2.5 gap-y-1 text-gray-40">
            <StatPill label={t("pool.tvl")} value={tvlDisplay} />
            <StatPill label={t("pool.volume")} value={volumeDisplay} />
            <StatPill label={t("vote.fees")} value={feesDisplay} />
          </div>
          <Link
            href="/pool/launch"
            className="inline-flex items-center justify-center gap-2.5 px-2.5 py-1.5 rounded-[10px] bg-brand-green text-brand-black hover:bg-primary-200 transition-colors min-h-[36px]"
          >
            <span className="body-14-bold leading-[21px]">
              {t("liquidity.launchPool")}
            </span>
            <LaunchPoolIcon />
          </Link>
        </section>

        {/* Pools list */}
        <section className="mt-6 px-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 px-4">
            <h1 className="body-16-bold text-white">{t("pool.pools")}</h1>
            {isUsingMockPools ? (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-gray-40 body-12 font-medium">
                Preview data
              </span>
            ) : null}
          </div>

          <div className="bg-white rounded-[20px] p-4 flex flex-col gap-3.5">
            <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
              {FILTER_IDS.map((id) => {
                const active = isActive(id);
                const disabled = isDisabled(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleFilterClick(id)}
                    disabled={disabled}
                    aria-pressed={active}
                    className={`whitespace-nowrap shrink-0 px-2.5 py-2 rounded-[10px] body-12 font-medium transition-colors min-h-[34px] ${
                      active
                        ? "bg-gray-100 text-white"
                        : disabled
                          ? "bg-gray-20 text-gray-50 opacity-60 cursor-not-allowed"
                          : "bg-gray-20 text-gray-100"
                    }`}
                  >
                    {getFilterLabel(id, t)}
                  </button>
                );
              })}
            </div>

            <label className="flex items-center justify-between gap-3 h-12 px-4 rounded-full border border-gray-60 bg-white focus-within:border-primary-200 transition-colors">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t("common.searchAll")}
                aria-label={t("common.searchAll")}
                className="flex-1 min-w-0 bg-transparent body-14-medium text-gray-100 placeholder:text-gray-50 outline-none"
              />
              <SearchIcon />
            </label>
          </div>

          {isLoading ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green" />
              <p className="body-14 text-gray-40">{t("common.loadingPools")}</p>
            </div>
          ) : paginatedPools.length === 0 ? (
            <div className="py-10 text-center body-14 text-gray-40">
              {emptyMessage}
            </div>
          ) : (
            paginatedPools.map((pool) => (
              <PoolMobileCard key={pool.address} pool={pool} />
            ))
          )}

          {totalPages > 1 ? (
            <MobilePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          ) : null}
        </section>
      </main>
    </SitePageShell>
  );
}

// Gateway USD amounts: show $0.00 at zero; `formatUSD` maps 0 to "-" which reads
// as missing data.
function formatGatewayUsd(amount: number | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "-";
  if (amount <= 0) return "$0.00";
  return formatUSD(String(amount));
}

export function LiquidityMobilePageView() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-brand-black flex items-center justify-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green" />
        </div>
      }
    >
      <LiquidityMobileContent />
    </Suspense>
  );
}
