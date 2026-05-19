"use client";

import { useEffect, useState } from "react";
import {
  type Breakpoint,
  breakpointMinWidthQuery,
} from "@/lib/breakpoints";

/**
 * True when viewport is at least the given Tailwind `min-*` breakpoint.
 * SSR / first paint: `false` until mounted (avoid hydration mismatch).
 */
export function useMediaMinWidth(bp: Breakpoint): boolean {
  const query = breakpointMinWidthQuery(bp);
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
