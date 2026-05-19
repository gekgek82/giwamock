"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TokenPairIcon } from "@/components/common/TokenIcon";
import { Button } from "@/components/common/Button";
import { IS_PRE_TGE } from "@/lib/config";

export interface Pool {
  id: string;
  poolAddress?: string;
  token0: { symbol: string; address?: string };
  token1: { symbol: string; address?: string };
  poolType: string;
  isStable: boolean;
  feePercent: string;
  tvl: string;
  fees7d: string;
  incentives: string;
  totalRewards: string;
  vAPR: string;
  voteWeight: string;
}

interface PoolVoteCardProps {
  pool: Pool;
}

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

function HairlineDivider() {
  return <div className="h-px w-full bg-gray-30" />;
}

function StatColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-2.5 items-center">
      <p className="body-14-bold text-gray-100 text-center w-full">{title}</p>
      <HairlineDivider />
      {children}
    </div>
  );
}

export function PoolVoteCard({ pool }: PoolVoteCardProps) {
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
    <div className="bg-gray-10 rounded-[40px] py-[30px] flex flex-col items-center gap-5">
      <div className="flex flex-col gap-2.5 items-center w-full">
        {/* Pool header */}
        <div className="bg-gray-20 rounded-[20px] px-[30px] h-[66px] flex items-center justify-between w-[610px] max-w-[calc(100%-40px)]">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <TokenPairIcon
              leftAddress={pool.token0.address}
              leftSymbol={pool.token0.symbol}
              rightAddress={pool.token1.address}
              rightSymbol={pool.token1.symbol}
              size={24}
            />
            <span className="body-16-bold text-gray-100 whitespace-nowrap ml-1">
              {pool.token0.symbol} - {pool.token1.symbol}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-gray-100 whitespace-nowrap">
            <span className="body-14-medium">{strategyLabel}</span>
            <span className="body-14-medium">{stabilityLabel}</span>
            <span className="body-14-bold">{feeLabel}</span>
          </div>
        </div>

        {/* Info grid: 2 rows × 3 cols */}
        <div className="flex flex-col w-full">
          <div className="flex items-start w-full">
            <StatColumn title={t("vote.tvl")}>
              <p className="body-14-bold text-gray-100 text-center w-full">
                {formatUsdCompact(pool.tvl)}
              </p>
            </StatColumn>
            <StatColumn title={t("vote.swapFees")}>
              <p className="body-14-bold text-gray-100 text-center w-full">
                {formatUsdCompact(pool.fees7d)}
              </p>
            </StatColumn>
            <StatColumn title={t("vote.incentives")}>
              <div className="flex flex-col items-center gap-2 w-full">
                <p className="body-14-bold text-gray-100 text-center w-full">
                  {formatUsdCompact(pool.incentives)}
                </p>
                <button
                  type="button"
                  onClick={handleAddIncentiveClick}
                  className="bg-gray-80 hover:bg-gray-90 transition-colors rounded-[10px] px-2.5 py-1.5 flex items-center gap-1"
                >
                  <span className="body-14-bold text-gray-10">
                    + {t("common.add")}
                  </span>
                </button>
              </div>
            </StatColumn>
          </div>

          <div className="flex items-start w-full mt-4">
            <StatColumn title={t("vote.totalRewards")}>
              <div className="flex flex-col gap-1 items-center w-full">
                <p className="body-14-bold text-gray-100 text-center w-full">
                  {formatUsdCompact(pool.totalRewards)}
                </p>
                <p className="body-14-medium text-gray-100 text-center w-full">
                  {t("vote.feesPlusIncentives")}
                </p>
              </div>
            </StatColumn>
            <StatColumn title={t("vote.vApr")}>
              <div className="flex flex-col gap-1 items-center w-full">
                <p className="body-14-bold text-gray-100 text-center w-full">
                  {pool.vAPR}%
                </p>
                <p className="body-14-medium text-gray-100 text-center w-full whitespace-nowrap">
                  {formatTokenAmount(pool.voteWeight)}{" "}
                  <span className="body-12 text-gray-100">{vePointSymbol}</span>
                </p>
              </div>
            </StatColumn>
            <div className="flex-1" />
          </div>
        </div>
      </div>

      <div className="w-[610px] max-w-[calc(100%-40px)]">
        <Button size="lg" onClick={handleVoteClick}>
          {t("vote.vote")}
        </Button>
      </div>
    </div>
  );
}
