import { PageBanner } from "@/components/common/PageBanner";
import { PageContainer } from "@/components/layout/PageContainer";
import { SwapCard } from "@/components/swap/SwapCard";
import { SitePageShell } from "@/components/pages/_lib/SitePageShell";

/** `/swap` — current full layout (desktop / wide-viewport source of truth). */
export function SwapDesktopPageView() {
  return (
    <SitePageShell>
      <PageBanner page="SWAP" pcWidth={1360} pcHeight={215} />

      <PageContainer as="main" maxWidth="content" className="flex-1 py-12">
        <SwapCard />
      </PageContainer>
    </SitePageShell>
  );
}
