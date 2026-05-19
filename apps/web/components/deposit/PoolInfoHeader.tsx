"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { isAddress, zeroAddress } from "viem";
import { useGauge } from "@/hooks/useGauge";
import { usePoolFee } from "@/hooks/usePoolFee";
import { usePoolTVL } from "@/hooks/usePoolTVL";
import {
  usePoolStatsFromIndexer,
  formatUSD,
  formatAPR,
} from "@/hooks/useIndexerStats";
import { isIndexerConfigured } from "@/lib/indexerApi";
import type { PoolGatewayMetrics } from "@/lib/gatewayPoolMetrics";
import { useEmissionAPR } from "@/hooks/useEmissionAPR";
import { TokenPairIcon } from "@/components/common/TokenIcon";
import { PoolGradeBadge } from "@/components/common/PoolGradeBadge";

function formatBrokerFeesDayAndTotal(g: PoolGatewayMetrics): string {
  const day =
    g.feesDayUsd > 1e-12 ? formatUSD(String(g.feesDayUsd)) : "$0.00";
  const total =
    g.totalSwapFeesUsd > 1e-12
      ? formatUSD(String(g.totalSwapFeesUsd))
      : "—";
  return `${day} · ${total}`;
}

interface PoolInfoHeaderProps {
  token0Symbol: string;
  token1Symbol: string;
  token0Address?: string;
  token1Address?: string;
  token0Decimals?: number;
  token1Decimals?: number;
  poolAddress: `0x${string}`;
  isStable?: boolean;
  strategy?: string;
  poolType?: string;
  tickSpacing?: number;
  grade?: number;
  /** Broker `spot_pairs` metrics when indexer stats are missing or pool is new. */
  brokerPoolStats?: PoolGatewayMetrics | null;
  /** Static fee (bps) from gateway / pool list when on-chain fee read is unavailable. */
  effectiveFeeBps?: number | null;
}

function InfoTooltip({ title }: { title?: string }) {
  return (
    <span
      className="inline-flex items-center justify-center size-4 rounded-full bg-gray-20 text-gray-60 shrink-0"
      title={title}
      aria-hidden={!title}
    >
      <svg
        className="size-2"
        viewBox="0 0 8 8"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M4 0a4 4 0 100 8 4 4 0 000-8zm.5 6h-1V3.5h1V6zm0-3.5h-1v-1h1v1z" />
      </svg>
    </span>
  );
}

function CopyIconButton({
  text,
  ariaLabel,
}: {
  text: string;
  ariaLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center size-5 rounded-[5px] bg-gray-30 text-gray-80 hover:bg-gray-40 transition-colors shrink-0"
    >
      {copied ? (
        <svg className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.5l3.5 3.5L13 5" />
        </svg>
      ) : (
        <svg className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <rect x="5" y="5" width="8" height="8" rx="1.5" />
          <path strokeLinecap="round" d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
        </svg>
      )}
    </button>
  );
}

function ProgressBar({
  value,
  maxValue = 100,
}: {
  value: number;
  maxValue?: number;
}) {
  const percentage = Math.min(Math.max((value / maxValue) * 100, 0), 100);
  return (
    <div className="w-full h-2.5 bg-gray-30 rounded-full overflow-hidden">
      <div
        className="h-full bg-green-10 rounded-full transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function CategoryHeader({ label, tooltipTitle }: { label: string; tooltipTitle?: string }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center gap-5">
      <div className="flex items-center gap-1">
        <span className="body-14-medium text-gray-100 text-center whitespace-nowrap">
          {label}
        </span>
        <InfoTooltip title={tooltipTitle} />
      </div>
      <div className="h-px w-full bg-gray-30" />
    </div>
  );
}

function ColumnHeader({
  children,
  tooltipTitle,
}: {
  children: React.ReactNode;
  tooltipTitle?: string;
}) {
  return (
    <div className="flex-1 min-w-0 flex items-center justify-center gap-1 px-2.5 py-2.5">
      <span className="body-14-bold text-gray-100 text-center">{children}</span>
      <InfoTooltip title={tooltipTitle} />
    </div>
  );
}

export function PoolInfoHeader({
  token0Symbol,
  token1Symbol,
  token0Address,
  token1Address,
  token0Decimals = 18,
  token1Decimals = 18,
  poolAddress,
  isStable = false,
  strategy = "Basic",
  poolType = "BASIC",
  tickSpacing,
  grade = 3,
  brokerPoolStats,
  effectiveFeeBps,
}: PoolInfoHeaderProps) {
  const t = useTranslations();

  const chainStatsAddress = useMemo((): `0x${string}` | undefined => {
    if (!poolAddress || !isAddress(poolAddress)) return undefined;
    if (poolAddress.toLowerCase() === zeroAddress.toLowerCase()) return undefined;
    return poolAddress;
  }, [poolAddress]);

  const {
    gaugeAddress,
    hasGauge,
    isLoading: isLoadingGauge,
  } = useGauge(chainStatsAddress);

  const {
    feeDisplay,
    isDynamicFee,
    baseFeeBasisPoints,
    isLoading: isLoadingFee,
  } = usePoolFee(chainStatsAddress, isStable, poolType);

  const {
    tvlFormatted,
    tvl,
    isLoading: isLoadingTVL,
  } = usePoolTVL(
    chainStatsAddress,
    token0Symbol,
    token1Symbol,
    token0Decimals,
    token1Decimals
  );

  const { data: stats, isLoading: isLoadingStats } = usePoolStatsFromIndexer(
    chainStatsAddress,
    {
      enabled: isIndexerConfigured() && !!chainStatsAddress,
    }
  );
  const hasIndexer = isIndexerConfigured();

  const tvlForEmission = useMemo(() => {
    if (tvl != null && tvl > 0) return tvl;
    const g = brokerPoolStats?.tvlDisplayUsd;
    if (g != null && Number.isFinite(g) && g > 0) return g;
    return tvl ?? 0;
  }, [tvl, brokerPoolStats?.tvlDisplayUsd]);

  const {
    aprFormatted: emissionAprFormatted,
    apr: emissionApr,
    hasGauge: emissionHasGauge,
    isLoading: isLoadingEmission,
  } = useEmissionAPR(chainStatsAddress, tvlForEmission);

  const pointDistDisplay = useMemo(() => {
    if (isLoadingEmission) return "...";
    const na =
      emissionAprFormatted === "N/A" ||
      emissionAprFormatted === "-" ||
      emissionAprFormatted === "";
    if (!emissionHasGauge && na) {
      return t("pool.pointDistPreTge");
    }
    return emissionAprFormatted;
  }, [
    isLoadingEmission,
    emissionHasGauge,
    emissionAprFormatted,
    t,
  ]);

  const assetType =
    tickSpacing !== undefined
      ? `CL${tickSpacing}`
      : isStable
        ? t("pool.stable")
        : t("pool.volatile");

  const volume24h = useMemo(() => {
    const fromIndexer =
      hasIndexer && stats?.volume24h ? formatUSD(stats.volume24h) : null;
    const indexerOk = fromIndexer != null && fromIndexer !== "-";
    const fromBroker =
      brokerPoolStats && brokerPoolStats.volume24hUsd > 1e-12
        ? formatUSD(String(brokerPoolStats.volume24hUsd))
        : null;
    return indexerOk ? fromIndexer : (fromBroker ?? fromIndexer ?? "-");
  }, [hasIndexer, stats?.volume24h, brokerPoolStats]);

  const accumulatedFees = useMemo(() => {
    const fromIndexer =
      hasIndexer && stats?.fees7d ? formatUSD(stats.fees7d) : null;
    const indexerOk = fromIndexer != null && fromIndexer !== "-";
    const fromBroker = brokerPoolStats
      ? formatBrokerFeesDayAndTotal(brokerPoolStats)
      : null;
    const brokerOk = fromBroker != null && fromBroker !== "-";
    return indexerOk
      ? fromIndexer
      : brokerOk
        ? fromBroker
        : (fromIndexer ?? fromBroker ?? "-");
  }, [hasIndexer, stats?.fees7d, brokerPoolStats]);

  const { swapFeeAprRaw, swapFeeApr } = useMemo(() => {
    let indexerRaw = 0;
    let indexerFormatted: string | null = null;
    if (hasIndexer && stats?.apr7d) {
      indexerRaw = parseFloat(stats.apr7d) || 0;
      indexerFormatted = formatAPR(stats.apr7d);
    }
    const indexerOk =
      indexerFormatted != null && indexerFormatted !== "-";
    if (indexerOk) {
      return { swapFeeAprRaw: indexerRaw, swapFeeApr: indexerFormatted };
    }
    if (brokerPoolStats) {
      const approx = brokerPoolStats.swapAprApprox;
      if (approx != null && Number.isFinite(approx) && approx >= 0) {
        return {
          swapFeeAprRaw: approx,
          swapFeeApr: formatAPR(String(approx)),
        };
      }
    }
    if (indexerFormatted != null) {
      return { swapFeeAprRaw: indexerRaw, swapFeeApr: indexerFormatted };
    }
    return { swapFeeAprRaw: 0, swapFeeApr: "-" };
  }, [hasIndexer, stats?.apr7d, brokerPoolStats]);

  const showBrokerFeesLifetimeHint = useMemo(() => {
    if (!brokerPoolStats) return false;
    const fromIndexer =
      hasIndexer && stats?.fees7d ? formatUSD(stats.fees7d) : null;
    const indexerOk = fromIndexer != null && fromIndexer !== "-";
    if (indexerOk) return false;
    if (brokerPoolStats.totalSwapFeesUsd > 1e-12) return false;
    return (
      brokerPoolStats.volume24hUsd > 1e-12 ||
      brokerPoolStats.feesDayUsd > 1e-12 ||
      brokerPoolStats.feesDayEstimateUsd > 1e-12
    );
  }, [hasIndexer, stats?.fees7d, brokerPoolStats]);

  const feeFromGateway =
    effectiveFeeBps != null &&
    Number.isFinite(effectiveFeeBps) &&
    effectiveFeeBps >= 0
      ? `${(effectiveFeeBps / 100).toFixed(2)}%`
      : null;
  const feeDisplayResolved =
    !isLoadingFee && feeDisplay === "-" && feeFromGateway
      ? feeFromGateway
      : feeDisplay;

  const liquidityDisplay = useMemo(() => {
    if (isLoadingTVL) return "...";
    const onChainPositive = tvl != null && tvl > 0;
    if (onChainPositive) return tvlFormatted;
    if (brokerPoolStats && brokerPoolStats.tvlDisplayUsd > 1e-12) {
      return formatUSD(String(brokerPoolStats.tvlDisplayUsd));
    }
    return tvlFormatted;
  }, [isLoadingTVL, tvl, tvlFormatted, brokerPoolStats]);

  return (
    <div className="bg-white rounded-[20px] flex gap-2.5 items-stretch pl-5 py-5 w-full overflow-hidden">
      {/* Left: Token Pair Card */}
      <div className="bg-gray-10 rounded-[20px] flex flex-col items-center justify-center gap-5 px-4 py-2.5 shrink-0 self-stretch min-w-[140px]">
        <TokenPairIcon
          leftAddress={token0Address}
          leftSymbol={token0Symbol}
          rightAddress={token1Address}
          rightSymbol={token1Symbol}
          size={32}
        />
        <div className="flex items-center gap-1.5">
          <span className="body-16-bold text-gray-100 whitespace-nowrap">
            {token0Symbol} - {token1Symbol}
          </span>
          <PoolGradeBadge grade={grade} size="md" />
        </div>
      </div>

      {/* Right: Categories + Table */}
      <div className="flex-1 min-w-0 flex flex-col gap-2.5 overflow-hidden">
        <div className="flex flex-col gap-2.5">
        {/* Row 1: Category headers with underline dividers */}
        <div className="flex gap-2.5 items-center w-full">
          <CategoryHeader label={t("pool.poolStrategy")} />
          <CategoryHeader label={t("pool.poolStatistics")} />
          <CategoryHeader label={t("pool.earningRates")} />
        </div>

        {/* Row 2: Table (column headers + data) */}
        <div className="flex flex-col gap-5 w-full">
          {/* Column header row */}
          <div className="flex gap-2.5 items-center w-full">
            <ColumnHeader>{t("pool.address")}</ColumnHeader>
            <ColumnHeader>{t("pool.strategyAsset")}</ColumnHeader>
            <ColumnHeader>{t("pool.realtimeFee")}</ColumnHeader>
            <ColumnHeader>{t("pool.liquidity")}</ColumnHeader>
            <ColumnHeader>{t("pool.volume24h")}</ColumnHeader>
            <ColumnHeader>{t("pool.accumulatedFees")}</ColumnHeader>
            <ColumnHeader>{t("pool.swapFeeAPR")}</ColumnHeader>
            <ColumnHeader>{t("pool.pointDistPercent")}</ColumnHeader>
          </div>

          {/* Data row */}
          <div className="flex gap-2.5 items-center pr-5 w-full">
            {/* Address column: Pool + Gauge copy buttons */}
            <div className="flex-1 min-w-0 flex flex-col gap-1.5 justify-center px-2.5">
              <div className="flex gap-1 items-center justify-center w-full">
                <span className="body-14-medium text-gray-100 text-center w-12">
                  {t("pool.pool")}
                </span>
                {chainStatsAddress ? (
                  <CopyIconButton
                    text={chainStatsAddress}
                    ariaLabel={`Copy pool address`}
                  />
                ) : (
                  <span className="body-14 text-gray-50" title={t("deposit.poolAddressPending")}>
                    —
                  </span>
                )}
              </div>
              <div className="flex gap-1 items-center justify-center w-full">
                <span className="body-14-medium text-gray-100 text-center w-12">
                  {t("pool.gauge")}
                </span>
                {isLoadingGauge ? (
                  <span className="body-14 text-gray-60">...</span>
                ) : hasGauge && gaugeAddress ? (
                  <CopyIconButton
                    text={gaugeAddress}
                    ariaLabel={`Copy gauge address`}
                  />
                ) : (
                  <span className="body-14 text-gray-50" title={t("pool.noGauge")}>
                    —
                  </span>
                )}
              </div>
            </div>

            {/* Strategy & Asset */}
            <div className="flex-1 min-w-0 flex flex-col gap-1 justify-center px-2.5 text-center">
              <span className="body-14-medium text-gray-100">{strategy}</span>
              <span className="body-14-medium text-gray-100">{assetType}</span>
            </div>

            {/* Real-time Fee */}
            <div className="flex-1 min-w-0 flex flex-col items-end justify-center gap-0.5 px-2.5">
              <span className="body-14-medium text-gray-100 text-right whitespace-nowrap">
                {isLoadingFee ? "..." : feeDisplayResolved}
              </span>
              {isDynamicFee && baseFeeBasisPoints !== null && (
                <span className="body-12 text-gray-50 text-right whitespace-nowrap">
                  Base: {(baseFeeBasisPoints / 100).toFixed(2)}%
                </span>
              )}
            </div>

            {/* Liquidity */}
            <div className="flex-1 min-w-0 flex items-center justify-end px-2.5">
              <span className="body-14-medium text-gray-100 text-right whitespace-nowrap">
                {liquidityDisplay}
              </span>
            </div>

            {/* Volume 24h */}
            <div className="flex-1 min-w-0 flex items-center justify-end px-2.5">
              <span className="body-14-medium text-gray-100 text-center whitespace-nowrap">
                {isLoadingStats ? "..." : volume24h}
              </span>
            </div>

            {/* Accumulated Fees */}
            <div className="flex-1 min-w-0 flex items-center justify-end px-2.5">
              <span
                className="body-14-medium text-gray-100 text-right whitespace-nowrap"
                title={
                  showBrokerFeesLifetimeHint
                    ? t("pool.feesLifetimeUsdHint")
                    : undefined
                }
              >
                {isLoadingStats ? "..." : accumulatedFees}
              </span>
            </div>

            {/* Swap Fee APR */}
            <div className="flex-1 min-w-0 flex flex-col items-end gap-2 px-2.5">
              <span className="body-14-medium text-gray-100 text-right w-full whitespace-nowrap">
                {isLoadingStats ? "..." : swapFeeApr}
              </span>
              <ProgressBar value={swapFeeAprRaw} maxValue={100} />
            </div>

            {/* Point Dist. % */}
            <div className="flex-1 min-w-0 flex flex-col items-end gap-2 px-2.5">
              <span className="body-14-medium text-gray-100 text-right w-full whitespace-nowrap">
                {isLoadingEmission ? "..." : pointDistDisplay}
              </span>
              <ProgressBar value={emissionApr ?? 0} maxValue={100} />
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
