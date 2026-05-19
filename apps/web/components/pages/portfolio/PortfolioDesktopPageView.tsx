"use client";

import { useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PageBanner } from "@/components/common/PageBanner";
import { PageContainer } from "@/components/layout/PageContainer";
import { OverviewSection } from "@/components/portfolio/OverviewSection";
import { PositionRewardSection } from "@/components/portfolio/PositionRewardSection";
import { TransactionHistory } from "@/components/portfolio/TransactionHistory";
import { SitePageShell } from "@/components/pages/_lib/SitePageShell";

/** `/portfolio` — current full layout (desktop / wide-viewport source of truth). */
export function PortfolioDesktopPageView() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const positionSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!tabParam) return;
    positionSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [tabParam]);

  return (
    <SitePageShell>
      <PageBanner page="PORTFOLIO" pcWidth={1360} pcHeight={215} />

      <PageContainer
        as="main"
        maxWidth="content"
        className="flex-1 space-y-8 pb-8 pt-8"
      >
        <OverviewSection />

        <section ref={positionSectionRef} className="scroll-mt-4">
          <PositionRewardSection initialTab={tabParam ?? undefined} />
        </section>

        <TransactionHistory />
      </PageContainer>
    </SitePageShell>
  );
}
