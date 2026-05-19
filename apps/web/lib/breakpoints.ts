/**
 * Tailwind default `min-*` breakpoints (px). Keep in sync with Tailwind docs;
 * used for `matchMedia` in client hooks.
 */
export type Breakpoint = "sm" | "md" | "lg" | "xl" | "2xl";

export const BREAKPOINT_MIN_PX: Record<Breakpoint, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

export function breakpointMinWidthQuery(bp: Breakpoint): string {
  return `(min-width: ${BREAKPOINT_MIN_PX[bp]}px)`;
}
