"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { TokenPairIcon } from "@/components/common/TokenIcon";
import { Button } from "@/components/common/Button";
import { portfolioApi } from "@/lib/portfolioApi";
import { getMockDemoAddress, isMockMode } from "@/lib/mockTransactions";
import type { LiquidityPosition } from "@/types/portfolio";

function TableSkeleton() {
  return (
    <div className="w-full px-[30px]">
      <div className="bg-gray-20 rounded-[20px] p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-12 bg-white/50 rounded" />
          <div className="h-12 bg-white/50 rounded" />
        </div>
      </div>
      <div className="space-y-4 mt-5">
        <div className="h-20 bg-gray-20 rounded animate-pulse" />
        <div className="h-20 bg-gray-20 rounded animate-pulse" />
      </div>
    </div>
  );
}

function InfoIcon() {
  return (
    <span className="w-4 h-4 inline-flex items-center justify-center bg-gray-10 rounded-full text-[10px] text-gray-70 shrink-0">
      i
    </span>
  );
}

function ColumnHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-2.5 flex items-center justify-center gap-1 ${className}`}>
      <span className="text-center text-gray-100 body-14-bold">{children}</span>
      <InfoIcon />
    </div>
  );
}

const COL = {
  pools: "w-[140px] shrink-0",
  strategy: "w-[120px] shrink-0",
  deposited: "w-[160px] shrink-0",
  inventory: "w-[160px] shrink-0",
  stake: "w-[150px] shrink-0",
  rewards: "w-[170px] shrink-0",
  actions: "flex-1 min-w-[220px]",
};

function formatAmount(value: string, maximumFractionDigits = 6): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return num.toLocaleString(undefined, {
    maximumFractionDigits,
  });
}

function formatUsd(value: string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "$0.00";
  return `$${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPoolShare(value: string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return `${num.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })}%`;
}

function strategyLabel(position: LiquidityPosition): string {
  if (position.poolType === "CL") return "CL";
  return position.volatility;
}

function buildDepositParams(position: LiquidityPosition): string {
  const type =
    position.poolType === "CL" ? 1 : position.volatility === "Stable" ? 0 : -1;
  return `token0=${position.token0.address}&token1=${position.token1.address}&type=${type}`;
}

function buildWithdrawParams(position: LiquidityPosition): string {
  return buildDepositParams(position);
}

function buildStakeParams(position: LiquidityPosition): string {
  return buildDepositParams(position);
}

interface LiquidityPositionTableProps {
  onPositionCountChange?: (count: number) => void;
}

export function LiquidityPositionTable({
  onPositionCountChange,
}: LiquidityPositionTableProps) {
  const t = useTranslations();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const effectiveAddress = address ?? (isMockMode() ? getMockDemoAddress() : undefined);
  const effectiveIsConnected = isConnected || isMockMode();
  const [positions, setPositions] = useState<LiquidityPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!effectiveIsConnected || !effectiveAddress) {
      setPositions([]);
      onPositionCountChange?.(0);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await portfolioApi.getLiquidityPositions(
        effectiveAddress,
      );
      setPositions(response.positions);
      onPositionCountChange?.(response.pagination.total);
    } catch (err) {
      const statusCode =
        err && typeof err === "object" && "statusCode" in err
          ? Number((err as { statusCode?: number }).statusCode)
          : undefined;

      if (statusCode === 404) {
        setPositions([]);
        onPositionCountChange?.(0);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch liquidity positions",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [effectiveAddress, effectiveIsConnected, onPositionCountChange]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  if (!effectiveIsConnected) {
    return (
      <div className="py-12 text-center text-gray-70 body-14">
        {t("common.connectWallet")}
      </div>
    );
  }

  if (isLoading) return <TableSkeleton />;

  if (error) {
    return (
      <div className="py-12 text-center text-red-30 body-14">{error}</div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="py-12 text-center text-gray-70 body-14">
        {t("portfolio.noPositions")}
      </div>
    );
  }

  return (
    <>
      {/* Table Header */}
      <div className="w-full px-[30px]">
        <div className="bg-gray-20 rounded-[20px] pt-[30px] pb-5 px-5 flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <ColumnHeader className={COL.pools}>{t("pool.pools")}</ColumnHeader>
            <ColumnHeader className={COL.strategy}>
              {t("pool.strategyColumn")}
            </ColumnHeader>
            <ColumnHeader className={COL.deposited}>
              {t("portfolio.deposited")}
            </ColumnHeader>
            <ColumnHeader className={COL.inventory}>
              {t("portfolio.poolInventory")}
            </ColumnHeader>
            <ColumnHeader className={COL.stake}>
              {t("portfolio.stake")}
            </ColumnHeader>
            <ColumnHeader className={COL.rewards}>
              {t("portfolio.rewards")}
            </ColumnHeader>
            <ColumnHeader className={COL.actions}>Actions</ColumnHeader>
          </div>
        </div>
      </div>

      {/* Data Rows */}
      <div className="w-full flex flex-col">
        {positions.map((position) => (
          <div
            key={position.id}
            className="pt-5 flex flex-col items-center gap-5"
          >
            <div className="w-full px-[30px] flex items-center gap-2.5">
              {/* Pools */}
              <div className={`${COL.pools} flex flex-col items-center gap-1`}>
                <TokenPairIcon
                  leftAddress={position.token0.address}
                  leftSymbol={position.token0.symbol}
                  rightAddress={position.token1.address}
                  rightSymbol={position.token1.symbol}
                  size={24}
                />
                <span className="text-gray-100 body-14-bold text-center">
                  {position.token0.symbol} - {position.token1.symbol}
                </span>
                {position.tokenId && (
                  <span className="text-gray-60 body-12 text-center">
                    NFT #{position.tokenId}
                  </span>
                )}
                <span className="text-gray-60 body-12 text-center">
                  {position.feePercent}% fee
                </span>
              </div>

              {/* Strategy */}
              <div className={`${COL.strategy} px-2.5 flex items-center justify-center`}>
                <span className="text-gray-100 body-14-medium text-center">
                  {strategyLabel(position)}
                </span>
              </div>

              {/* Deposited */}
              <div className={`${COL.deposited} px-2.5 flex flex-col items-center justify-center gap-0.5`}>
                <span className="text-gray-100 body-14-medium text-center">
                  {formatAmount(position.deposited.token0Amount)}{" "}
                  {position.token0.symbol}
                </span>
                <span className="text-gray-100 body-14-medium text-center">
                  {formatAmount(position.deposited.token1Amount)}{" "}
                  {position.token1.symbol}
                </span>
                <span className="text-gray-60 body-12 text-center">
                  {formatUsd(position.deposited.usdValue)}
                </span>
                <span className="text-gray-60 body-12 text-center">
                  {formatPoolShare(position.poolShare)} share
                </span>
              </div>

              {/* Pool Inventory */}
              <div className={`${COL.inventory} px-2.5 flex flex-col items-center justify-center gap-0.5`}>
                <span className="text-gray-100 body-14-medium text-center">
                  {formatAmount(position.poolInventory.token0Amount)}{" "}
                  {position.poolInventory.token0Symbol}
                </span>
                <span className="text-gray-100 body-14-medium text-center">
                  {formatAmount(position.poolInventory.token1Amount)}{" "}
                  {position.poolInventory.token1Symbol}
                </span>
              </div>

              {/* Stake */}
              <div className={`${COL.stake} px-2.5 flex flex-col items-center justify-center gap-0.5`}>
                <span className="text-gray-100 body-14-medium text-center capitalize">
                  {position.stake.status}
                </span>
                <span className="text-gray-60 body-12 text-center">
                  APR {formatAmount(position.stake.apr, 2)}%
                </span>
                <span className="text-gray-60 body-12 text-center">
                  {formatUsd(position.stake.usdValue)}
                </span>
              </div>

              {/* Rewards */}
              <div className={`${COL.rewards} px-2.5 flex flex-col items-center justify-center gap-0.5`}>
                <span className="text-gray-100 body-14-medium text-center">
                  {formatAmount(position.rewards.terPoint)} TER Point
                </span>
                <span className="text-gray-60 body-12 text-center">
                  {formatAmount(position.rewards.swapFees.token0Amount)}{" "}
                  {position.token0.symbol}
                </span>
                <span className="text-gray-60 body-12 text-center">
                  {formatAmount(position.rewards.swapFees.token1Amount)}{" "}
                  {position.token1.symbol}
                </span>
                <span className="text-gray-60 body-12 text-center">
                  {formatUsd(position.rewards.swapFees.usdValue)}
                </span>
              </div>

              {/* Actions */}
              <div className={`${COL.actions} px-2.5 flex items-center justify-center gap-2 flex-wrap`}>
                <Button
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() =>
                    router.push(`/deposit?${buildDepositParams(position)}`)
                  }
                >
                  + Add
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="whitespace-nowrap"
                  onClick={() =>
                    router.push(`/withdraw?${buildWithdrawParams(position)}`)
                  }
                >
                  Remove
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="whitespace-nowrap"
                  onClick={() =>
                    router.push(`/stake?${buildStakeParams(position)}`)
                  }
                  disabled={position.stake.isStaked}
                >
                  Stake
                </Button>
              </div>
            </div>

            {/* Row Divider */}
            <div className="w-full h-0 border-t border-gray-30" />
          </div>
        ))}
      </div>
    </>
  );
}
