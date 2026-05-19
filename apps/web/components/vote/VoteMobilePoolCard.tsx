"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { IS_PRE_TGE } from "@/lib/config";
import type { Pool } from "./PoolVoteCard";

// Compact mobile variant of `PoolVoteCard`. The desktop card is too wide for the
// mobile viewport, so this version stacks the stats in a 3-column grid that fits
// inside the 358px PageContainer column.

function formatUsdCompact(value: string | undefined) {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  if (num >= 1_000_000) return `~$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `~$${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return `~$${num.toFixed(2)}`;
  return `~$${num.toFixed(4)}`;
}

function formatTokenAmount(value: string | undefined) {
  if (!value) return "0";
  const num = parseFloat(value);
  if (isNaN(num)) return "0";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000)
    return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (num >= 1) return num.toFixed(4);
  return num.toFixed(6);
}

function PlusIcon() {
  return (
    <svg
      className="w-3 h-3"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 2v8M2 6h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StatColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
      <p className="text-[12px] leading-[18px] font-bold text-gray-100 text-center w-full">
        {title}
      </p>
      <div className="h-px w-full bg-gray-30" />
      {children}
    </div>
  );
}

interface VoteMobilePoolCardProps {
  pool: Pool;
}

export function VoteMobilePoolCard({ pool }: VoteMobilePoolCardProps) {
  const router = useRouter();
  const t = useTranslations();

  const handleVoteClick = () => {
    const poolId = pool.poolAddress || pool.id;
    router.push(`/vote/select-lock?poolId=${encodeURIComponent(poolId)}`);
  };

  const handleAddIncentiveClick = () => {
    const poolId = pool.poolAddress || pool.id;
    router.push(`/vote/incentive/${encodeURIComponent(poolId)}`);
  };

  const strategyLabel = pool.poolType === "CL" ? "Concentrated" : "Basic";
  const stabilityLabel = pool.isStable ? "Stable" : "Volatile";
  const feeLabel = `${pool.feePercent}%`;
  const vePointSymbol = IS_PRE_TGE ? "vePoint" : "veTER";

  return (
    <div className="bg-white rounded-[20px] p-4 flex flex-col gap-2.5">
      {/* Pool header */}
      <div className="bg-gray-20 rounded-[10px] p-2.5 flex items-center justify-between gap-2">
        <span className="body-14-bold text-gray-100 whitespace-nowrap truncate">
          {pool.token0.symbol} - {pool.token1.symbol}
        </span>
        <div className="flex items-center gap-1 text-[12px] leading-[18px] font-medium text-gray-100 whitespace-nowrap">
          <span>{strategyLabel}</span>
          <span>{stabilityLabel}</span>
          <span>{feeLabel}</span>
        </div>
      </div>

      {/* Stats grid: 2 rows × 3 cols */}
      <div className="flex flex-col gap-3.5">
        <div className="flex items-start gap-2 w-full">
          <StatColumn title={t("vote.tvl")}>
            <p className="text-[12px] leading-[18px] font-medium text-gray-100 text-center">
              {formatUsdCompact(pool.tvl)}
            </p>
          </StatColumn>
          <StatColumn title={t("vote.swapFees")}>
            <p className="text-[12px] leading-[18px] font-medium text-gray-100 text-center">
              {formatUsdCompact(pool.fees7d)}
            </p>
          </StatColumn>
          <StatColumn title={t("vote.incentives")}>
            <p className="text-[12px] leading-[18px] font-medium text-gray-100 text-center">
              {formatUsdCompact(pool.incentives)}
            </p>
            <button
              type="button"
              onClick={handleAddIncentiveClick}
              className="flex items-center gap-0.5 bg-gray-100 hover:bg-gray-90 transition-colors text-gray-10 px-2 py-1.5 rounded-full text-[12px] leading-[18px] font-bold"
              aria-label={`${t("common.add")} ${t("vote.incentives")}`}
            >
              <PlusIcon />
              <span>{t("common.add")}</span>
            </button>
          </StatColumn>
        </div>

        <div className="flex items-start gap-2 w-full">
          <StatColumn title={t("vote.totalRewards")}>
            <p className="text-[12px] leading-[18px] font-medium text-gray-100 text-center">
              {formatUsdCompact(pool.totalRewards)}
            </p>
            <p className="text-[12px] leading-[18px] font-medium text-gray-100 text-center">
              {t("vote.feesPlusIncentives")}
            </p>
          </StatColumn>
          <StatColumn title={t("vote.vApr")}>
            <p className="text-[12px] leading-[18px] font-medium text-gray-100 text-center">
              {pool.vAPR}%
            </p>
            <p className="text-[12px] leading-[18px] font-medium text-gray-100 text-center whitespace-nowrap">
              {formatTokenAmount(pool.voteWeight)} {vePointSymbol}
            </p>
          </StatColumn>
          <div className="flex-1 min-w-0" />
        </div>
      </div>

      <button
        type="button"
        onClick={handleVoteClick}
        className="w-full bg-brand-green text-gray-100 hover:bg-green-10 transition-colors px-5 py-2.5 rounded-[20px] body-16-bold"
      >
        {t("vote.vote")}
      </button>
    </div>
  );
}
