/**
 * React Hook for fetching contract addresses from the Indexer API
 *
 * This hook provides dynamic contract addresses that are fetched from the server,
 * eliminating the need for hardcoded addresses in the codebase.
 *
 * @example
 * ```typescript
 * import { useContractAddresses } from '@/hooks/useContractAddresses';
 *
 * function MyComponent() {
 *   const { contracts, tokens, isLoading } = useContractAddresses();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return <div>Router: {contracts?.router}</div>;
 * }
 * ```
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ContractAddresses, TokenInfo } from "@/types/indexer";
import { gatewayBrokerApi } from "@/lib/gatewayBrokerApi";
import { getCustomTokenInfos } from "@/lib/customTokenStorage";
import {
  PERMIT2_ADDRESS,
  UNIVERSAL_ROUTER_ADDRESS,
} from "@giwater/shared/constants";

// ============================================================================
// Query Keys
// ============================================================================

const CONTRACTS_KEY = ["indexer", "contracts"] as const;

export const contractQueryKeys = {
  all: CONTRACTS_KEY,
  addresses: () => [...CONTRACTS_KEY, "addresses"] as const,
};

// ============================================================================
// Stale Time Configuration
// ============================================================================

/**
 * Contract addresses rarely change, so we use a longer stale time (10 minutes)
 */
const CONTRACTS_STALE_TIME = 10 * 60 * 1000;

/**
 * Cache time for contract addresses (1 hour)
 */
const CONTRACTS_CACHE_TIME = 60 * 60 * 1000;

// ============================================================================
// Hook Options
// ============================================================================

export interface UseContractAddressesOptions {
  /** Enable/disable the query */
  enabled?: boolean;
  /** Stale time in milliseconds */
  staleTime?: number;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook to fetch contract addresses from the Indexer API
 *
 * @param options - Query options
 * @returns Contract addresses data, loading state, and error state
 *
 * @example
 * ```typescript
 * const { contracts, tokens, isLoading, error } = useContractAddresses();
 *
 * // Access contract addresses
 * console.log(contracts?.router);
 * console.log(contracts?.voter);
 *
 * // Access registered tokens
 * console.log(tokens); // TokenInfo[]
 * ```
 */
export function useContractAddresses(options?: UseContractAddressesOptions) {
  const { enabled = true, staleTime = CONTRACTS_STALE_TIME } = options ?? {};

  const query = useQuery({
    queryKey: contractQueryKeys.addresses(),
    queryFn: () => gatewayBrokerApi.getContractAddresses(),
    enabled: enabled && gatewayBrokerApi.isConfigured(),
    staleTime,
    gcTime: CONTRACTS_CACHE_TIME,
    refetchOnWindowFocus: false, // Contract addresses don't change often
    retry: 3,
  });

  return {
    /** Full contract addresses response */
    data: query.data,
    /** Core contract addresses */
    contracts: query.data?.contracts,
    /** Registered tokens */
    tokens: query.data?.tokens,
    /** Popular tokens */
    popularTokens: query.data?.popularTokens,
    /** Chain ID */
    chainId: query.data?.chainId,
    /** Loading state */
    isLoading: query.isLoading,
    /** Error state */
    error: query.error,
    /** Whether data is being refetched */
    isRefetching: query.isRefetching,
    /** Refetch function */
    refetch: query.refetch,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to get a specific contract address
 *
 * @param contractName - Name of the contract (e.g., 'router', 'voter')
 * @returns Contract address or undefined
 *
 * @example
 * ```typescript
 * const routerAddress = useContractAddress('router');
 * const voterAddress = useContractAddress('voter');
 * ```
 */
export function useContractAddress(
  contractName: keyof ContractAddresses["contracts"]
): `0x${string}` | undefined {
  const { contracts } = useContractAddresses();
  const address = contracts?.[contractName];
  return address ? (address as `0x${string}`) : undefined;
}

/**
 * Hook to get the TER token address
 *
 * @returns TER token address or undefined
 */
export function useTerTokenAddress(): `0x${string}` | undefined {
  return useContractAddress("terToken");
}

/**
 * Hook to get the AERO token address
 *
 * @deprecated Use useTerTokenAddress() instead. This is kept for backward compatibility.
 * @returns TER token address or undefined
 */
export function useAeroTokenAddress(): `0x${string}` | undefined {
  return useTerTokenAddress();
}

/**
 * Hook to get the Router contract address
 *
 * @returns Router address or undefined
 */
export function useRouterAddress(): `0x${string}` | undefined {
  return useContractAddress("router");
}

/**
 * Hook to get the Voter contract address
 *
 * @returns Voter address or undefined
 */
export function useVoterAddress(): `0x${string}` | undefined {
  return useContractAddress("voter");
}

/**
 * Hook to get the VotingEscrow contract address
 *
 * @returns VotingEscrow address or undefined
 */
export function useVotingEscrowAddress(): `0x${string}` | undefined {
  return useContractAddress("votingEscrow");
}

/**
 * Hook to get the CL Pool Factory contract address
 *
 * @returns CL Pool Factory address or undefined
 */
export function useClPoolFactoryAddress(): `0x${string}` | undefined {
  return useContractAddress("clPoolFactory");
}

/**
 * Hook to get the NFT Position Manager contract address
 *
 * @returns NFT Position Manager address or undefined
 */
export function useNftPositionManagerAddress(): `0x${string}` | undefined {
  return useContractAddress("nftPositionManager");
}

/**
 * Hook to get the Rewards Distributor contract address
 *
 * @returns Rewards Distributor address or undefined
 */
export function useRewardsDistributorAddress(): `0x${string}` | undefined {
  return useContractAddress("rewardsDistributor");
}

/**
 * Hook to get the Pool Factory contract address
 *
 * @returns Pool Factory address or undefined
 */
export function usePoolFactoryAddress(): `0x${string}` | undefined {
  return useContractAddress("poolFactory");
}

/**
 * Hook to get the Factory Registry contract address
 *
 * @returns Factory Registry address or undefined
 */
export function useFactoryRegistryAddress(): `0x${string}` | undefined {
  return useContractAddress("factoryRegistry");
}

/**
 * Hook to get the Gauge Factory contract address
 *
 * @returns Gauge Factory address or undefined
 */
export function useGaugeFactoryAddress(): `0x${string}` | undefined {
  return useContractAddress("gaugeFactory");
}

/**
 * Hook to get the CL Gauge Factory contract address
 *
 * @returns CL Gauge Factory address or undefined
 */
export function useClGaugeFactoryAddress(): `0x${string}` | undefined {
  return useContractAddress("clGaugeFactory");
}

/**
 * Hook to get the Voting Rewards Factory contract address
 *
 * @returns Voting Rewards Factory address or undefined
 */
export function useVotingRewardsFactoryAddress(): `0x${string}` | undefined {
  return useContractAddress("votingRewardsFactory");
}

/**
 * Hook to get the TER Governor contract address
 *
 * @returns TER Governor address or undefined
 */
export function useTerGovernorAddress(): `0x${string}` | undefined {
  return useContractAddress("terGovernor");
}

/**
 * Hook to get the Epoch Governor contract address
 *
 * @returns Epoch Governor address or undefined
 */
export function useEpochGovernorAddress(): `0x${string}` | undefined {
  return useContractAddress("epochGovernor");
}

/**
 * Hook to get the Swap Router contract address
 *
 * @returns Swap Router address or undefined
 */
export function useSwapRouterAddress(): `0x${string}` | undefined {
  return useContractAddress("swapRouter");
}

/**
 * Hook to get the veArt Proxy contract address
 *
 * @returns veArt Proxy address or undefined
 */
export function useVeArtProxyAddress(): `0x${string}` | undefined {
  return useContractAddress("veArtProxy");
}

/**
 * Hook to get the Permit2 contract address
 *
 * @returns Permit2 address
 */
export function usePermit2Address(): `0x${string}` {
  return PERMIT2_ADDRESS;
}

/**
 * Hook to get the GiwaUniversalRouter contract address
 *
 * @returns UniversalRouter address
 */
export function useUniversalRouterAddress(): `0x${string}` {
  return UNIVERSAL_ROUTER_ADDRESS;
}

/**
 * Hook to get registered tokens from the API
 *
 * @returns Array of registered tokens
 */
export function useRegisteredTokens(): TokenInfo[] {
  const { tokens } = useContractAddresses();
  const { data: customTokens = [] } = useQuery({
    queryKey: ["tokens", "custom"],
    queryFn: () => getCustomTokenInfos(),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const apiTokens = tokens ?? [];
  const apiAddresses = new Set(apiTokens.map((t) => t.address.toLowerCase()));
  const uniqueCustom = customTokens.filter(
    (t) => !apiAddresses.has(t.address.toLowerCase()),
  );
  return [...uniqueCustom, ...apiTokens];
}

export function useApiTokens(): TokenInfo[] {
  const { tokens } = useContractAddresses();
  return tokens ?? [];
}

/**
 * Hook to get popular tokens from the API
 *
 * @returns Array of popular tokens
 */
export function usePopularTokens(): TokenInfo[] {
  const { popularTokens } = useContractAddresses();
  return popularTokens ?? [];
}

/**
 * Hook to find a token by address
 *
 * @param address - Token address to find
 * @returns Token info or undefined
 */
export function useTokenByAddress(address?: string): TokenInfo | undefined {
  const tokens = useRegisteredTokens();
  if (!address) return undefined;
  return tokens.find((t) => t.address.toLowerCase() === address.toLowerCase());
}

/**
 * Hook to find a token by symbol
 *
 * @param symbol - Token symbol to find
 * @returns Token info or undefined
 */
export function useTokenBySymbol(symbol?: string): TokenInfo | undefined {
  const tokens = useRegisteredTokens();
  if (!symbol) return undefined;
  return tokens.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase());
}

// ============================================================================
// Prefetch Utility
// ============================================================================

/**
 * Prefetch contract addresses for better performance
 *
 * Call this during app initialization to preload contract addresses.
 *
 * @example
 * ```typescript
 * // In your app initialization
 * const queryClient = useQueryClient();
 * await prefetchContractAddresses(queryClient);
 * ```
 */
export async function prefetchContractAddresses(
  queryClient: ReturnType<typeof useQueryClient>
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: contractQueryKeys.addresses(),
    queryFn: () => gatewayBrokerApi.getContractAddresses(),
    staleTime: CONTRACTS_STALE_TIME,
  });
}

// ============================================================================
// Re-export Types
// ============================================================================

export type { ContractAddresses, TokenInfo } from "@/types/indexer";
