/**
 * Hook for interacting with CLFactory (Concentrated Liquidity) contract
 *
 * Provides functions to check if a CL pool exists and create new CL pools.
 */

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useClPoolFactoryAddress } from "@/hooks/useContractAddresses";
import { CLFactoryAbi as CL_FACTORY_ABI } from "@giwater/shared/abis";

// Zero address constant
const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;

/**
 * Compute default sqrtPriceX96 for 1:1 price adjusted for token decimals.
 *
 * sqrtPriceX96 = sqrt(10^(decimals0 - decimals1)) * 2^96
 */
export function computeDefaultSqrtPriceX96(
  decimals0: number,
  decimals1: number
): bigint {
  const Q96 = 2n ** 96n;
  const decimalDiff = decimals0 - decimals1;

  if (decimalDiff === 0) {
    return Q96; // 1:1 price
  }

  // Use BigInt-safe computation
  const absDiff = Math.abs(decimalDiff);
  const sqrtFactor = Math.sqrt(10 ** absDiff);

  if (decimalDiff > 0) {
    return BigInt(Math.floor(Number(Q96) * sqrtFactor));
  } else {
    return BigInt(Math.floor(Number(Q96) / sqrtFactor));
  }
}

/**
 * Hook to check if a CL pool exists for a given token pair and tick spacing
 *
 * @param token0 - First token address
 * @param token1 - Second token address
 * @param tickSpacing - Tick spacing value (1, 10, 50, 100, 200)
 * @returns Pool address if exists, null otherwise
 */
export function useCheckCLPoolExists(
  token0: `0x${string}` | undefined,
  token1: `0x${string}` | undefined,
  tickSpacing: number | undefined
) {
  const clFactoryAddress = useClPoolFactoryAddress();

  const {
    data: poolAddress,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: clFactoryAddress,
    abi: CL_FACTORY_ABI,
    functionName: "getPool",
    args:
      token0 && token1 && tickSpacing !== undefined
        ? [token0, token1, tickSpacing]
        : undefined,
    query: {
      enabled:
        !!clFactoryAddress &&
        !!token0 &&
        !!token1 &&
        tickSpacing !== undefined,
    },
  });

  const exists = poolAddress && poolAddress !== ZERO_ADDRESS;

  return {
    poolAddress: exists ? (poolAddress as `0x${string}`) : null,
    exists: !!exists,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to create a new CL pool
 *
 * @returns Functions and state for creating a CL pool
 */
export function useCreateCLPool() {
  const clFactoryAddress = useClPoolFactoryAddress();

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

  const createCLPool = async (
    token0: `0x${string}`,
    token1: `0x${string}`,
    tickSpacing: number,
    sqrtPriceX96: bigint
  ) => {
    if (!clFactoryAddress) {
      throw new Error("CL factory address not available");
    }

    writeContract({
      address: clFactoryAddress,
      abi: CL_FACTORY_ABI,
      functionName: "createPool",
      args: [token0, token1, tickSpacing, sqrtPriceX96],
    });
  };

  // Extract pool address from transaction logs
  const getCreatedPoolAddress = (): `0x${string}` | null => {
    if (!receipt?.logs) return null;

    // Find PoolCreated event
    // PoolCreated(address indexed token0, address indexed token1, int24 indexed tickSpacing, address pool)
    for (const log of receipt.logs) {
      if (log.data && log.data.length >= 66) {
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
    createCLPool,
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
