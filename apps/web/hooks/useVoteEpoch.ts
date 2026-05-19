import { useQuery } from "@tanstack/react-query";
import { indexerApi, isIndexerConfigured } from "@/lib/indexerApi";

export function useVoteEpoch() {
  const query = useQuery({
    queryKey: ["vote", "epoch", "current"],
    queryFn: () => indexerApi.getVoteEpoch(),
    enabled: isIndexerConfigured(),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });

  return {
    epoch: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
