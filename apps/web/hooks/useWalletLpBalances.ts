"use client";

import { useMemo, useEffect, useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import type { SpotPairRecordDto } from "@giwater/shared";
import { gatewayBrokerApi } from "@/lib/gatewayBrokerApi";

const BALANCE_OF_ABI = [
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const TOTAL_SUPPLY_ABI = [
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export interface LpPosition {
  pair: SpotPairRecordDto;
  balance: bigint;
  /** Total LP supply for basic pools; undefined for CL pools. */
  totalSupply?: bigint;
}

export function useWalletLpBalances(): {
  positions: LpPosition[];
  isLoading: boolean;
  isConnected: boolean;
  refetch: () => void;
} {
  const { address, isConnected } = useAccount();
  const [pairs, setPairs] = useState<SpotPairRecordDto[]>([]);
  const [pairsLoading, setPairsLoading] = useState(false);
  const [fetchTick, setFetchTick] = useState(0);

  useEffect(() => {
    if (!isConnected) {
      setPairs([]);
      return;
    }
    let cancelled = false;
    setPairsLoading(true);
    gatewayBrokerApi
      .listSpotPairsRecentlyCreated({ listed: true, limit: 200 })
      .then((page) => {
        if (!cancelled) setPairs(page.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setPairs([]);
      })
      .finally(() => {
        if (!cancelled) setPairsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isConnected, fetchTick]);

  const balanceContracts = useMemo(
    () =>
      pairs.map((pair) => ({
        address: (
          pair.isConcentratedLiquidity && pair.nftAddress
            ? pair.nftAddress
            : pair.id
        ) as `0x${string}`,
        abi: BALANCE_OF_ABI,
        functionName: "balanceOf" as const,
        args: [address!] as readonly [`0x${string}`],
      })),
    [pairs, address],
  );

  const basicPairs = useMemo(
    () => pairs.filter((p) => !p.isConcentratedLiquidity),
    [pairs],
  );

  const supplyContracts = useMemo(
    () =>
      basicPairs.map((pair) => ({
        address: pair.id as `0x${string}`,
        abi: TOTAL_SUPPLY_ABI,
        functionName: "totalSupply" as const,
      })),
    [basicPairs],
  );

  const { data: balancesData, isLoading: balancesLoading } = useReadContracts({
    contracts: balanceContracts,
    query: { enabled: !!address && balanceContracts.length > 0 },
  });

  const { data: suppliesData, isLoading: suppliesLoading } = useReadContracts({
    contracts: supplyContracts,
    query: { enabled: supplyContracts.length > 0 },
  });

  const supplyMap = useMemo(() => {
    const map = new Map<string, bigint>();
    if (!suppliesData) return map;
    basicPairs.forEach((pair, i) => {
      const result = suppliesData[i];
      if (result?.status === "success") {
        map.set(pair.id, result.result as bigint);
      }
    });
    return map;
  }, [basicPairs, suppliesData]);

  const positions = useMemo<LpPosition[]>(() => {
    if (!balancesData) return [];
    return pairs.reduce<LpPosition[]>((acc, pair, i) => {
      const result = balancesData[i];
      if (result?.status === "success") {
        const balance = result.result as bigint;
        if (balance > 0n) {
          const totalSupply = pair.isConcentratedLiquidity
            ? undefined
            : supplyMap.get(pair.id);
          acc.push({ pair, balance, totalSupply });
        }
      }
      return acc;
    }, []);
  }, [pairs, balancesData, supplyMap]);

  return {
    positions,
    isLoading: pairsLoading || balancesLoading || suppliesLoading,
    isConnected,
    refetch: () => setFetchTick((t) => t + 1),
  };
}
