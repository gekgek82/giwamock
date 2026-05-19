"use client";

import { useState } from "react";
import type { SeasonConfig, SeasonStatus } from "@/types/admin";
import {
  Button,
  Card,
  CardContent,
  Badge,
} from "@/components/admin/ui";

interface SeasonListProps {
  seasons: SeasonConfig[];
  isLoading: boolean;
  onStatusChange: (id: number, status: SeasonStatus) => void;
}

/**
 * Season List Table with Tri-Layer Model details
 */
export function SeasonList({
  seasons,
  isLoading,
  onStatusChange,
}: SeasonListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const getStatusBadge = (status: SeasonStatus) => {
    const variants: Record<SeasonStatus, "success" | "warning" | "default"> = {
      active: "success",
      pending: "warning",
      completed: "default",
    };
    return (
      <Badge variant={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getRewardTypeBadge = (rewardType: string) => {
    const isFixed = rewardType === "FIXED";
    return (
      <Badge variant={isFixed ? "purple" : "blue"}>
        {rewardType}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-4 py-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-ds-gray-300 rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (seasons.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-ds-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-base font-semibold text-ds-gray-1000 mb-2">No Seasons</h3>
          <p className="text-sm text-ds-gray-700">Create a new season to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ds-gray-100">
              <th className="text-left px-6 py-3 text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                Season
              </th>
              <th className="text-left px-6 py-3 text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                Phase
              </th>
              <th className="text-left px-6 py-3 text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                Reward Type
              </th>
              <th className="text-left px-6 py-3 text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                Cap / Amount
              </th>
              <th className="text-left px-6 py-3 text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                Tri-Layer Split
              </th>
              <th className="text-left px-6 py-3 text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-6 py-3 text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ds-gray-400">
            {seasons.map((season) => {
              const fixedAmount =
                season.rewardType === "FIXED" && season.rewardConfig
                  ? (season.rewardConfig as Record<string, unknown>).fixedAmount
                  : null;

              const dailyCap = Number(season.dailyCap);
              const baseRatio = parseFloat(season.baseLayerRatio || "0.7");
              const seasonRatio = 1 - baseRatio;
              const baseLayerCap = dailyCap * baseRatio;
              const seasonLayerCap = dailyCap * seasonRatio;

              const isExpanded = expandedId === season.id;
              const isDistribution = season.rewardType === "DISTRIBUTION";

              // Find LP/TRADE weights from season weights
              const lpWeight = season.weights?.find((w) => w.sector === "LP");
              const tradeWeight = season.weights?.find((w) => w.sector === "TRADE");

              return (
                <tr key={season.id} className="group">
                  <td colSpan={7} className="p-0">
                    {/* Main Row */}
                    <div
                      className={`flex items-center hover:bg-ds-gray-100 transition-colors duration-100 ${isDistribution ? "cursor-pointer" : ""}`}
                      onClick={() => isDistribution && setExpandedId(isExpanded ? null : season.id)}
                    >
                      <div className="flex-none w-[200px] px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isDistribution && (
                            <svg
                              className={`w-4 h-4 text-ds-gray-600 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                          <div>
                            <p className="text-sm font-medium text-ds-gray-1000">{season.name}</p>
                            <p className="text-xs text-ds-gray-600 font-geist-mono">#{season.seasonNumber}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex-none w-[80px] px-6 py-4">
                        <span className="text-sm text-ds-gray-900">{season.phase}</span>
                      </div>
                      <div className="flex-none w-[120px] px-6 py-4">
                        {getRewardTypeBadge(season.rewardType)}
                      </div>
                      <div className="flex-none w-[160px] px-6 py-4">
                        <span className="text-sm text-ds-gray-1000 font-geist-mono">
                          {isDistribution
                            ? `${dailyCap.toLocaleString()} Pts/day`
                            : fixedAmount
                              ? `${Number(fixedAmount).toLocaleString()} Pts`
                              : "-"}
                        </span>
                      </div>
                      <div className="flex-none w-[200px] px-6 py-4">
                        {isDistribution ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-ds-gray-300 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-ds-blue-700 rounded-full"
                                  style={{ width: `${baseRatio * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-ds-gray-700 w-20 text-right font-geist-mono">
                                B:{(baseRatio * 100).toFixed(0)}% S:{(seasonRatio * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-ds-gray-600">-</span>
                        )}
                      </div>
                      <div className="flex-none w-[100px] px-6 py-4">
                        {getStatusBadge(season.status)}
                      </div>
                      <div className="flex-1 px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {season.status !== "active" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onStatusChange(season.id, "active")}
                              className="text-ds-green-400 hover:text-ds-green-400"
                            >
                              Activate
                            </Button>
                          )}
                          {season.status === "active" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onStatusChange(season.id, "completed")}
                              className="text-ds-yellow-400 hover:text-ds-yellow-400"
                            >
                              Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Tri-Layer Detail */}
                    {isExpanded && isDistribution && (
                      <div className="px-6 pb-4 bg-ds-gray-100 border-t border-ds-gray-400">
                        <div className="grid grid-cols-3 gap-4 pt-4">
                          {/* Base Layer */}
                          <div className="bg-ds-blue-700/5 border border-ds-blue-700/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-2 rounded-full bg-ds-blue-700" />
                              <h4 className="text-sm font-medium text-ds-blue-400">Base Layer</h4>
                              <span className="text-xs text-ds-gray-600">({(baseRatio * 100).toFixed(0)}%)</span>
                            </div>
                            <p className="text-lg font-semibold text-ds-gray-1000 mb-2 font-geist-mono">
                              {baseLayerCap.toLocaleString()} <span className="text-sm text-ds-gray-700">Pts/day</span>
                            </p>
                            <p className="text-xs text-ds-gray-600 mb-1">
                              LP/Trade ratio managed by Base Point Config
                            </p>
                            <p className="text-xs text-ds-gray-700">
                              Always-on, fixed allocation
                            </p>
                          </div>

                          {/* Season Layer */}
                          <div className="bg-ds-purple-700/5 border border-ds-purple-700/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-2 rounded-full bg-ds-purple-700" />
                              <h4 className="text-sm font-medium text-ds-purple-400">Season Layer</h4>
                              <span className="text-xs text-ds-gray-600">({(seasonRatio * 100).toFixed(0)}%)</span>
                            </div>
                            <p className="text-lg font-semibold text-ds-gray-1000 mb-2 font-geist-mono">
                              {seasonLayerCap.toLocaleString()} <span className="text-sm text-ds-gray-700">Pts/day</span>
                            </p>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between text-ds-gray-700">
                                <span>LP</span>
                                <span className="text-ds-gray-1000 font-geist-mono">{lpWeight ? `${(parseFloat(lpWeight.weight) * 100).toFixed(0)}%` : "0%"}</span>
                              </div>
                              <div className="flex justify-between text-ds-gray-700">
                                <span>Trade</span>
                                <span className="text-ds-gray-1000 font-geist-mono">{tradeWeight ? `${(parseFloat(tradeWeight.weight) * 100).toFixed(0)}%` : "0%"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Referral Layer */}
                          <div className="bg-ds-yellow-700/5 border border-ds-yellow-700/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-2 rounded-full bg-ds-yellow-700" />
                              <h4 className="text-sm font-medium text-ds-yellow-400">Referral Layer</h4>
                              <span className="text-xs text-ds-gray-600">(+a)</span>
                            </div>
                            <p className="text-lg font-semibold text-ds-gray-1000 mb-2">
                              Extra <span className="text-sm text-ds-gray-700">Minting</span>
                            </p>
                            <p className="text-xs text-ds-gray-700">
                              Referral rewards, separately minted
                            </p>
                          </div>
                        </div>

                        {/* Combined allocation summary */}
                        <div className="mt-4 bg-ds-gray-200 rounded-lg p-3">
                          <h5 className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-2">Combined Daily Allocation</h5>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex justify-between">
                              <span className="text-ds-gray-700">Total LP Pool</span>
                              <span className="text-ds-gray-1000 font-medium font-geist-mono">
                                {lpWeight
                                  ? (baseLayerCap * 0.7 + seasonLayerCap * parseFloat(lpWeight.weight)).toLocaleString(undefined, { maximumFractionDigits: 0 })
                                  : baseLayerCap.toLocaleString(undefined, { maximumFractionDigits: 0 })} Pts
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-ds-gray-700">Total Trade Pool</span>
                              <span className="text-ds-gray-1000 font-medium font-geist-mono">
                                {tradeWeight
                                  ? (baseLayerCap * 0.3 + seasonLayerCap * parseFloat(tradeWeight.weight)).toLocaleString(undefined, { maximumFractionDigits: 0 })
                                  : (baseLayerCap * 0.3).toLocaleString(undefined, { maximumFractionDigits: 0 })} Pts
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
