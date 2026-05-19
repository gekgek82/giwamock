import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export interface SitePageShellProps {
  children: ReactNode;
  /** Applied to the outer `min-h-screen` wrapper (e.g. `bg-brand-bg`). */
  className?: string;
  showHeader?: boolean;
  showFooter?: boolean;
}

/**
 * Standard marketing / app chrome: header + scrollable body + footer.
 * Page-specific layout (banners, `main`) lives in `children`.
 */
export function SitePageShell({
  children,
  className = "",
  showHeader = true,
  showFooter = true,
}: SitePageShellProps) {
  return (
    <div className={`min-h-screen flex flex-col ${className}`.trim()}>
      {showHeader ? <Header /> : null}
      {children}
      {showFooter ? <Footer /> : null}
    </div>
  );
}
