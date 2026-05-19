import type { ReactNode } from "react";
import type { PageMaxWidthVariant } from "@/lib/page-layout";
import { pageShellClassName } from "@/lib/page-layout";

type PageContainerElement = "div" | "main" | "section";

export interface PageContainerProps {
  children: ReactNode;
  /** Default matches header chrome (`app`); use `content` for `max-w-7xl` columns. */
  maxWidth?: PageMaxWidthVariant;
  className?: string;
  as?: PageContainerElement;
}

/**
 * Centered page column with shared gutters — use for new screens so mobile/desktop
 * spacing stays consistent with the header.
 */
export function PageContainer({
  children,
  maxWidth = "app",
  className,
  as: Tag = "div",
}: PageContainerProps) {
  return (
    <Tag className={pageShellClassName(maxWidth, className)}>{children}</Tag>
  );
}
