import { LiquidityDesktopPageView } from "@/components/pages/liquidity/LiquidityDesktopPageView";
import { LiquidityMobilePageView } from "@/components/pages/liquidity/LiquidityMobilePageView";

/**
 * Pool list + stats need the full table (horizontal scroll on narrow viewports).
 * When `LiquidityMobilePageView` is implemented from Figma, restore the `lg`
 * split pattern used on other marketing routes.
 */
export default function LiquidityPage() {
  return (
    <>
      <div className="hidden w-full lg:block">
        <LiquidityDesktopPageView />
      </div>
      <div className="w-full lg:hidden">
        <LiquidityMobilePageView />
      </div>
    </>
  );
}
