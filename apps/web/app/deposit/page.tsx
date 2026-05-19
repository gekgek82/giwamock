import { DepositDesktopPageView } from "@/components/pages/deposit/DepositDesktopPageView";
import { DepositMobilePageView } from "@/components/pages/deposit/DepositMobilePageView";

export default function DepositPage() {
  return (
    <>
      <div className="hidden w-full lg:block">
        <DepositDesktopPageView />
      </div>
      <div className="w-full lg:hidden">
        <DepositMobilePageView />
      </div>
    </>
  );
}
