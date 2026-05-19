import { PageContainer } from "@/components/layout/PageContainer";
import { MyPoints } from "@/components/vote/MyPoints";
import { VotingRound } from "@/components/vote/VotingRound";
import { SitePageShell } from "@/components/pages/_lib/SitePageShell";

/** `/vote` — current full layout (desktop / wide-viewport source of truth). */
export function VoteDesktopPageView() {
  return (
    <SitePageShell className="bg-brand-bg">
      <PageContainer
        as="main"
        maxWidth="content"
        className="flex-1 py-8 lg:px-5"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="lg:sticky lg:top-8 lg:self-start">
            <MyPoints />
          </div>
          <div>
            <VotingRound />
          </div>
        </div>
      </PageContainer>
    </SitePageShell>
  );
}
