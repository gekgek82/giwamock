"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TokenInfo } from "@/hooks/useContractAddresses";
import { usePools } from "@/hooks/usePools";
import { GIWA_SEPOLIA_CHAIN_ID } from "@/lib/config";
import type {
  ConfigurationRow,
  LaunchPoolRowMetrics,
  PoolCategory,
  PoolSelection,
} from "./types";
import {
  buildPoolKey,
  CL_TICK_SPACINGS,
  launchMapKeyForPool,
  normalizeTokenPair,
  poolInfoToLaunchMetrics,
} from "./utils";

export interface UseLaunchPoolForm {
  token0: TokenInfo | null;
  token1: TokenInfo | null;
  setToken0: (token: TokenInfo | null) => void;
  setToken1: (token: TokenInfo | null) => void;
  sortedToken0: TokenInfo | null;
  sortedToken1: TokenInfo | null;
  poolCategory: PoolCategory;
  setPoolCategory: (category: PoolCategory) => void;
  isToken0ModalOpen: boolean;
  isToken1ModalOpen: boolean;
  setIsToken0ModalOpen: (open: boolean) => void;
  setIsToken1ModalOpen: (open: boolean) => void;
  bothTokensSelected: boolean;
  configurationRows: ConfigurationRow[];
  isLoadingPools: boolean;
  handleDirectDeposit: (config: NonNullable<PoolSelection>) => void;
}

export function useLaunchPoolForm(): UseLaunchPoolForm {
  const router = useRouter();

  const [token0, setToken0] = useState<TokenInfo | null>(null);
  const [token1, setToken1] = useState<TokenInfo | null>(null);
  const [poolCategory, setPoolCategory] = useState<PoolCategory>(null);
  const [isToken0ModalOpen, setIsToken0ModalOpen] = useState(false);
  const [isToken1ModalOpen, setIsToken1ModalOpen] = useState(false);

  const bothTokensSelected = !!token0 && !!token1;

  const { pools, isLoading: isLoadingPools } = usePools();

  const [sortedToken0, sortedToken1] = useMemo(() => {
    if (!token0 || !token1) return [token0, token1];
    return token0.address.toLowerCase() < token1.address.toLowerCase()
      ? [token0, token1]
      : [token1, token0];
  }, [token0, token1]);

  const poolMetricsByLaunchKey = useMemo(() => {
    const map = new Map<string, LaunchPoolRowMetrics>();
    for (const pool of pools) {
      map.set(launchMapKeyForPool(pool), poolInfoToLaunchMetrics(pool));
    }
    return map;
  }, [pools]);

  const configurationRows = useMemo((): ConfigurationRow[] => {
    if (!poolCategory || !token0 || !token1) return [];

    if (poolCategory === "cl") {
      return CL_TICK_SPACINGS.map((cl) => ({
        key: `cl-${cl.tickSpacing}`,
        strategyTop: "Concentrated",
        strategyBottom: `${cl.name} · ${cl.fee}`,
        poolMetrics:
          poolMetricsByLaunchKey.get(
            buildPoolKey(token0.address, token1.address, "CL", cl.tickSpacing),
          ) ?? null,
        poolSelection: {
          category: "cl" as const,
          tickSpacing: cl.tickSpacing,
        },
      }));
    }

    return [
      {
        key: "basic-volatile",
        strategyTop: "Basic",
        strategyBottom: "Volatile",
        poolMetrics:
          poolMetricsByLaunchKey.get(
            buildPoolKey(token0.address, token1.address, "BASIC", false),
          ) ?? null,
        poolSelection: { category: "basic" as const, isStable: false },
      },
      {
        key: "basic-stable",
        strategyTop: "Basic",
        strategyBottom: "Stable",
        poolMetrics:
          poolMetricsByLaunchKey.get(
            buildPoolKey(token0.address, token1.address, "BASIC", true),
          ) ?? null,
        poolSelection: { category: "basic" as const, isStable: true },
      },
    ];
  }, [poolCategory, token0, token1, poolMetricsByLaunchKey]);

  const handleDirectDeposit = (config: NonNullable<PoolSelection>) => {
    if (!token0 || !token1) return;

    const poolType =
      config.category === "basic"
        ? config.isStable
          ? "0"
          : "-1"
        : config.tickSpacing.toString();

    const [sortedAddr0, sortedAddr1] = normalizeTokenPair(
      token0.address,
      token1.address,
    );

    const params = new URLSearchParams({
      token0: sortedAddr0,
      token1: sortedAddr1,
      type: poolType,
      chain0: GIWA_SEPOLIA_CHAIN_ID.toString(),
      chain1: GIWA_SEPOLIA_CHAIN_ID.toString(),
    });

    router.push(`/deposit?${params.toString()}`);
  };

  return {
    token0,
    token1,
    setToken0,
    setToken1,
    sortedToken0,
    sortedToken1,
    poolCategory,
    setPoolCategory,
    isToken0ModalOpen,
    isToken1ModalOpen,
    setIsToken0ModalOpen,
    setIsToken1ModalOpen,
    bothTokensSelected,
    configurationRows,
    isLoadingPools,
    handleDirectDeposit,
  };
}
