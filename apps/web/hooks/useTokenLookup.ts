/**
 * Hook for looking up ERC-20 token info by contract address.
 *
 * The user types an address; we validate the hex format locally, then
 * delegate to the token data source. A `null` result from the data source
 * means "not a valid ERC-20", which we surface as `tokenNotFound`.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { isAddress } from "viem";

import { useTokenDataSource } from "@/lib/datasources/context";
import type { TokenInfo } from "@/types/indexer";

export interface UseTokenFromAddressResult {
  /** The token info if found */
  token: TokenInfo | null;
  /** Whether the lookup is in progress */
  isLoading: boolean;
  /** Whether the address format is valid */
  isValidAddress: boolean;
  /** Whether the token was found and is valid ERC20 */
  isValidToken: boolean;
  /** Error message if any */
  error: string | null;
}

/**
 * Hook to look up ERC-20 token information from a contract address.
 */
export function useTokenFromAddress(
  address: string | undefined,
): UseTokenFromAddressResult {
  const token = useTokenDataSource();

  const isValidAddress = useMemo(() => {
    if (!address) return false;
    return isAddress(address);
  }, [address]);

  const contractAddress =
    isValidAddress && address ? (address as `0x${string}`) : undefined;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["token", "metadata", contractAddress],
    queryFn: () => token!.getMetadata(contractAddress!),
    enabled: !!token && isValidAddress && !!contractAddress,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo((): UseTokenFromAddressResult => {
    if (!address) {
      return {
        token: null,
        isLoading: false,
        isValidAddress: false,
        isValidToken: false,
        error: null,
      };
    }

    if (!isValidAddress) {
      return {
        token: null,
        isLoading: false,
        isValidAddress: false,
        isValidToken: false,
        error: "invalidAddress",
      };
    }

    if (isLoading) {
      return {
        token: null,
        isLoading: true,
        isValidAddress: true,
        isValidToken: false,
        error: null,
      };
    }

    if (isError || !data) {
      return {
        token: null,
        isLoading: false,
        isValidAddress: true,
        isValidToken: false,
        error: "tokenNotFound",
      };
    }

    const tokenInfo: TokenInfo = {
      address: data.address,
      symbol: data.symbol,
      name: data.name,
      decimals: data.decimals,
      iconUrl: null,
    };

    return {
      token: tokenInfo,
      isLoading: false,
      isValidAddress: true,
      isValidToken: true,
      error: null,
    };
  }, [address, isValidAddress, isLoading, isError, data]);
}
