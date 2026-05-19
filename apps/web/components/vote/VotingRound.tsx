"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { PoolVoteCard } from "./PoolVoteCard";
import { useVoteEpoch } from "@/hooks/useVoteEpoch";
import { useVotePools } from "@/hooks/useVotePools";
import type { VotePoolsQuery } from "@/types/indexer";
import { PageHeader } from "@/components/common/PageHeader";

type FilterTab = "all" | "rewards" | "votes" | "fees" | "incentives";

const tabToSortBy: Record<FilterTab, VotePoolsQuery["sortBy"] | undefined> = {
  all: undefined,
  rewards: "rewards",
  votes: "votes",
  fees: "fees",
  incentives: undefined,
};

function formatRoundStat(value: string | undefined, prefix = "") {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  if (num >= 1_000_000) return `${prefix}${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${prefix}${(num / 1_000).toFixed(2)}K`;
  return `${prefix}${num.toFixed(2)}`;
}

function DownArrow() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="w-6 h-6 text-gray-50"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M20 20l-3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function VotingRound() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const t = useTranslations();

  const { epoch, isLoading: epochLoading } = useVoteEpoch();
  const { pools, isLoading: poolsLoading } = useVotePools({
    sortBy: tabToSortBy[activeTab],
    search: searchQuery || undefined,
  });

  const tabs: { id: FilterTab; label: string; hasSort?: boolean }[] = [
    { id: "all", label: t("vote.all") },
    { id: "rewards", label: t("vote.rewards"), hasSort: true },
    { id: "votes", label: t("vote.votes"), hasSort: true },
    { id: "fees", label: t("vote.fees"), hasSort: true },
    { id: "incentives", label: t("vote.incentives"), hasSort: true },
  ];

  const poolCards = useMemo(
    () =>
      pools.map((pool) => ({
        id: pool.poolAddress,
        poolAddress: pool.poolAddress,
        token0: { symbol: pool.token0.symbol, address: pool.token0.address },
        token1: { symbol: pool.token1.symbol, address: pool.token1.address },
        poolType: pool.poolType,
        isStable: pool.isStable,
        feePercent: pool.feePercent,
        tvl: pool.tvl,
        fees7d: pool.fees7d,
        incentives: pool.incentives,
        totalRewards: pool.totalRewards,
        vAPR: pool.vAPR,
        voteWeight: pool.voteWeight,
      })),
    [pools],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Round info + Filter + Search — grouped card */}
      <div className="flex flex-col gap-2.5">
        {/* Current Voting Round card */}
        <div className="bg-gray-10 rounded-[40px] flex flex-col gap-5 pt-[30px] pb-[30px]">
          <PageHeader
            title={t("vote.currentVotingRound")}
            size="lg"
            rightText={
              <>
                {t("vote.endsIn")}{" "}
                <span className="body-14-bold text-gray-100">
                  [{epochLoading ? "..." : (epoch?.endsInDays ?? "—")}{" "}
                  {t("vote.days")}]
                </span>
              </>
            }
          />
          <p className="body-14-medium text-gray-100 w-[610px] max-w-[calc(100%-60px)] mx-[30px]">
            {epochLoading ? (
              <span className="inline-block h-4 w-full bg-gray-30 rounded animate-pulse" />
            ) : (
              <>
                {t("vote.totalVotingPower")}{" "}
                {formatRoundStat(epoch?.totalVotingPower)} /{" "}
                {t("vote.totalFees")} ~$
                {formatRoundStat(epoch?.totalFees)} /{" "}
                {t("vote.totalIncentives")} ~$
                {formatRoundStat(epoch?.totalIncentives)}{" "}
                {t("vote.totalRewards")} ~$
                {formatRoundStat(epoch?.totalRewards)}
              </>
            )}
          </p>
        </div>

        {/* Filter + Search card */}
        <div className="bg-gray-10 rounded-[40px] p-[30px] flex flex-col gap-5">
          {/* Filter tabs */}
          <div className="flex gap-3 items-center w-full">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 rounded-[10px] px-1 py-2.5 flex items-center justify-center gap-1.5 transition-colors ${
                    isActive
                      ? "bg-gray-100 text-gray-10 body-14-bold"
                      : "bg-gray-20 text-gray-100 body-14-medium hover:bg-gray-30"
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.hasSort && <DownArrow />}
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          <div className="relative flex items-center gap-2 px-5 h-16 border border-gray-60 rounded-full">
            <input
              type="text"
              placeholder={t("common.searchAll")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent body-14-medium text-gray-100 placeholder:text-gray-50 outline-none"
            />
            <SearchIcon />
          </div>
        </div>
      </div>

      {/* Pool Cards */}
      <div className="flex flex-col gap-2.5 pb-10">
        {poolsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[300px] bg-gray-10 rounded-[40px] animate-pulse"
            />
          ))
        ) : poolCards.length === 0 ? (
          <div className="bg-gray-10 rounded-[40px] py-10 text-center">
            <p className="body-14-medium text-gray-60">{t("common.noData")}</p>
          </div>
        ) : (
          poolCards.map((pool) => <PoolVoteCard key={pool.id} pool={pool} />)
        )}
      </div>
    </div>
  );
}
