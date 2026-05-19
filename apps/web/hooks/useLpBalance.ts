import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { PoolAbi as POOL_ABI } from "@giwater/shared/abis";
import { getMockDemoAddress, isMockMode } from "@/lib/mockTransactions";

export function useLpBalance(poolAddress?: `0x${string}`) {
  const { address } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();

  const mockBalance = 1_000n * 10n ** 18n;

  const {
    data: balance,
    isLoading,
    isFetching,
    refetch,
  } = useReadContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "balanceOf",
    args: effectiveAddress ? [effectiveAddress] : undefined,
    query: {
      enabled: !!effectiveAddress && !!poolAddress && !isMockMode(),
    },
  });

  const { data: totalSupply } = useReadContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "totalSupply",
    query: {
      enabled: !!poolAddress && !isMockMode(),
    },
  });

  if (isMockMode()) {
    return {
      balance: formatUnits(mockBalance, 18),
      balanceRaw: mockBalance,
      totalSupply: 100_000n * 10n ** 18n,
      sharePercentage: 1,
      isLoading: false,
      isFetching: false,
      refetch,
    };
  }

  const formattedBalance = balance ? formatUnits(balance as bigint, 18) : "0";
  const sharePercentage =
    balance && totalSupply ? (Number(balance) / Number(totalSupply)) * 100 : 0;

  return {
    balance: formattedBalance,
    balanceRaw: balance as bigint | undefined,
    totalSupply: totalSupply as bigint | undefined,
    sharePercentage,
    isLoading,
    isFetching,
    refetch,
  };
}
