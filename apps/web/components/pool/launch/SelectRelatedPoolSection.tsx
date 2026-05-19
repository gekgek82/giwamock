"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/common/Button";
import { TokenPairIcon } from "@/components/common/TokenIcon";
import type { TokenInfo } from "@/hooks/useContractAddresses";
import { formatAPR, formatUSD } from "@/hooks/useIndexerStats";
import { ChevronDown } from "./icons";
import { SectionHeading } from "./SectionHeading";
import type { ConfigurationRow, PoolCategory, PoolSelection } from "./types";

export interface SelectRelatedPoolSectionProps {
  sortedToken0: TokenInfo | null;
  sortedToken1: TokenInfo | null;
  configurationRows: ConfigurationRow[];
  poolCategory: NonNullable<PoolCategory>;
  isLoadingPools: boolean;
  onDeposit: (selection: NonNullable<PoolSelection>) => void;
}

export function SelectRelatedPoolSection({
  sortedToken0,
  sortedToken1,
  configurationRows,
  poolCategory,
  isLoadingPools,
  onDeposit,
}: SelectRelatedPoolSectionProps) {
  const t = useTranslations();
  const skeletonCount = poolCategory === "cl" ? 5 : 2;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>{t("launchPool.selectRelatedPool")}</SectionHeading>

      <div className="bg-white rounded-[40px] py-[30px] flex flex-col items-center">
        {/* Header row */}
        <div className="w-[calc(100%-40px)] bg-gray-10 rounded-[20px] py-5 flex items-center">
          <div className="flex-1 px-2.5 text-center body-14-bold text-gray-100">
            {t("pool.tokenPair")}
          </div>
          <div className="flex-1 px-2.5 text-center body-14-bold text-gray-100">
            {t("pool.strategyAsset")}
          </div>
          <div className="flex-1 px-2.5 text-center body-14-bold text-gray-100">
            {t("pool.tvl")}
          </div>
          <div className="flex-1 px-2.5 text-center body-14-bold text-gray-100">
            APR
          </div>
          <div className="flex-1 px-2.5 text-center body-14-bold text-gray-100">
            {t("launchPool.addIncentive")}
          </div>
        </div>

        {/* Body rows */}
        <div className="w-full flex flex-col pt-5 px-[30px]">
          {isLoadingPools
            ? Array.from({ length: skeletonCount }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center py-5 border-b border-gray-20 last:border-b-0"
                >
                  <div className="w-full h-6 bg-gray-20 rounded animate-pulse" />
                </div>
              ))
            : configurationRows.map((row, index) => {
                const isLast = index === configurationRows.length - 1;
                const hasPool = !!row.poolMetrics;
                const hasApr =
                  hasPool && parseFloat(row.poolMetrics?.apr7d || "0") > 0;
                return (
                  <div
                    key={row.key}
                    className={`flex items-center gap-2 py-5 ${
                      isLast ? "" : "border-b border-gray-20"
                    }`}
                  >
                    <div className="flex-1 px-2.5 flex items-center gap-1">
                      {sortedToken0 && sortedToken1 && (
                        <TokenPairIcon
                          leftAddress={sortedToken0.address}
                          leftSymbol={sortedToken0.symbol}
                          leftIconUrl={sortedToken0.iconUrl}
                          rightAddress={sortedToken1.address}
                          rightSymbol={sortedToken1.symbol}
                          rightIconUrl={sortedToken1.iconUrl}
                          size={24}
                        />
                      )}
                      <span className="body-14-bold text-gray-100 whitespace-nowrap">
                        {sortedToken0?.symbol} - {sortedToken1?.symbol}
                      </span>
                    </div>

                    <div className="flex-1 px-2.5 flex flex-col items-center justify-center gap-1 body-14-medium text-gray-100">
                      <span>{row.strategyTop}</span>
                      <span>{row.strategyBottom}</span>
                    </div>

                    <div className="flex-1 px-2.5 text-center body-14-medium text-gray-100">
                      {hasPool
                        ? `~${formatUSD(row.poolMetrics!.tvl)}`
                        : "~$0.0"}
                    </div>

                    <div
                      className={`flex-1 px-2.5 text-center body-14-bold ${
                        hasApr ? "text-primary-200" : "text-gray-100"
                      }`}
                    >
                      {hasPool ? formatAPR(row.poolMetrics!.apr7d) : "0.0%"}
                    </div>

                    <div className="flex-1 px-2.5 flex justify-center">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onDeposit(row.poolSelection)}
                      >
                        {t("launchPool.newDeposit")}
                      </Button>
                    </div>
                  </div>
                );
              })}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 py-[30px]">
        <span className="body-14-bold text-gray-100">
          {t("launchPool.showLowLiquidityPools")}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-100" />
      </div>
    </section>
  );
}
