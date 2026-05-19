import { useQuery } from "@tanstack/react-query";
import { indexerApi, isIndexerConfigured } from "@/lib/indexerApi";
import type { VotePoolsQuery } from "@/types/indexer";

export function useVotePools(options?: VotePoolsQuery) {
  const query = useQuery({
    queryKey: ["vote", "pools", options?.sortBy, options?.search],
    queryFn: () => indexerApi.getVotePools(options),
    enabled: isIndexerConfigured(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    pools: query.data?.pools ?? [],
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    error: query.error,
  };
}
