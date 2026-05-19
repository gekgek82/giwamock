import { HomeDesktopPageView } from "@/components/pages/home/HomeDesktopPageView";
import { HomeMobilePageView } from "@/components/pages/home/HomeMobilePageView";

export default function DashboardPage() {
  return (
    <>
      <div className="hidden w-full lg:block">
        <HomeDesktopPageView />
      </div>
      <div className="w-full lg:hidden">
        <HomeMobilePageView />
      </div>
    </>
  );
}
