"use client";

import { useTranslations } from "next-intl";
import { TokenPairIcon } from "@/components/common/TokenIcon";
import type { TokenInfo } from "@/hooks/useContractAddresses";
import { formatAPR, formatUSD } from "@/hooks/useIndexerStats";
import { ChevronDown } from "./icons";
import { MobileSectionHeading } from "./SectionHeading";
import type {
  ConfigurationRow,
  LaunchPoolRowMetrics,
  PoolCategory,
  PoolSelection,
} from "./types";

interface PoolCardProps {
  row: ConfigurationRow;
  sortedToken0: TokenInfo;
  sortedToken1: TokenInfo;
  onDeposit: (selection: NonNullable<PoolSelection>) => void;
}

function PoolCard({
  row,
  sortedToken0,
  sortedToken1,
  onDeposit,
}: PoolCardProps) {
  const t = useTranslations();
  const hasPool = !!row.poolMetrics;
  const tvlText = hasPool
    ? `~${formatUSD((row.poolMetrics as LaunchPoolRowMetrics).tvl)}`
    : "~$0.0";
  const aprText = hasPool
    ? formatAPR((row.poolMetrics as LaunchPoolRowMetrics).apr7d)
    : "0.0%";

  return (
    <article className="bg-white rounded-[20px] p-4 flex flex-col gap-2.5 w-full">
      <header className="bg-gray-20 rounded-[10px] p-2.5 flex items-center gap-3.5">
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <TokenPairIcon
            leftAddress={sortedToken0.address}
            leftSymbol={sortedToken0.symbol}
            leftIconUrl={sortedToken0.iconUrl}
            rightAddress={sortedToken1.address}
            rightSymbol={sortedToken1.symbol}
            rightIconUrl={sortedToken1.iconUrl}
            size={16}
          />
          <span className="body-14-bold text-gray-100 truncate">
            {sortedToken0.symbol} - {sortedToken1.symbol}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 text-gray-100 body-12 font-medium whitespace-nowrap">
          <span>{row.strategyTop}</span>
          <span>{row.strategyBottom}</span>
        </div>
      </header>

      <div className="flex items-start justify-between gap-3">
        <StatColumn label={t("pool.tvl")} value={tvlText} valueBold={false} />
        <StatColumn label="APR" value={aprText} valueBold />
      </div>

      <button
        type="button"
        onClick={() => onDeposit(row.poolSelection)}
        className="w-full px-5 py-2.5 rounded-[20px] bg-brand-green text-gray-100 body-16-bold hover:bg-green-10 transition-colors min-h-[44px]"
      >
        {t("launchPool.newDeposit")}
      </button>
    </article>
  );
}

function StatColumn({
  label,
  value,
  valueBold,
}: {
  label: string;
  value: string;
  valueBold: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col items-center gap-2.5 min-w-0">
      <div className="w-full flex flex-col gap-1.5">
        <span className="body-12-bold text-gray-100 text-center w-full">
          {label}
        </span>
        <span aria-hidden="true" className="h-px w-full bg-gray-30" />
      </div>
      <span
        className={`w-full text-center whitespace-nowrap text-gray-100 ${
          valueBold ? "body-12-bold" : "body-12 font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function PoolCardSkeleton() {
  return (
    <article className="bg-white rounded-[20px] p-4 flex flex-col gap-2.5 w-full">
      <div className="bg-gray-20 rounded-[10px] p-2.5 h-9 animate-pulse" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 h-12 bg-gray-20 rounded animate-pulse" />
        <div className="flex-1 h-12 bg-gray-20 rounded animate-pulse" />
      </div>
      <div className="h-11 bg-gray-20 rounded-[20px] animate-pulse" />
    </article>
  );
}

export interface SelectRelatedPoolMobileSectionProps {
  sortedToken0: TokenInfo | null;
  sortedToken1: TokenInfo | null;
  configurationRows: ConfigurationRow[];
  poolCategory: NonNullable<PoolCategory>;
  isLoadingPools: boolean;
  onDeposit: (selection: NonNullable<PoolSelection>) => void;
}

export function SelectRelatedPoolMobileSection({
  sortedToken0,
  sortedToken1,
  configurationRows,
  poolCategory,
  isLoadingPools,
  onDeposit,
}: SelectRelatedPoolMobileSectionProps) {
  const t = useTranslations();
  const skeletonCount = poolCategory === "cl" ? 5 : 2;

  return (
    <section className="flex flex-col w-full">
      <MobileSectionHeading>
        {t("launchPool.selectRelatedPool")}
      </MobileSectionHeading>

      <div className="flex flex-col items-center justify-center gap-2 w-full">
        {isLoadingPools
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <PoolCardSkeleton key={i} />
            ))
          : configurationRows.map((row) =>
              sortedToken0 && sortedToken1 ? (
                <PoolCard
                  key={row.key}
                  row={row}
                  sortedToken0={sortedToken0}
                  sortedToken1={sortedToken1}
                  onDeposit={onDeposit}
                />
              ) : null,
            )}

        <button
          type="button"
          className="flex items-center gap-2 py-2 text-gray-100"
        >
          <span className="body-14-bold">
            {t("launchPool.showLowLiquidityPools")}
          </span>
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}
