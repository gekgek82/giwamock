"use client";

import { SitePageShell } from "@/components/pages/_lib/SitePageShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { PromotionContent } from "./PromotionContent";

export function PromotionMobilePageView() {
  return (
    <SitePageShell>
      <PageContainer as="main" maxWidth="content" className="flex-1 pb-8 pt-6 px-4">
        <div className="mb-6">
          <h1 className="heading-22 text-gray-900 mb-1">Referral Program</h1>
          <p className="body-14 text-gray-500">
            Invite friends and earn points together.
          </p>
        </div>
        <PromotionContent />
      </PageContainer>
    </SitePageShell>
  );
}
