"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { portfolioApi } from "@/lib/portfolioApi";
import { getMockDemoAddress, isMockMode } from "@/lib/mockTransactions";
import { useClaimPointEarning } from "@/hooks/useClaimPointEarning";
import type {
  PointPositionsResponse,
  PointEarningCategory,
  PointEarning,
} from "@/types/portfolio";
import { Pagination } from "./Pagination";

type CategoryFilter = "ALL" | PointEarningCategory;

function formatPointDateParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
}

function formatPointAmount(raw: string): string {
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toFixed(6);
}

function TableSkeleton() {
  return (
    <div className="w-full px-[30px] flex flex-col gap-5 animate-pulse">
      <div className="h-10 bg-gray-20 rounded-[10px] w-[540px]" />
      <div className="w-full flex justify-center">
        <div className="w-full max-w-[1300px] h-[61px] bg-gray-20 rounded-[20px]" />
      </div>
      <div className="space-y-3">
        <div className="h-[46px] bg-gray-20 rounded" />
        <div className="h-[46px] bg-gray-20 rounded" />
        <div className="h-[46px] bg-gray-20 rounded" />
      </div>
    </div>
  );
}

interface PointPositionTableProps {
  onPositionCountChange?: (count: number) => void;
}

const FILTER_KEYS: Record<CategoryFilter, string> = {
  ALL: "portfolio.filterAll",
  EVENT: "portfolio.filterEvent",
  LIQUIDITY_STAKING: "portfolio.filterLiquidityStaking",
  SWAP: "portfolio.filterSwap",
};

const FILTER_ORDER: CategoryFilter[] = [
  "ALL",
  "EVENT",
  "LIQUIDITY_STAKING",
  "SWAP",
];

const ITEMS_PER_PAGE = 10;

export function PointPositionTable({
  onPositionCountChange,
}: PointPositionTableProps) {
  const t = useTranslations();
  const { address, isConnected } = useAccount();
  const effectiveAddress = address ?? (isMockMode() ? getMockDemoAddress() : undefined);
  const effectiveIsConnected = isConnected || isMockMode();

  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [data, setData] = useState<PointPositionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!effectiveIsConnected || !effectiveAddress) {
      setData(null);
      onPositionCountChange?.(0);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const response = await portfolioApi.getPointPositions(effectiveAddress, {
        limit: ITEMS_PER_PAGE,
        offset,
        category: category === "ALL" ? undefined : category,
      });
      setData(response);
      onPositionCountChange?.(response.summary.lockCount);
    } catch (err) {
      const statusCode =
        err && typeof err === "object" && "statusCode" in err
          ? Number((err as { statusCode?: number }).statusCode)
          : undefined;
      if (statusCode === 404) {
        setData(null);
        onPositionCountChange?.(0);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch point positions",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    effectiveAddress,
    effectiveIsConnected,
    currentPage,
    category,
    onPositionCountChange,
  ]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const {
    claim: claimEarning,
    status: claimStatus,
    pendingEarningId,
  } = useClaimPointEarning(fetchPositions);

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.pagination.total / ITEMS_PER_PAGE));
  }, [data]);

  const handleCategoryChange = useCallback((next: CategoryFilter) => {
    setCategory(next);
    setCurrentPage(1);
  }, []);

  if (!effectiveIsConnected) {
    return (
      <div className="py-12 text-center text-gray-70 body-14 w-full">
        {t("common.connectWallet")}
      </div>
    );
  }

  const showSkeleton = isLoading && !data;
  const earnings = data?.earnings ?? [];

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Filter pills — constrained to 540px column on the left */}
      <div className="px-[30px]">
        <div className="w-full max-w-[540px] flex items-center gap-3">
          {FILTER_ORDER.map((f) => {
            const active = category === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => handleCategoryChange(f)}
                className={`flex-1 min-w-0 px-1 py-2.5 rounded-[10px] body-14-medium transition-colors ${
                  active
                    ? "bg-gray-100 text-gray-10"
                    : "bg-gray-20 text-gray-100 hover:bg-gray-30"
                }`}
              >
                {t(FILTER_KEYS[f])}
              </button>
            );
          })}
        </div>
      </div>

      {showSkeleton ? (
        <TableSkeleton />
      ) : error ? (
        <div className="py-12 text-center text-red-30 body-14">{error}</div>
      ) : (
        <>
          {/* Column Header */}
          <div className="w-full px-[30px] flex justify-center">
            <div className="w-full max-w-[1300px] bg-gray-20 rounded-[20px] py-5 flex items-center">
              <div className="flex-1 p-2.5 flex items-center justify-center">
                <span className="text-center text-gray-100 body-14-bold">
                  {t("portfolio.dateTime")}
                </span>
              </div>
              <div className="flex-1 p-2.5 flex items-center justify-center">
                <span className="text-center text-gray-100 body-14-bold">
                  {t("portfolio.type")}
                </span>
              </div>
              <div className="flex-1 p-2.5 flex items-center justify-center">
                <span className="text-center text-gray-100 body-14-bold">
                  {t("portfolio.rewardAmount")}
                </span>
              </div>
              <div className="flex-1 p-2.5 flex items-center justify-center">
                <span className="text-center text-gray-100 body-14-bold">
                  {t("portfolio.statusColumn")}
                </span>
              </div>
              <div className="flex-1 p-2.5 flex items-center justify-center">
                <span className="text-center text-gray-100 body-14-bold">
                  {t("portfolio.claimRewards")}
                </span>
              </div>
            </div>
          </div>

          {/* Data rows */}
          <div className="w-full flex flex-col">
            {earnings.length === 0 ? (
              <div className="py-12 text-center text-gray-70 body-14">
                {t("portfolio.noEarnings")}
              </div>
            ) : (
              earnings.map((e, idx) => (
                <EarningRow
                  key={e.id}
                  earning={e}
                  claiming={
                    claimStatus === "claiming" && pendingEarningId === e.id
                  }
                  anyClaiming={claimStatus === "claiming"}
                  onClaim={() => claimEarning(e.id)}
                  isLast={idx === earnings.length - 1}
                  t={t}
                />
              ))
            )}
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}

interface EarningRowProps {
  earning: PointEarning;
  claiming: boolean;
  anyClaiming: boolean;
  onClaim: () => void;
  isLast: boolean;
  t: (key: string) => string;
}

function EarningRow({
  earning,
  claiming,
  anyClaiming,
  onClaim,
  isLast,
  t,
}: EarningRowProps) {
  const statusLabel =
    earning.status === "PENDING"
      ? t("portfolio.statusPending")
      : earning.status === "READY_TO_CLAIM"
        ? t("portfolio.statusReadyToClaim")
        : t("portfolio.statusClaimed");

  const canClaim = earning.status === "READY_TO_CLAIM";
  const { date, time } = formatPointDateParts(earning.earnedAt);

  return (
    <div className="pt-5 px-[30px] flex flex-col items-center gap-5">
      <div className="w-full flex items-start gap-2">
        {/* Date & Time */}
        <div className="flex-1 h-[46px] px-2.5 flex items-center justify-center gap-1">
          <span className="text-right text-gray-100 body-14-medium">
            {date}
          </span>
          <span className="text-right text-gray-100 body-14-medium">
            {time}
          </span>
        </div>

        {/* Type */}
        <div className="flex-1 h-[46px] px-2.5 flex items-center justify-center">
          <span className="text-right text-gray-100 body-14-medium">
            {earning.typeLabel}
          </span>
        </div>

        {/* Reward Amount */}
        <div className="flex-1 h-[46px] px-2.5 flex items-center justify-center">
          <div className="flex items-center gap-1">
            <span className="text-right text-gray-100 body-14-bold">
              {formatPointAmount(earning.amount)}
            </span>
            <span className="text-right text-gray-100 text-[12px] leading-[18px] font-medium">
              {t("portfolio.pointUnit")}
            </span>
          </div>
        </div>

        {/* Status */}
        <div className="flex-1 h-[46px] px-2.5 flex items-center justify-center">
          <span className="text-right text-gray-100 body-14-medium">
            {statusLabel}
          </span>
        </div>

        {/* Claim */}
        <div className="flex-1 self-stretch px-2.5 flex items-center justify-center">
          <button
            type="button"
            onClick={onClaim}
            disabled={!canClaim || anyClaiming}
            aria-busy={claiming || undefined}
            className={`px-2.5 py-1.5 rounded-[10px] body-14-medium transition-colors ${
              canClaim
                ? "bg-primary-100 text-gray-100 hover:bg-primary-200"
                : "bg-primary-200/30 text-gray-10 cursor-not-allowed"
            }`}
          >
            {claiming ? "…" : t("portfolio.claim")}
          </button>
        </div>
      </div>

      {/* Row Divider */}
      {!isLast && <div className="w-full h-0 border-t border-gray-30" />}
    </div>
  );
}
