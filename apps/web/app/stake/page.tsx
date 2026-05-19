import { StakeDesktopPageView } from "@/components/pages/stake/StakeDesktopPageView";
import { StakeMobilePageView } from "@/components/pages/stake/StakeMobilePageView";

export default function StakePage() {
  return (
    <>
      <div className="hidden w-full lg:block">
        <StakeDesktopPageView />
      </div>
      <div className="w-full lg:hidden">
        <StakeMobilePageView />
      </div>
    </>
  );
}
