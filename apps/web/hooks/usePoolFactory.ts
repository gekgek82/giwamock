/**
 * Hook for interacting with PoolFactory contract
 *
 * Provides functions to check if a pool exists and create new pools.
 */

import {
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { usePoolFactoryAddress } from "@/hooks/useContractAddresses";
import { usePoolDataSource } from "@/lib/datasources/context";
import { PoolFactoryAbi as POOL_FACTORY_ABI } from "@giwater/shared/abis";

// Zero address constant
const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;

/**
 * Hook to check if a pool exists for a given token pair.
 * Delegates to the pool data source; works transparently on either RPC
 * or a future gateway implementation.
 */
export function useCheckPoolExists(
  token0: `0x${string}` | undefined,
  token1: `0x${string}` | undefined,
  stable: boolean | null
) {
  const pool = usePoolDataSource();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["pool", "exists", token0, token1, stable],
    queryFn: () => pool!.checkExists(token0!, token1!, stable!),
    enabled:
      !!pool && !!token0 && !!token1 && stable !== null,
  });

  return {
    poolAddress: data?.poolAddress ?? null,
    exists: !!data?.exists,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to create a new pool
 *
 * @returns Functions and state for creating a pool
 */
export function useCreatePool() {
  const poolFactoryAddress = usePoolFactoryAddress();

  const {
    data: hash,
    writeContract,
    isPending: isWritePending,
    error: writeError,
    reset,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const createPool = async (
    token0: `0x${string}`,
    token1: `0x${string}`,
    stable: boolean
  ) => {
    if (!poolFactoryAddress) {
      throw new Error("Pool factory address not available");
    }

    writeContract({
      address: poolFactoryAddress,
      abi: POOL_FACTORY_ABI,
      functionName: "createPool",
      args: [token0, token1, stable],
    });
  };

  // Extract pool address from transaction logs
  const getCreatedPoolAddress = (): `0x${string}` | null => {
    if (!receipt?.logs) return null;

    // Find PoolCreated event
    // PoolCreated(address indexed token0, address indexed token1, bool indexed stable, address pool, uint256)
    for (const log of receipt.logs) {
      // The pool address is in the data field (non-indexed parameter)
      if (log.data && log.data.length >= 66) {
        // First 32 bytes (64 chars + 0x) is the pool address
        const poolAddress = ("0x" +
          log.data.slice(2, 66).slice(24)) as `0x${string}`;
        if (poolAddress !== ZERO_ADDRESS) {
          return poolAddress;
        }
      }
    }

    return null;
  };

  return {
    createPool,
    hash,
    isWritePending,
    isConfirming,
    isConfirmed,
    isPending: isWritePending || isConfirming,
    writeError,
    confirmError,
    error: writeError || confirmError,
    receipt,
    getCreatedPoolAddress,
    reset,
  };
}
