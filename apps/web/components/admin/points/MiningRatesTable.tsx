"use client";

import type { MiningRate } from "@/types/admin";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from "@/components/admin/ui";

interface MiningRatesTableProps {
  rates: MiningRate[];
  isLoading: boolean;
}

const TIER_LABELS: Record<number, string> = {
  1: "Core",
  2: "Major",
  3: "Stable",
};

/**
 * Mining Rates Table
 *
 * Shows mining rates for all pools with token pair, tier, and allocation info.
 */
export function MiningRatesTable({ rates, isLoading }: MiningRatesTableProps) {
  const formatUsd = (value: string): string => {
    const n = parseFloat(value);
    if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return `$${n.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-ds-gray-300 rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pool Mining Rates</CardTitle>
        <CardDescription>{rates.length} pools</CardDescription>
      </CardHeader>

      {rates.length === 0 ? (
        <CardContent>
          <div className="py-8 text-center text-ds-gray-700">
            <p>No mining rates available</p>
          </div>
        </CardContent>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ds-gray-100">
                <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Pool</th>
                <th className="h-10 px-4 text-center text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Tier</th>
                <th className="h-10 px-4 text-right text-xs font-medium text-ds-gray-700 uppercase tracking-wider">TVL</th>
                <th className="h-10 px-4 text-right text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Base Rate</th>
                <th className="h-10 px-4 text-right text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Allocation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ds-gray-400">
              {rates.map((rate) => (
                <tr key={rate.poolAddress} className="hover:bg-ds-gray-100 transition-colors duration-100">
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-ds-gray-1000">{rate.tokenPair}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant={
                        rate.pairTier === 1
                          ? "warning"
                          : rate.pairTier === 2
                            ? "blue"
                            : "default"
                      }
                    >
                      {TIER_LABELS[rate.pairTier] || `T${rate.pairTier}`}
                      <span className="text-[10px] opacity-70 ml-1">{rate.tierMultiplier}x</span>
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-ds-gray-1000 font-geist-mono">{formatUsd(rate.tvl)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-ds-gray-700 font-geist-mono">{rate.baseRate}</span>
                    <span className="text-xs text-ds-gray-600 ml-1">{rate.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-ds-gray-1000 font-geist-mono">
                      {Number(rate.seasonAllocation).toLocaleString()} Pts
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
