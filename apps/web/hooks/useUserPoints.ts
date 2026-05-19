import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { portfolioApi } from "@/lib/portfolioApi";

export function useUserPoints() {
  const { address } = useAccount();

  const pointsQuery = useQuery({
    queryKey: ["portfolio", "points", address],
    queryFn: () => portfolioApi.getPointPositions(address!),
    enabled: !!address,
    staleTime: 30 * 1000,
  });

  const locksQuery = useQuery({
    queryKey: ["portfolio", "locks", address],
    queryFn: () => portfolioApi.getLockPositions(address!),
    enabled: !!address,
    staleTime: 30 * 1000,
  });

  return {
    points: pointsQuery.data?.summary,
    locks: locksQuery.data,
    isLoading: pointsQuery.isLoading || locksQuery.isLoading,
    isConnected: !!address,
  };
}
