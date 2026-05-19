import { WithdrawDesktopPageView } from "@/components/pages/withdraw/WithdrawDesktopPageView";
import { WithdrawMobilePageView } from "@/components/pages/withdraw/WithdrawMobilePageView";

export default function WithdrawPage() {
  return (
    <>
      <div className="hidden w-full lg:block">
        <WithdrawDesktopPageView />
      </div>
      <div className="w-full lg:hidden">
        <WithdrawMobilePageView />
      </div>
    </>
  );
}
