import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Tailwind-only viewport slots so each route can compose **mobile vs desktop**
 * trees without `useMediaMinWidth`. Prefer a single responsive layout when possible;
 * use these when the UI genuinely diverges (e.g. list vs dense table).
 */

/** `< lg`: phones and small tablets. */
export function BelowLargePanel({ children, className = "" }: PanelProps) {
  return <div className={`lg:hidden ${className}`.trim()}>{children}</div>;
}

/** `lg+`: desktop / large tablet landscape. */
export function LargeAndUpPanel({ children, className = "" }: PanelProps) {
  return <div className={`hidden lg:block ${className}`.trim()}>{children}</div>;
}

/** `< md` */
export function BelowMediumPanel({ children, className = "" }: PanelProps) {
  return <div className={`md:hidden ${className}`.trim()}>{children}</div>;
}

/** `md+` */
export function MediumAndUpPanel({ children, className = "" }: PanelProps) {
  return <div className={`hidden md:block ${className}`.trim()}>{children}</div>;
}
