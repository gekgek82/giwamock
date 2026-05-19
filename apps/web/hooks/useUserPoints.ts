import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { portfolioApi } from "@/lib/portfolioApi";
import { isMockMode, getMockDemoAddress } from "@/lib/mockTransactions";

export function useUserPoints() {
  const { address } = useAccount();
  const effectiveAddress = address ?? (isMockMode() ? getMockDemoAddress() : undefined);

  const pointsQuery = useQuery({
    queryKey: ["portfolio", "points", effectiveAddress],
    queryFn: () => portfolioApi.getPointPositions(effectiveAddress!),
    enabled: !!effectiveAddress,
    staleTime: 30 * 1000,
  });

  const locksQuery = useQuery({
    queryKey: ["portfolio", "locks", effectiveAddress],
    queryFn: () => portfolioApi.getLockPositions(effectiveAddress!),
    enabled: !!effectiveAddress,
    staleTime: 30 * 1000,
  });

  return {
    points: pointsQuery.data?.summary,
    locks: locksQuery.data,
    isLoading: pointsQuery.isLoading || locksQuery.isLoading,
    isConnected: !!effectiveAddress,
  };
}
