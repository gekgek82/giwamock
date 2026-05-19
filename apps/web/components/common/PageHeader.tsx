import type { ReactNode } from "react";

type PageHeaderSize = "sm" | "lg";

interface PageHeaderProps {
  title: string;
  description?: string;
  rightText?: ReactNode;
  /**
   * - `sm` (default): mobile spec — Inter Bold 16/24 title, body-12 right text, px-4
   * - `lg`: desktop spec — Inter Bold 20/30 title, body-14-medium right text, px-[30px]
   */
  size?: PageHeaderSize;
  className?: string;
}

/**
 * Page section header. Matches the Figma spec for mobile (`sm`) and desktop (`lg`).
 */
export function PageHeader({
  title,
  description,
  rightText,
  size = "sm",
  className = "",
}: PageHeaderProps) {
  const isLg = size === "lg";
  const paddingX = isLg ? "px-[30px]" : "px-4";
  const titleClass = isLg
    ? "text-[20px] leading-[30px] font-bold"
    : "body-16-bold";
  const rightTextClass = isLg
    ? "body-14-medium text-gray-100 text-right whitespace-nowrap"
    : "body-12 font-medium text-gray-100 text-right whitespace-nowrap";

  return (
    <div className={`flex flex-col gap-2 items-center w-full ${className}`}>
      <div
        className={`flex flex-col gap-1 items-start justify-center w-full ${paddingX}`}
      >
        <div className="flex gap-2.5 items-center w-full">
          <h1 className={`flex-1 min-w-0 text-gray-100 ${titleClass}`}>
            {title}
          </h1>
          {rightText && <span className={rightTextClass}>{rightText}</span>}
        </div>
        {description && (
          <p className="body-14-medium text-gray-90 w-full whitespace-pre-line">
            {description}
          </p>
        )}
      </div>
      <div className="h-px w-full bg-gray-30" />
    </div>
  );
}
