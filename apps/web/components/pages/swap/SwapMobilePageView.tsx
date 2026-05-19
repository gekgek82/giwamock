import { PageBanner } from "@/components/common/PageBanner";
import { PageContainer } from "@/components/layout/PageContainer";
import { SitePageShell } from "@/components/pages/_lib/SitePageShell";
import { SwapMobileCard } from "@/components/swap/SwapMobileCard";

/** `/swap` — small-viewport layout: banner + mobile swap surface. */
export function SwapMobilePageView() {
  return (
    <SitePageShell>
      <PageBanner
        page="SWAP"
        pcWidth={1360}
        pcHeight={215}
        mobileWidth={390}
        mobileHeight={240}
      />
      <PageContainer as="main" maxWidth="content" className="flex-1 pt-4 pb-6">
        <SwapMobileCard />
      </PageContainer>
    </SitePageShell>
  );
}
