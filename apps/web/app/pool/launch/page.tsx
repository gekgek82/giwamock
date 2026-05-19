import { LaunchPoolDesktopPageView } from "@/components/pages/pool/launch/LaunchPoolDesktopPageView";
import { LaunchPoolMobilePageView } from "@/components/pages/pool/launch/LaunchPoolMobilePageView";

export default function LaunchPoolPage() {
  return (
    <>
      <div className="hidden w-full lg:block">
        <LaunchPoolDesktopPageView />
      </div>
      <div className="w-full lg:hidden">
        <LaunchPoolMobilePageView />
      </div>
    </>
  );
}
