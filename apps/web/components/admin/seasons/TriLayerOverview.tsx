"use client";

import type { SeasonConfig, BasePointConfig } from "@/types/admin";
import { Card, CardContent } from "@/components/admin/ui";

interface TriLayerOverviewProps {
  activeSeason: SeasonConfig | null;
  basePointConfig: BasePointConfig | null;
  isLoading: boolean;
}

/**
 * Tri-Layer Model Overview Card
 *
 * Visualizes the three layers of daily point distribution:
 * - Base Layer (fixed, always-on)
 * - Season Layer (dynamic, season-themed)
 * - Referral Layer (referral, extra minting)
 */
export function TriLayerOverview({
  activeSeason,
  basePointConfig,
  isLoading,
}: TriLayerOverviewProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="h-48 bg-ds-gray-300 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!activeSeason || activeSeason.rewardType !== "DISTRIBUTION") {
    return (
      <Card>
        <CardContent className="py-6">
          <h3 className="text-sm font-semibold text-ds-gray-1000 mb-2">Tri-Layer Model</h3>
          <p className="text-sm text-ds-gray-700">
            No active DISTRIBUTION season. The Tri-Layer Model applies only to distribution seasons.
          </p>
        </CardContent>
      </Card>
    );
  }

  const dailyCap = Number(activeSeason.dailyCap);
  const baseRatio = parseFloat(activeSeason.baseLayerRatio || "0.7");
  const seasonRatio = 1 - baseRatio;
  const baseLayerCap = dailyCap * baseRatio;
  const seasonLayerCap = dailyCap * seasonRatio;

  // Base Layer LP/Trade from BasePointConfig
  const baseLpWeight = basePointConfig ? parseFloat(basePointConfig.lpWeight) : 0.7;
  const baseTradeWeight = basePointConfig ? parseFloat(basePointConfig.tradeWeight) : 0.3;

  // Season Layer LP/Trade from SeasonWeight
  const seasonLpWeight = parseFloat(
    activeSeason.weights?.find((w: { sector: string; weight: string }) => w.sector === "LP")?.weight || "0"
  );
  const seasonTradeWeight = parseFloat(
    activeSeason.weights?.find((w: { sector: string; weight: string }) => w.sector === "TRADE")?.weight || "0"
  );

  // Combined pools
  const totalLp = baseLayerCap * baseLpWeight + seasonLayerCap * seasonLpWeight;
  const totalTrade = baseLayerCap * baseTradeWeight + seasonLayerCap * seasonTradeWeight;
  const totalLpPercent = dailyCap > 0 ? (totalLp / dailyCap) * 100 : 0;
  const totalTradePercent = dailyCap > 0 ? (totalTrade / dailyCap) * 100 : 0;

  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-semibold text-ds-gray-1000">Tri-Layer Point Allocation Model</h3>
            <p className="text-xs text-ds-gray-700 mt-0.5">
              {activeSeason.name} — {dailyCap.toLocaleString()} Pts/day + Bonus
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">Overall Ratio</p>
            <p className="text-sm font-medium text-ds-gray-1000 font-geist-mono">
              LP {totalLpPercent.toFixed(1)}% / Trade {totalTradePercent.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Visual Layer Stack */}
        <div className="space-y-3">
          {/* Base Layer */}
          <div className="flex items-center gap-4">
            <div className="w-32 flex-none">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-ds-blue-700" />
                <span className="text-sm font-medium text-ds-blue-400">Base Layer</span>
              </div>
              <p className="text-xs text-ds-gray-600 mt-0.5">{(baseRatio * 100).toFixed(0)}% — Always-on</p>
            </div>
            <div className="flex-1">
              <div className="flex h-10 rounded-lg overflow-hidden border border-ds-gray-400">
                <div
                  className="bg-ds-blue-700/30 flex items-center justify-center text-xs text-ds-blue-400 font-medium border-r border-ds-blue-700/30 font-geist-mono"
                  style={{ width: `${baseLpWeight * 100}%` }}
                >
                  LP {(baseLayerCap * baseLpWeight).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div
                  className="bg-ds-blue-700/15 flex items-center justify-center text-xs text-ds-blue-400 font-medium font-geist-mono"
                  style={{ width: `${baseTradeWeight * 100}%` }}
                >
                  Trade {(baseLayerCap * baseTradeWeight).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            <div className="w-24 text-right">
              <p className="text-sm font-semibold text-ds-gray-1000 font-geist-mono">{baseLayerCap.toLocaleString()}</p>
              <p className="text-xs text-ds-gray-600">Pts/day</p>
            </div>
          </div>

          {/* Season Layer */}
          <div className="flex items-center gap-4">
            <div className="w-32 flex-none">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-ds-purple-700" />
                <span className="text-sm font-medium text-ds-purple-400">Season Layer</span>
              </div>
              <p className="text-xs text-ds-gray-600 mt-0.5">{(seasonRatio * 100).toFixed(0)}% — Dynamic</p>
            </div>
            <div className="flex-1">
              <div className="flex h-10 rounded-lg overflow-hidden border border-ds-gray-400">
                {seasonLpWeight > 0 && (
                  <div
                    className="bg-ds-purple-700/30 flex items-center justify-center text-xs text-ds-purple-400 font-medium border-r border-ds-purple-700/30 font-geist-mono"
                    style={{ width: `${seasonLpWeight * 100}%` }}
                  >
                    LP {(seasonLayerCap * seasonLpWeight).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                )}
                {seasonTradeWeight > 0 && (
                  <div
                    className="bg-ds-purple-700/15 flex items-center justify-center text-xs text-ds-purple-400 font-medium font-geist-mono"
                    style={{ width: `${seasonTradeWeight * 100}%` }}
                  >
                    Trade {(seasonLayerCap * seasonTradeWeight).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                )}
                {seasonLpWeight === 0 && seasonTradeWeight === 0 && (
                  <div className="flex-1 bg-ds-gray-200 flex items-center justify-center text-xs text-ds-gray-600">
                    No weights configured
                  </div>
                )}
              </div>
            </div>
            <div className="w-24 text-right">
              <p className="text-sm font-semibold text-ds-gray-1000 font-geist-mono">{seasonLayerCap.toLocaleString()}</p>
              <p className="text-xs text-ds-gray-600">Pts/day</p>
            </div>
          </div>

          {/* Referral Layer */}
          <div className="flex items-center gap-4">
            <div className="w-32 flex-none">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-ds-yellow-700" />
                <span className="text-sm font-medium text-ds-yellow-400">Referral Layer</span>
              </div>
              <p className="text-xs text-ds-gray-600 mt-0.5">Referral — Extra Minting</p>
            </div>
            <div className="flex-1">
              <div className="flex h-10 rounded-lg overflow-hidden border border-ds-gray-400 border-dashed">
                <div className="flex-1 bg-ds-yellow-700/10 flex items-center justify-center text-xs text-ds-yellow-400 font-medium">
                  Referral Rewards (unlimited, separately minted)
                </div>
              </div>
            </div>
            <div className="w-24 text-right">
              <p className="text-sm font-semibold text-ds-yellow-400 font-geist-mono">+a</p>
              <p className="text-xs text-ds-gray-600">Pts/day</p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t border-ds-gray-400 grid grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">Total LP Pool</p>
            <p className="text-sm font-semibold text-ds-gray-1000 font-geist-mono">{totalLp.toLocaleString(undefined, { maximumFractionDigits: 0 })} Pts</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">Total Trade Pool</p>
            <p className="text-sm font-semibold text-ds-gray-1000 font-geist-mono">{totalTrade.toLocaleString(undefined, { maximumFractionDigits: 0 })} Pts</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">Base Config</p>
            <p className="text-sm font-medium text-ds-blue-400 font-geist-mono">
              LP {(baseLpWeight * 100).toFixed(0)}% / Trade {(baseTradeWeight * 100).toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">Season Config</p>
            <p className="text-sm font-medium text-ds-purple-400 font-geist-mono">
              LP {(seasonLpWeight * 100).toFixed(0)}% / Trade {(seasonTradeWeight * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
