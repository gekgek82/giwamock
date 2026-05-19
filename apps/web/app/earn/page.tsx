import { EarnDesktopPageView } from "@/components/pages/earn/EarnDesktopPageView";
import { EarnMobilePageView } from "@/components/pages/earn/EarnMobilePageView";

export default function EarnPage() {
  return (
    <>
      <div className="hidden w-full lg:block">
        <EarnDesktopPageView />
      </div>
      <div className="w-full lg:hidden">
        <EarnMobilePageView />
      </div>
    </>
  );
}
