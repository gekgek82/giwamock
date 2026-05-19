"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { LockPositionTable } from "./LockPositionTable";
import { LiquidityPositionTable } from "./LiquidityPositionTable";
import { PointPositionTable } from "./PointPositionTable";
import { VotePositionTable } from "./VotePositionTable";

interface PositionRewardSectionProps {
  onClaimSuccess?: () => void;
  initialTab?: string;
}

export type PositionRewardTab = "liquidity" | "lock" | "vote" | "point";

type TabKey = PositionRewardTab;

const TAB_LABELS: Record<TabKey, string> = {
  liquidity: "portfolio.liquidity",
  lock: "portfolio.lock",
  vote: "portfolio.vote",
  point: "portfolio.point",
};

function normalizeTab(tab?: string): TabKey {
  if (tab === "lock" || tab === "vote" || tab === "point") return tab;
  return "liquidity";
}

export function PositionRewardSection({
  onClaimSuccess,
  initialTab,
}: PositionRewardSectionProps = {}) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<TabKey>(normalizeTab(initialTab));
  const [liquidityCount, setLiquidityCount] = useState(0);
  const [lockCount, setLockCount] = useState(0);
  const [voteCount, setVoteCount] = useState(0);
  const [pointCount, setPointCount] = useState(0);

  const handleLiquidityCountChange = useCallback((count: number) => {
    setLiquidityCount(count);
  }, []);
  const handleLockCountChange = useCallback((count: number) => {
    setLockCount(count);
  }, []);
  const handleVoteCountChange = useCallback((count: number) => {
    setVoteCount(count);
  }, []);
  const handlePointCountChange = useCallback((count: number) => {
    setPointCount(count);
  }, []);

  const tabCounts: Record<TabKey, number> = {
    liquidity: liquidityCount,
    lock: lockCount,
    vote: voteCount,
    point: pointCount,
  };
  const tabs: TabKey[] = ["liquidity", "lock", "vote", "point"];

  return (
    <div className="flex flex-col gap-3">
      {/* Section Title */}
      <div className="px-2 flex items-center">
        <h2 className="flex-1 text-gray-100 text-2xl font-bold leading-9">
          Position &amp; Reward
        </h2>
      </div>

      {/* White Card Container */}
      <div className="bg-white rounded-[40px] py-[30px] flex flex-col items-center gap-5">
        {/* Tab header */}
        <div className="w-full relative">
          <div className="flex items-start gap-5 pr-[30px]">
            <div className="flex-1 min-w-0 flex items-end gap-8 px-[30px] border-b border-primary-200">
              {tabs.map((tab) => {
                const active = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className="flex flex-col items-center gap-3 -mb-px"
                  >
                    <div
                      className={`flex items-center gap-1 py-1 rounded-[5px] px-2.5 transition-colors ${
                        active
                          ? "bg-gray-20"
                          : "bg-transparent hover:bg-gray-20"
                      }`}
                    >
                      <span
                        className={
                          active
                            ? "text-gray-100 body-16-bold"
                            : "text-gray-70 body-16-medium"
                        }
                      >
                        {t(TAB_LABELS[tab])}
                      </span>
                      <span
                        className={`w-5 h-5 flex items-center justify-center rounded-full text-xs leading-[18px] font-bold ${
                          active
                            ? "bg-primary-200 text-gray-10"
                            : "bg-gray-30 text-gray-70"
                        }`}
                      >
                        {tabCounts[tab]}
                      </span>
                    </div>
                    <div
                      className={`w-full h-0 border-t-2 ${
                        active ? "border-primary-200" : "border-transparent"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {activeTab === "liquidity" && (
          <LiquidityPositionTable
            onPositionCountChange={handleLiquidityCountChange}
          />
        )}
        {activeTab === "lock" && (
          <LockPositionTable onPositionCountChange={handleLockCountChange} />
        )}
        {activeTab === "vote" && (
          <VotePositionTable
            onPositionCountChange={handleVoteCountChange}
            onClaimSuccess={onClaimSuccess}
          />
        )}
        {activeTab === "point" && (
          <PointPositionTable onPositionCountChange={handlePointCountChange} />
        )}
      </div>
    </div>
  );
}
