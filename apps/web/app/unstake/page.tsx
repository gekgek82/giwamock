import { UnstakeDesktopPageView } from "@/components/pages/unstake/UnstakeDesktopPageView";
import { UnstakeMobilePageView } from "@/components/pages/unstake/UnstakeMobilePageView";

export default function UnstakePage() {
  return (
    <>
      <div className="hidden w-full lg:block">
        <UnstakeDesktopPageView />
      </div>
      <div className="w-full lg:hidden">
        <UnstakeMobilePageView />
      </div>
    </>
  );
}
