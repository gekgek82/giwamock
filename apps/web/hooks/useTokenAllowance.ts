import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";

import { useTokenDataSource } from "@/lib/datasources/context";
import { isMockToken } from "@/lib/mocks";
import { getMockDemoAddress, isMockMode } from "@/lib/mockTransactions";

export function useTokenAllowance(
  tokenAddress: `0x${string}` | undefined,
  spenderAddress: `0x${string}` | undefined,
) {
  const { address } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const token = useTokenDataSource();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["token", "allowance", tokenAddress, effectiveAddress, spenderAddress],
    queryFn: () =>
      token!.getAllowance(tokenAddress!, effectiveAddress!, spenderAddress!),
    enabled: !!token && !!effectiveAddress && !!tokenAddress && !!spenderAddress,
  });

  // Design-preview: report mock tokens as fully-approved so the (un-mocked)
  // `approve(...)` write call doesn't run against an address that doesn't
  // exist on chain. Lets the user reach the deposit submit panel.
  if (isMockMode() || isMockToken(tokenAddress)) {
    return {
      allowance: BigInt(
        "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
      ),
      isLoading: false,
      refetch,
    };
  }

  return {
    allowance: data,
    isLoading,
    refetch,
  };
}
