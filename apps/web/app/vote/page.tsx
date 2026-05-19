import { VoteDesktopPageView } from "@/components/pages/vote/VoteDesktopPageView";
import { VoteMobilePageView } from "@/components/pages/vote/VoteMobilePageView";

export default function VotePage() {
  return (
    <>
      <div className="hidden w-full lg:block">
        <VoteDesktopPageView />
      </div>
      <div className="w-full lg:hidden">
        <VoteMobilePageView />
      </div>
    </>
  );
}
