import { useMemo } from 'react';
import { usePool } from './usePools';

export interface PoolTypeInfo {
  isStable: boolean;
  strategy: string;
  assetType: string;
  strategyLabel: string;
}

/**
 * Hook to get pool type information (stable/volatile)
 * 
 * Uses cached pool data from Indexer API instead of making RPC calls.
 * 
 * @param poolAddress - The pool contract address
 * @returns Pool type information including strategy and asset type labels
 * 
 * @example
 * ```tsx
 * function PoolInfo({ poolAddress }) {
 *   const { isStable, assetType, strategyLabel } = usePoolType(poolAddress);
 *   
 *   return (
 *     <div>
 *       <span className={isStable ? 'badge-stable' : 'badge-volatile'}>
 *         {assetType}
 *       </span>
 *       <span>{strategyLabel}</span>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePoolType(poolAddress?: `0x${string}`): PoolTypeInfo & { isLoading: boolean } {
  const { pool, isLoading } = usePool(poolAddress);

  const result = useMemo(() => {
    const isStable = pool?.isStable ?? false;
    const isCL = pool?.poolType === 'CL';
    const strategy = isCL ? 'Concentrated' : 'Basic';
    const assetType = isCL
      ? `CL${pool?.tickSpacing ?? ''}`
      : isStable ? 'Stable' : 'Volatile';

    return {
      isStable,
      strategy,
      assetType,
      strategyLabel: `${strategy} ${assetType}`,
    };
  }, [pool?.isStable, pool?.poolType, pool?.tickSpacing]);

  return {
    ...result,
    isLoading,
  };
}
