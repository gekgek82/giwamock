import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { ERC20Abi } from "@giwater/shared/abis";

import type { TokenInfo } from "@/hooks/useContractAddresses";

export interface TokenWithBalance extends TokenInfo {
  balance: string;
  balanceRaw: bigint;
  usdValue: number;
}

interface UseTokenBalancesResult {
  balances: Record<string, bigint>;
  tokensWithBalance: TokenWithBalance[];
  isLoading: boolean;
}

export function useTokenBalances(
  tokens: TokenInfo[],
  priceBySymbol: Record<string, number> = {},
): UseTokenBalancesResult {
  const { address } = useAccount();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contracts: any[] = useMemo(
    () =>
      tokens.map((token) => ({
        address: token.address as `0x${string}`,
        abi: ERC20Abi,
        functionName: "balanceOf",
        args: [address],
      })),
    [tokens, address],
  );

  const { data, isLoading } = useReadContracts({
    contracts,
    query: {
      enabled: !!address && tokens.length > 0,
    },
  });

  return useMemo(() => {
    const balances: Record<string, bigint> = {};
    const tokensWithBalance: TokenWithBalance[] = [];

    tokens.forEach((token, index) => {
      const entry = data?.[index];
      const raw =
        entry?.status === "success" ? (entry.result as bigint) : 0n;
      balances[token.address.toLowerCase()] = raw;

      if (raw > 0n) {
        const formatted = formatUnits(raw, token.decimals);
        const price = priceBySymbol[token.symbol] ?? 0;
        tokensWithBalance.push({
          ...token,
          balance: formatted,
          balanceRaw: raw,
          usdValue: parseFloat(formatted) * price,
        });
      }
    });

    tokensWithBalance.sort((a, b) => b.usdValue - a.usdValue);

    return { balances, tokensWithBalance, isLoading };
  }, [data, tokens, priceBySymbol, isLoading]);
}
