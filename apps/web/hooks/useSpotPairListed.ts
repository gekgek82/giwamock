import { useQuery } from "@tanstack/react-query";
import { gatewayBrokerApi, GatewayBrokerApiError } from "@/lib/gatewayBrokerApi";
import { isGatewayConfigured } from "@/lib/config";

export function useSpotPairListed(poolAddress: string | undefined) {
  return useQuery<boolean, Error>({
    queryKey: ["spot-pair-listed", poolAddress],
    queryFn: async () => {
      try {
        const pair = await gatewayBrokerApi.getSpotPairByAddress(poolAddress!);
        return pair.listed;
      } catch (e) {
        if (e instanceof GatewayBrokerApiError && e.statusCode === 404) {
          return false;
        }
        throw e;
      }
    },
    enabled: isGatewayConfigured() && !!poolAddress,
    staleTime: 30_000,
  });
}
