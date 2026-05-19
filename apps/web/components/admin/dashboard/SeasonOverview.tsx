"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
} from "@/components/admin/ui";
import type { SeasonConfig } from "@/types/admin";

interface SeasonOverviewProps {
  season: SeasonConfig | null;
  isLoading: boolean;
}

export function SeasonOverview({ season, isLoading }: SeasonOverviewProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-4 bg-ds-gray-300 rounded w-1/3 animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-3.5 bg-ds-gray-300 rounded w-full animate-pulse" />
            <div className="h-16 bg-ds-gray-300 rounded w-full animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!season) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-ds-gray-600">
            <svg
              className="w-10 h-10 mx-auto mb-3 text-ds-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm">No active season</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isDistribution = season.rewardType === "DISTRIBUTION";
  const fixedAmount =
    !isDistribution && season.rewardConfig
      ? (season.rewardConfig as Record<string, unknown>).fixedAmount
      : null;

  const statusVariant =
    season.status === "active"
      ? "success"
      : season.status === "pending"
        ? "warning"
        : "default";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{season.name}</CardTitle>
            <p className="text-xs text-ds-gray-600 mt-0.5">
              Phase {season.phase}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isDistribution ? "blue" : "purple"}>
              {season.rewardType}
            </Badge>
            <Badge variant={statusVariant as "success" | "warning" | "default"}>
              {season.status.toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Active Since */}
        {season.activatedAt && (
          <div className="mb-5 px-3 py-2.5 bg-ds-green-700/5 border border-ds-green-700/10 rounded-md">
            <p className="text-[11px] text-ds-gray-600 mb-0.5">Active since</p>
            <p className="text-sm text-ds-green-400 font-medium font-geist-mono">
              {new Date(season.activatedAt).toLocaleString()}
            </p>
          </div>
        )}

        {/* Description */}
        {season.description && (
          <p className="text-sm text-ds-gray-700 mb-5">{season.description}</p>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-ds-gray-100 rounded-md px-4 py-3 border border-ds-gray-400">
            <p className="text-[11px] text-ds-gray-600 mb-1">
              {isDistribution ? "Daily Cap" : "Fixed Reward"}
            </p>
            <p className="text-base font-semibold text-ds-gray-1000">
              {isDistribution
                ? `${Number(season.dailyCap).toLocaleString()} Pts`
                : fixedAmount
                  ? `${Number(fixedAmount).toLocaleString()} Pts`
                  : "-"}
            </p>
          </div>
          <div className="bg-ds-gray-100 rounded-md px-4 py-3 border border-ds-gray-400">
            <p className="text-[11px] text-ds-gray-600 mb-1">Season Number</p>
            <p className="text-base font-semibold text-ds-gray-1000">
              #{season.seasonNumber}
            </p>
          </div>
        </div>

        {/* Tri-Layer Model (DISTRIBUTION only) */}
        {isDistribution &&
          (() => {
            const dailyCap = Number(season.dailyCap);
            const baseRatio = parseFloat(season.baseLayerRatio || "0.7");
            const seasonRatio = 1 - baseRatio;
            const baseLayerCap = dailyCap * baseRatio;
            const seasonLayerCap = dailyCap * seasonRatio;
            const lpWeight = season.weights?.find(
              (w: { sector: string; weight: string }) => w.sector === "LP",
            );
            const tradeWeight = season.weights?.find(
              (w: { sector: string; weight: string }) => w.sector === "TRADE",
            );

            return (
              <div className="mt-5">
                <p className="text-xs text-ds-gray-600 mb-2.5 font-medium">
                  Tri-Layer Allocation
                </p>
                <div className="space-y-2">
                  {/* Base Layer */}
                  <div className="flex items-center gap-3 bg-ds-blue-700/5 border border-ds-blue-700/10 rounded-md px-3 py-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-ds-blue-700 shrink-0" />
                    <div className="flex-1">
                      <span className="text-xs text-ds-blue-400">
                        Base Layer ({(baseRatio * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-ds-gray-1000 font-geist-mono">
                      {baseLayerCap.toLocaleString()} Pts
                    </span>
                  </div>
                  {/* Season Layer */}
                  <div className="flex items-center gap-3 bg-ds-purple-700/5 border border-ds-purple-700/10 rounded-md px-3 py-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-ds-purple-700 shrink-0" />
                    <div className="flex-1">
                      <span className="text-xs text-ds-purple-400">
                        Season Layer ({(seasonRatio * 100).toFixed(0)}%)
                      </span>
                      {lpWeight && tradeWeight && (
                        <span className="text-xs text-ds-gray-600 ml-2">
                          LP{" "}
                          {(parseFloat(lpWeight.weight) * 100).toFixed(0)}% /
                          Trade{" "}
                          {(parseFloat(tradeWeight.weight) * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-ds-gray-1000 font-geist-mono">
                      {seasonLayerCap.toLocaleString()} Pts
                    </span>
                  </div>
                  {/* Bonus */}
                  <div className="flex items-center gap-3 bg-ds-yellow-700/5 border border-ds-yellow-700/10 rounded-md px-3 py-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-ds-yellow-700 shrink-0" />
                    <div className="flex-1">
                      <span className="text-xs text-ds-yellow-400">
                        Bonus Yield (Referral)
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-ds-yellow-400">
                      +a
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
      </CardContent>
    </Card>
  );
}
