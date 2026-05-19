/**
 * Shared horizontal rhythm for chrome (header) and page sections.
 * Mobile-first gutters; widen on `sm` / `lg` like the main nav bar.
 */
export const PAGE_GUTTER_CLASS = "px-4 sm:px-6 lg:px-8";

/** Primary app shell width (matches main navigation bar). */
export const PAGE_MAX_APP_CLASS = "max-w-[1360px]";

/** Wider marketing / dashboard content column (Tailwind `max-w-7xl`). */
export const PAGE_MAX_CONTENT_CLASS = "max-w-7xl";

export type PageMaxWidthVariant = "app" | "content";

const MAX_WIDTH: Record<PageMaxWidthVariant, string> = {
  app: PAGE_MAX_APP_CLASS,
  content: PAGE_MAX_CONTENT_CLASS,
};

export function pageShellClassName(
  variant: PageMaxWidthVariant = "app",
  ...extra: (string | false | null | undefined)[]
): string {
  return [
    "mx-auto w-full",
    MAX_WIDTH[variant],
    PAGE_GUTTER_CLASS,
    ...extra,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Header outer row: app max width, gutters, top spacing. */
export function pageHeaderOuterClassName(): string {
  return pageShellClassName("app", "relative pt-4");
}
