import { PortfolioDesktopPageView } from "@/components/pages/portfolio/PortfolioDesktopPageView";
import { PortfolioMobilePageView } from "@/components/pages/portfolio/PortfolioMobilePageView";

export default function PortfolioPage() {
  return (
    <>
      <div className="hidden w-full lg:block">
        <PortfolioDesktopPageView />
      </div>
      <div className="w-full lg:hidden">
        <PortfolioMobilePageView />
      </div>
    </>
  );
}
