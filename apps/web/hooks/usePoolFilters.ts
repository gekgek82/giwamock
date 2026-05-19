"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { PoolInfo } from "./usePools";

// ============================================================================
// Types
// ============================================================================

type Strategy = "concentrated" | "basic";
type PoolType = "volatile" | "stable";

export interface FilterState {
  strategy: Strategy | null;
  type: PoolType | null;
  incentivized: boolean;
}

export type FilterButtonId =
  | "all"
  | "concentrated"
  | "basic"
  | "volatile"
  | "stable"
  | "incentivized";

// ============================================================================
// URL <-> State helpers
// ============================================================================

const STRATEGY_TO_PARAM: Record<Strategy, string> = {
  concentrated: "CL",
  basic: "Basic",
};

const PARAM_TO_STRATEGY: Record<string, Strategy> = {
  CL: "concentrated",
  Basic: "basic",
};

function stateFromParams(params: URLSearchParams): FilterState {
  const incentivized = params.get("incentivized") === "true";
  if (incentivized) {
    return { strategy: null, type: null, incentivized: true };
  }

  const strategyParam = params.get("strategy");
  const typeParam = params.get("type") as PoolType | null;
  const strategy = strategyParam ? PARAM_TO_STRATEGY[strategyParam] ?? null : null;
  const type = strategy && (typeParam === "volatile" || typeParam === "stable") ? typeParam : null;

  return { strategy, type, incentivized: false };
}

function stateToParams(state: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.incentivized) {
    params.set("incentivized", "true");
    return params;
  }
  if (state.strategy) {
    params.set("strategy", STRATEGY_TO_PARAM[state.strategy]);
    if (state.type) {
      params.set("type", state.type);
    }
  }
  return params;
}

// ============================================================================
// Hook
// ============================================================================

export function usePoolFilters(options?: { disableIncentivizedFilter?: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [filterState, setFilterState] = useState<FilterState>(() => {
    const s = stateFromParams(searchParams);
    if (options?.disableIncentivizedFilter && s.incentivized) {
      return { strategy: null, type: null, incentivized: false };
    }
    return s;
  });

  // Sync URL → state (handles browser back/forward)
  useEffect(() => {
    let fromUrl = stateFromParams(searchParams);
    if (options?.disableIncentivizedFilter && fromUrl.incentivized) {
      fromUrl = { strategy: null, type: null, incentivized: false };
    }
    setFilterState((prev) => {
      if (
        prev.strategy === fromUrl.strategy &&
        prev.type === fromUrl.type &&
        prev.incentivized === fromUrl.incentivized
      ) {
        return prev;
      }
      return fromUrl;
    });
  }, [searchParams, options?.disableIncentivizedFilter]);

  // Sync state → URL (push so browser back restores previous filter)
  const isInitialMount = useRef(true);
  useEffect(() => {
    // Skip the first render to avoid pushing the initial URL again
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const params = stateToParams(filterState);
    const qs = params.toString();
    const target = qs ? `${pathname}?${qs}` : pathname;
    router.push(target, { scroll: false });
  }, [filterState, pathname, router]);

  // ---- R7: All click → full reset ----
  const handleAllClick = useCallback(() => {
    setFilterState({ strategy: null, type: null, incentivized: false });
  }, []);

  // ---- R2, R8, R10: Strategy click ----
  const handleStrategyClick = useCallback((s: Strategy) => {
    setFilterState((prev) => {
      // R8: if same strategy clicked → toggle off → R10: back to All
      if (prev.strategy === s) {
        return { strategy: null, type: null, incentivized: false };
      }
      // R2: select strategy, clear type (different strategy), clear incentivized
      return { strategy: s, type: null, incentivized: false };
    });
  }, []);

  // ---- R3, R4, R9: Type click ----
  const handleTypeClick = useCallback((t: PoolType) => {
    setFilterState((prev) => {
      // R3: type only works when strategy is selected
      if (!prev.strategy) return prev;
      // R9: toggle off if same type
      if (prev.type === t) {
        return { ...prev, type: null };
      }
      // R4: set type
      return { ...prev, type: t, incentivized: false };
    });
  }, []);

  // ---- R5, R6: Incentivized click ----
  const handleIncentivizedClick = useCallback(() => {
    setFilterState((prev) => {
      if (prev.incentivized) {
        // R6: toggle off → restore All
        return { strategy: null, type: null, incentivized: false };
      }
      // R5: activate → clear everything else
      return { strategy: null, type: null, incentivized: true };
    });
  }, []);

  // ---- Derived button states ----
  const isAll =
    !filterState.strategy && !filterState.type && !filterState.incentivized;

  const isActive = useCallback(
    (id: FilterButtonId): boolean => {
      switch (id) {
        case "all":
          return isAll;
        case "concentrated":
          return filterState.strategy === "concentrated";
        case "basic":
          return filterState.strategy === "basic";
        case "volatile":
          return filterState.type === "volatile";
        case "stable":
          return filterState.type === "stable";
        case "incentivized":
          return filterState.incentivized;
        default:
          return false;
      }
    },
    [filterState, isAll]
  );

  const isDisabled = useCallback(
    (id: FilterButtonId): boolean => {
      if (options?.disableIncentivizedFilter && id === "incentivized") {
        return true;
      }
      // Only Volatile / Stable can be disabled — when no strategy is selected
      if (id === "volatile" || id === "stable") {
        return !filterState.strategy;
      }
      return false;
    },
    [filterState.strategy, options?.disableIncentivizedFilter],
  );

  // ---- Click dispatcher (used by button onClick) ----
  const handleClick = useCallback(
    (id: FilterButtonId) => {
      if (isDisabled(id)) return;
      switch (id) {
        case "all":
          return handleAllClick();
        case "concentrated":
          return handleStrategyClick("concentrated");
        case "basic":
          return handleStrategyClick("basic");
        case "volatile":
          return handleTypeClick("volatile");
        case "stable":
          return handleTypeClick("stable");
        case "incentivized":
          return handleIncentivizedClick();
      }
    },
    [
      isDisabled,
      handleAllClick,
      handleStrategyClick,
      handleTypeClick,
      handleIncentivizedClick,
    ]
  );

  // ---- Pool filter predicate ----
  const filterPool = useCallback(
    (pool: PoolInfo): boolean => {
      if (isAll) return true;

      if (filterState.incentivized) {
        return pool.hasGauge === true;
      }

      let matches = true;
      if (filterState.strategy === "concentrated") {
        matches = pool.poolType === "CL";
      } else if (filterState.strategy === "basic") {
        matches = pool.poolType !== "CL";
      }

      if (matches && filterState.type === "stable") {
        matches = pool.isStable === true;
      } else if (matches && filterState.type === "volatile") {
        matches = pool.isStable === false;
      }

      return matches;
    },
    [filterState, isAll]
  );

  return {
    filterState,
    handleClick,
    isActive,
    isDisabled,
    filterPool,
    isAll,
  };
}
