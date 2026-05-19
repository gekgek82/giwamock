"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useVoteEpoch } from "@/hooks/useVoteEpoch";
import { useVotePools } from "@/hooks/useVotePools";
import type { VotePoolsQuery } from "@/types/indexer";
import { VoteMobilePoolCard } from "./VoteMobilePoolCard";

// Mobile voting-round content. The Figma splits this across two adjacent surfaces:
//
//   - `VoteMobileVotingRoundPanel` lives inside the shared tabs card (round info,
//     filter chips, search input).
//   - `VoteMobilePoolList` renders the pool cards below as their own surfaces.
//
// Both components share the same filter / search state, which is owned by
// `VoteMobilePageView` so the upper controls stay synced with the lower list.

export type FilterTab = "all" | "rewards" | "votes" | "fees" | "incentives";

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
      className="w-3 h-3"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 4.5 6 7.5 9 4.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="w-5 h-5 text-gray-90"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="9"
        cy="9"
        r="6"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="m17 17-3.2-3.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface PanelProps {
  filterTab: FilterTab;
  onFilterChange: (tab: FilterTab) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function VoteMobileVotingRoundPanel({
  filterTab,
  onFilterChange,
  searchQuery,
  onSearchChange,
}: PanelProps) {
  const t = useTranslations();
  const { epoch, isLoading: epochLoading } = useVoteEpoch();

  const filterTabs: {
    id: FilterTab;
    label: string;
    hasSort?: boolean;
    grow?: boolean;
  }[] = [
    { id: "all", label: t("vote.all") },
    { id: "rewards", label: t("vote.rewards"), hasSort: true },
    { id: "votes", label: t("vote.votes"), hasSort: true, grow: true },
    { id: "fees", label: t("vote.fees"), hasSort: true, grow: true },
    { id: "incentives", label: t("vote.incentives"), hasSort: true },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Current voting round summary */}
      <div className="border border-gray-30 rounded-[10px] p-2.5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-gray-100 whitespace-nowrap">
          <p className="body-14-bold">{t("vote.currentVotingRound")}</p>
          <p className="text-[12px] leading-[18px] font-medium">
            {t("vote.endsIn")}{" "}
            <span className="font-bold">
              [{epochLoading ? "..." : (epoch?.endsInDays ?? "—")}{" "}
              {t("vote.days")}]
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <StatRow
            label={t("vote.totalVotingPower")}
            value={
              epochLoading ? null : formatRoundStat(epoch?.totalVotingPower)
            }
          />
          <StatRow
            label={t("vote.totalFees")}
            value={epochLoading ? null : formatRoundStat(epoch?.totalFees, "~$")}
          />
          <StatRow
            label={t("vote.totalIncentives")}
            value={
              epochLoading
                ? null
                : formatRoundStat(epoch?.totalIncentives, "~$")
            }
          />
          <StatRow
            label={t("vote.totalRewards")}
            value={
              epochLoading ? null : formatRoundStat(epoch?.totalRewards, "~$")
            }
          />
        </div>
      </div>

      {/* Filter chips — match Figma flex behavior: All/Rewards/Incentives use
          intrinsic width so long labels never truncate; Votes/Fees flex-grow
          to absorb the remaining space. */}
      <div className="flex items-stretch gap-2 w-full">
        {filterTabs.map((tab) => {
          const isActive = filterTab === tab.id;
          const isAll = tab.id === "all";
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onFilterChange(tab.id)}
              className={`flex items-center justify-center gap-0.5 py-2 rounded-[10px] text-[12px] leading-[18px] transition-colors ${
                tab.grow ? "flex-1 min-w-0" : "shrink-0"
              } ${isAll ? "px-2.5" : "px-1.5"} ${
                isActive
                  ? "bg-gray-100 text-gray-10 font-bold"
                  : "bg-gray-20 text-gray-100 font-medium hover:bg-gray-30"
              }`}
              aria-pressed={isActive}
            >
              <span className="whitespace-nowrap">{tab.label}</span>
              {tab.hasSort ? <DownArrow /> : null}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="border border-gray-40 rounded-full flex items-center gap-2 px-5 py-2.5">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("common.searchAll")}
          aria-label={t("common.searchAll")}
          className="flex-1 bg-transparent outline-none text-[12px] leading-[18px] font-medium text-gray-90 placeholder:text-gray-90"
        />
        <SearchIcon />
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-[12px] leading-[18px] font-medium text-gray-100 whitespace-nowrap">
        {label}
      </p>
      {value === null ? (
        <div className="h-3 w-20 bg-gray-30 rounded animate-pulse" />
      ) : (
        <p className="text-[12px] leading-[18px] font-bold text-gray-100 text-right whitespace-nowrap">
          {value}
        </p>
      )}
    </div>
  );
}

interface PoolListProps {
  filterTab: FilterTab;
  searchQuery: string;
}

export function VoteMobilePoolList({ filterTab, searchQuery }: PoolListProps) {
  const t = useTranslations();
  const { pools, isLoading: poolsLoading } = useVotePools({
    sortBy: tabToSortBy[filterTab],
    search: searchQuery || undefined,
  });

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

  if (poolsLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[240px] bg-white rounded-[20px] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (poolCards.length === 0) {
    return (
      <div className="bg-white rounded-[20px] py-6 text-center">
        <p className="body-14-medium text-gray-60">{t("common.noData")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {poolCards.map((pool) => (
        <VoteMobilePoolCard key={pool.id} pool={pool} />
      ))}
    </div>
  );
}
