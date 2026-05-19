import { useAccount, useBalance, useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";

import { useTokenDataSource } from "@/lib/datasources/context";
import { getMockTokenBalance } from "@/lib/mocks";
import { getMockDemoAddress, isMockMode } from "@/lib/mockTransactions";

type UseTokenBalanceArgs =
  | {
      tokenAddress?: `0x${string}`;
      decimals?: number;
      isNative?: boolean;
    }
  | `0x${string}`
  | undefined;

export function useTokenBalance(args?: UseTokenBalanceArgs) {
  const { address } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const token = useTokenDataSource();

  const normalized =
    typeof args === "string" || args === undefined
      ? { tokenAddress: args }
      : args;

  const isNative = normalized.isNative === true;
  const tokenAddress = normalized.tokenAddress;
  const hintDecimals = typeof normalized.decimals === "number" ? normalized.decimals : 18;

  // Read decimals directly from the ERC-20 contract so display is always
  // correct regardless of what the token catalog says.
  const { data: contractDecimals } = useReadContract({
    address: tokenAddress,
    abi: [{ name: "decimals", type: "function", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" }] as const,
    functionName: "decimals",
    query: { enabled: !!tokenAddress && !isNative && !isMockMode() },
  });
  const decimals = contractDecimals != null ? Number(contractDecimals) : hintDecimals;

  const native = useBalance({
    address: effectiveAddress,
    query: { enabled: !!effectiveAddress && isNative && !isMockMode() },
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["token", "balance", tokenAddress, effectiveAddress, isNative ? "native" : "erc20"],
    queryFn: () => token!.getBalance(tokenAddress!, effectiveAddress!),
    enabled: !!token && !!effectiveAddress && !!tokenAddress && !isNative,
  });

  // Design-preview: when the address belongs to a known mock token, override
  // the on-chain read so the deposit / withdraw flows have something to drive
  // the UI with even if the connected wallet doesn't hold the mock token.
  const mockBalance = !isNative ? getMockTokenBalance(tokenAddress) : null;
  if (mockBalance != null) {
    return {
      data: formatUnits(mockBalance, decimals),
      isLoading: false,
      refetch,
      raw: mockBalance,
    };
  }

  if (isMockMode() && isNative) {
    const value = 1_000_000n * 10n ** 18n;
    return {
      data: formatUnits(value, 18),
      isLoading: false,
      refetch: native.refetch,
      raw: value,
    };
  }

  return {
    data: isNative
      ? native.data?.formatted ?? "0"
      : data !== undefined
        ? formatUnits(data, decimals)
        : "0",
    isLoading: isNative ? native.isLoading : isLoading,
    refetch: isNative ? native.refetch : refetch,
    raw: isNative ? native.data?.value : data,
  };
}
