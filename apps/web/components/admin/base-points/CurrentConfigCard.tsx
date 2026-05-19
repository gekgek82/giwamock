"use client";

import type { BasePointConfig } from "@/types/admin";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
} from "@/components/admin/ui";

const DAILY_BASE_CAP = 700_000;

interface CurrentConfigCardProps {
  config: BasePointConfig | null;
  isLoading: boolean;
}

export function CurrentConfigCard({
  config,
  isLoading,
}: CurrentConfigCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <div className="h-6 w-48 bg-ds-gray-300 rounded animate-pulse mb-6" />
          <div className="space-y-4">
            <div className="h-10 bg-ds-gray-300 rounded animate-pulse" />
            <div className="h-6 bg-ds-gray-300 rounded animate-pulse" />
            <div className="h-20 bg-ds-gray-300 rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-ds-gray-700">No active configuration found</p>
            <p className="text-sm text-ds-gray-600 mt-1">
              Create a new config to start managing base point ratios
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const lpPercent = parseFloat(config.lpWeight) * 100;
  const tradePercent = parseFloat(config.tradeWeight) * 100;
  const lpPoints = Math.round(DAILY_BASE_CAP * parseFloat(config.lpWeight));
  const tradePoints = Math.round(
    DAILY_BASE_CAP * parseFloat(config.tradeWeight)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Current Configuration</CardTitle>
        <Badge variant="success">ACTIVE</Badge>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Ratio Display */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-ds-blue-700/10 border border-ds-blue-700/20 rounded-lg p-4">
            <p className="text-xs text-ds-blue-400 mb-1">LP (Liquidity)</p>
            <p className="text-2xl font-semibold text-ds-gray-1000 font-geist-mono">{lpPercent.toFixed(1)}%</p>
            <p className="text-sm text-ds-gray-700 mt-1 font-geist-mono">
              {lpPoints.toLocaleString()} P/day
            </p>
          </div>
          <div className="bg-ds-yellow-700/10 border border-ds-yellow-700/20 rounded-lg p-4">
            <p className="text-xs text-ds-yellow-400 mb-1">SWAP (Trading)</p>
            <p className="text-2xl font-semibold text-ds-gray-1000 font-geist-mono">
              {tradePercent.toFixed(1)}%
            </p>
            <p className="text-sm text-ds-gray-700 mt-1 font-geist-mono">
              {tradePoints.toLocaleString()} P/day
            </p>
          </div>
        </div>

        {/* Visual Ratio Bar */}
        <div>
          <div className="flex h-3 rounded-full overflow-hidden">
            <div
              className="bg-ds-blue-700 transition-all duration-300"
              style={{ width: `${lpPercent}%` }}
            />
            <div
              className="bg-ds-yellow-400 transition-all duration-300"
              style={{ width: `${tradePercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-ds-blue-400 font-geist-mono">LP {lpPercent.toFixed(1)}%</span>
            <span className="text-xs text-ds-yellow-400 font-geist-mono">
              SWAP {tradePercent.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Meta Info */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ds-gray-600">Daily Base Cap</span>
            <span className="text-ds-gray-1000 font-geist-mono">
              {DAILY_BASE_CAP.toLocaleString()} P
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ds-gray-600">Active Since</span>
            <span className="text-ds-gray-1000">
              {new Date(config.createdAt).toLocaleDateString()}
            </span>
          </div>
          {config.createdBy && (
            <div className="flex justify-between">
              <span className="text-ds-gray-600">Created By</span>
              <span className="text-ds-gray-1000">{config.createdBy}</span>
            </div>
          )}
          {config.memo && (
            <div className="flex justify-between">
              <span className="text-ds-gray-600">Memo</span>
              <span className="text-ds-gray-700">{config.memo}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
