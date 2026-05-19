import { SwapDesktopPageView } from "@/components/pages/swap/SwapDesktopPageView";
import { SwapMobilePageView } from "@/components/pages/swap/SwapMobilePageView";

export default function SwapPage() {
  return (
    <>
      <div className="hidden w-full lg:block">
        <SwapDesktopPageView />
      </div>
      <div className="w-full lg:hidden">
        <SwapMobilePageView />
      </div>
    </>
  );
}
