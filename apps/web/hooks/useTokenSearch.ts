import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { indexerApi, isIndexerConfigured } from "@/lib/indexerApi";
import { saveCustomTokenInfo } from "@/lib/customTokenStorage";
import { fetchErc20TokenInfo } from "@/lib/fetchErc20TokenInfo";
import type { RegisterTokenResponse } from "@/types/indexer";
import { contractQueryKeys } from "./useContractAddresses";

export function useTokenSearch(query: string) {
  return useQuery({
    queryKey: ["tokens", "search", query],
    queryFn: () => indexerApi.searchTokens(query),
    enabled: isIndexerConfigured() && query.length > 0,
    staleTime: 30_000,
    gcTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
}


export function useRegisterToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (address: string): Promise<RegisterTokenResponse> => {
      // Try indexer registration first
      try {
        const result = await indexerApi.registerToken(address);
        if (result.success && result.token) {
          return result;
        }
      } catch {
        // fall through to on-chain fetch
      }
      // Fall back: fetch ERC20 metadata on-chain and persist to localStorage
      const token = await fetchErc20TokenInfo(address);
      if (!token) {
        return { success: false, error: "Address is not a valid ERC20 token" };
      }
      saveCustomTokenInfo(token);
      return { success: true, token };
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["tokens", "custom"] });
        queryClient.invalidateQueries({ queryKey: ["tokens", "search"] });
        queryClient.invalidateQueries({ queryKey: contractQueryKeys.all });
      }
    },
  });
}
