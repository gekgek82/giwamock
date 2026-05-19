"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/layout/PageContainer";
import { SitePageShell } from "@/components/pages/_lib/SitePageShell";
import { VoteMobileMyPoints } from "@/components/vote/VoteMobileMyPoints";
import {
  VoteMobileVotingRoundPanel,
  VoteMobilePoolList,
} from "@/components/vote/VoteMobileVotingRound";
import type { FilterTab } from "@/components/vote/VoteMobileVotingRound";
import { useUserPoints } from "@/hooks/useUserPoints";
import { useTPointUserLocks } from "@/hooks/useTPointLocks";
import { IS_PRE_TGE } from "@/lib/config";

// `/vote` — small-viewport layout. Switches between a Lock CTA panel and the
// voting round / pool list based on the top tab selection. Filter and search
// state live here so the panel (inside the tabs card) stays in sync with the
// pool list rendered as separate surfaces below.

type VoteMobileTab = "lock" | "vote";

export function VoteMobilePageView() {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<VoteMobileTab>("lock");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { locks } = useUserPoints();
  const { summary: tpointSummary } = useTPointUserLocks();
  const locksCount = IS_PRE_TGE
    ? (tpointSummary?.totalLocks ?? 0)
    : (locks?.summary?.totalLocks ?? 0);

  return (
    <SitePageShell className="bg-brand-bg">
      <PageContainer
        as="main"
        maxWidth="content"
        className="flex-1 pt-4 pb-6"
      >
        <div className="flex flex-col gap-2">
          <VoteMobileMyPoints />

          {/* Tabs surface — Lock / Vote */}
          <div className="bg-white rounded-[20px] p-4 flex flex-col gap-4">
            <VoteMobileTabsRow
              activeTab={activeTab}
              onChange={setActiveTab}
              voteBadge={locksCount > 0 ? locksCount : undefined}
            />

            {activeTab === "lock" ? (
              <div className="flex flex-col gap-3">
                <div className="bg-gray-20 rounded-[20px] p-4 flex items-center gap-2.5">
                  <p className="flex-1 body-14-medium text-gray-100">
                    {t("vote.lockMore")}
                  </p>
                  <Link
                    href="/vote/lock"
                    className="shrink-0 bg-brand-green hover:bg-green-10 transition-colors text-gray-100 px-2.5 py-2 rounded-[20px] body-14-bold whitespace-nowrap"
                  >
                    {t("vote.lockNow")}
                  </Link>
                </div>
                <div className="bg-gray-20 rounded-[20px] p-4 flex items-center gap-2.5">
                  <p className="flex-1 body-14-medium text-gray-100">
                    {t("vote.trackActivePositions")}
                  </p>
                  <Link
                    href="/portfolio"
                    className="shrink-0 bg-brand-green hover:bg-green-10 transition-colors text-gray-100 px-2.5 py-2 rounded-[20px] body-14-bold whitespace-nowrap"
                  >
                    {t("vote.goPortfolio")}
                  </Link>
                </div>
              </div>
            ) : (
              <VoteMobileVotingRoundPanel
                filterTab={filterTab}
                onFilterChange={setFilterTab}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            )}
          </div>

          {activeTab === "vote" ? (
            <VoteMobilePoolList
              filterTab={filterTab}
              searchQuery={searchQuery}
            />
          ) : null}
        </div>
      </PageContainer>
    </SitePageShell>
  );
}

interface TabsRowProps {
  activeTab: VoteMobileTab;
  onChange: (tab: VoteMobileTab) => void;
  voteBadge?: number;
}

function VoteMobileTabsRow({ activeTab, onChange, voteBadge }: TabsRowProps) {
  return (
    <div
      role="tablist"
      aria-label="Vote sections"
      className="flex items-end gap-3.5 border-b border-gray-30"
    >
      <TabButton
        active={activeTab === "lock"}
        onClick={() => onChange("lock")}
        label="Lock"
      />
      <TabButton
        active={activeTab === "vote"}
        onClick={() => onChange("vote")}
        label="Vote"
        badge={voteBadge}
      />
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
}

function TabButton({ active, onClick, label, badge }: TabButtonProps) {
  // -bottom-px lets the green underline overlap the parent gray hairline so the
  // active tab visually punches through the divider.
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative flex flex-col items-stretch ${
        active
          ? "after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-0.5 after:bg-green-10"
          : ""
      }`}
    >
      <div
        className={`flex items-center gap-1 ${
          active ? "bg-gray-20 rounded-[5px] px-2 py-1" : "py-1"
        }`}
      >
        <span
          className={`text-[16px] leading-[24px] ${
            active ? "font-bold text-green-10" : "font-medium text-gray-100"
          }`}
        >
          {label}
        </span>
        {badge !== undefined ? (
          <span className="size-5 bg-green-10 rounded-full inline-flex items-center justify-center text-gray-10 text-[12px] leading-[18px]">
            <span className={active ? "font-bold" : "font-medium"}>
              {badge}
            </span>
          </span>
        ) : null}
      </div>
    </button>
  );
}
