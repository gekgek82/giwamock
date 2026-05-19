import { Suspense } from "react";
import { PromotionDesktopPageView } from "@/components/pages/promotion/PromotionDesktopPageView";
import { PromotionMobilePageView } from "@/components/pages/promotion/PromotionMobilePageView";

export default function PromotionPage() {
  return (
    <Suspense>
      <div className="hidden w-full lg:block">
        <PromotionDesktopPageView />
      </div>
      <div className="w-full lg:hidden">
        <PromotionMobilePageView />
      </div>
    </Suspense>
  );
}
