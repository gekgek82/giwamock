import { useMemo } from 'react';
import { formatUnits } from 'viem';
import { useGauge, useGaugeData } from './useGauge';
import { useAeroPrice } from './useTokenPrices';

export interface EmissionAPRResult {
  apr: number | null;
  aprFormatted: string;
  hasGauge: boolean;
  isActive: boolean;
  annualRewardsUSD: number;
  isLoading: boolean;
  isMockData: boolean;
}

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

/**
 * Hook to calculate Emission APR for a pool
 * @param poolAddress - The pool contract address
 * @param tvlUSD - Total Value Locked in USD (for APR calculation)
 * @returns Emission APR and related data
 */
export function useEmissionAPR(
  poolAddress?: `0x${string}`,
  tvlUSD: number = 0
): EmissionAPRResult {
  const { gaugeAddress, hasGauge, isAlive, isLoading: isLoadingGauge } = useGauge(poolAddress);
  const { rewardRate, totalSupply, isActive, isLoading: isLoadingData } = useGaugeData(gaugeAddress);
  const { price: aeroPrice, isLoading: isLoadingPrice, isMockData } = useAeroPrice();

  const result = useMemo(() => {
    // No gauge = no emission rewards
    if (!hasGauge || !isAlive) {
      return {
        apr: null,
        aprFormatted: 'N/A',
        annualRewardsUSD: 0,
        isActive: false,
      };
    }

    // Gauge exists but rewards not active
    if (!isActive) {
      return {
        apr: 0,
        aprFormatted: '0%',
        annualRewardsUSD: 0,
        isActive: false,
      };
    }

    // Calculate annual rewards in AERO
    const rewardRatePerSecond = Number(formatUnits(rewardRate, 18));
    const annualRewards = rewardRatePerSecond * SECONDS_PER_YEAR;
    const annualRewardsUSD = annualRewards * aeroPrice;

    // Calculate APR
    // If TVL is 0 but there are rewards, show high APR indicator
    if (tvlUSD <= 0) {
      if (annualRewardsUSD > 0) {
        return {
          apr: null,
          aprFormatted: '∞',
          annualRewardsUSD,
          isActive: true,
        };
      }
      return {
        apr: 0,
        aprFormatted: '0%',
        annualRewardsUSD: 0,
        isActive: true,
      };
    }

    const apr = (annualRewardsUSD / tvlUSD) * 100;

    return {
      apr,
      aprFormatted: formatAPR(apr),
      annualRewardsUSD,
      isActive: true,
    };
  }, [hasGauge, isAlive, isActive, rewardRate, aeroPrice, tvlUSD]);

  return {
    ...result,
    hasGauge,
    isLoading: isLoadingGauge || isLoadingData || isLoadingPrice,
    isMockData,
  };
}

/**
 * Format APR value for display
 */
function formatAPR(apr: number): string {
  if (apr === 0) return '0%';
  
  if (apr >= 10000) {
    return `${(apr / 1000).toFixed(0)}K%`;
  }
  
  if (apr >= 1000) {
    return `${(apr / 1000).toFixed(1)}K%`;
  }
  
  if (apr >= 100) {
    return `${apr.toFixed(0)}%`;
  }
  
  if (apr >= 1) {
    return `${apr.toFixed(2)}%`;
  }
  
  return `${apr.toFixed(4)}%`;
}
