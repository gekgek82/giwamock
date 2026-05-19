"use client";

import { SitePageShell } from "@/components/pages/_lib/SitePageShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { PromotionContent } from "./PromotionContent";

export function PromotionDesktopPageView() {
  return (
    <SitePageShell>
      <PageContainer as="main" maxWidth="content" className="flex-1 pb-12 pt-8 px-4">
        <div className="mb-8">
          <h1 className="heading-28 text-gray-900 mb-2">Referral Program</h1>
          <p className="body-16 text-gray-500 max-w-xl">
            Invite friends to Giwater and earn points together. Your referral points accumulate and
            convert to tokens at TGE.
          </p>
        </div>
        <PromotionContent />
      </PageContainer>
    </SitePageShell>
  );
}
