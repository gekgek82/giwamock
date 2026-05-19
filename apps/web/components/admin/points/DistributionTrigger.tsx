"use client";

import { useState } from "react";
import type { DistributionSummary } from "@/types/admin";
import { Button, Card, CardHeader, CardTitle, CardContent, DatePicker } from "@/components/admin/ui";

interface DistributionTriggerProps {
  onTrigger: (date?: string) => Promise<DistributionSummary>;
}

/**
 * Distribution Trigger Component
 *
 * Allows manual triggering of point distribution.
 */
export function DistributionTrigger({ onTrigger }: DistributionTriggerProps) {
  const [isTriggering, setIsTriggering] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [result, setResult] = useState<DistributionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const handleTrigger = async () => {
    setIsTriggering(true);
    setError(null);
    setResult(null);

    try {
      const summary = await onTrigger(selectedDate || undefined);
      setResult(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger distribution");
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Manual Distribution</CardTitle>
          <button
            type="button"
            onClick={() => setShowInfo((prev) => !prev)}
            className="text-ds-gray-600 hover:text-ds-gray-900 transition-colors"
            aria-label="Show info about Manual Distribution"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {showInfo && (
          <div className="mb-4 bg-ds-blue-700/10 border border-ds-blue-700/20 rounded-lg p-4 text-sm text-ds-gray-700 space-y-3">
            <div>
              <p className="text-ds-blue-400 font-semibold mb-1">What is this?</p>
              <p>
                Manually triggers the daily point distribution process. Points are
                calculated per user based on their LP, trading, referral, and
                emission activity, then recorded to their balances.
              </p>
            </div>
            <div>
              <p className="text-ds-blue-400 font-semibold mb-1">When to use</p>
              <p>
                The distribution runs automatically every day at 00:00 UTC. Use
                this only when you need to re-run a missed distribution or
                manually distribute for a specific past date.
              </p>
            </div>
            <div>
              <p className="text-ds-yellow-400 font-semibold mb-1">Caution</p>
              <ul className="list-disc list-inside space-y-1 text-ds-gray-600">
                <li>Running distribution twice for the same date may cause duplicate point entries.</li>
                <li>If no date is selected, today&apos;s date is used by default.</li>
                <li>This operation cannot be undone — verify the date before triggering.</li>
              </ul>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Date Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ds-gray-800">
              Distribution Date (optional, defaults to today)
            </label>
            <DatePicker
              value={selectedDate}
              onChange={setSelectedDate}
              placeholder="Select date (defaults to today)"
            />
          </div>

          {/* Trigger Button */}
          <Button
            variant="primary"
            size="lg"
            loading={isTriggering}
            onClick={handleTrigger}
            className="w-full"
          >
            {!isTriggering && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
            {isTriggering ? "Distributing..." : "Trigger Distribution"}
          </Button>

          {/* Error */}
          {error && (
            <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-3 text-sm text-ds-red-400">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-ds-green-700/10 border border-ds-green-700/20 rounded-lg p-4">
              <p className="text-sm text-ds-green-400 font-medium mb-3">Distribution Complete</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-ds-gray-600 text-[11px] font-medium uppercase tracking-wider">Date</p>
                  <p className="text-ds-gray-1000">{new Date(result.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-ds-gray-600 text-[11px] font-medium uppercase tracking-wider">Total Distributed</p>
                  <p className="text-ds-gray-1000 font-geist-mono">{parseFloat(result.totalDistributed).toLocaleString()} Pts</p>
                </div>
                <div>
                  <p className="text-ds-gray-600 text-[11px] font-medium uppercase tracking-wider">Users</p>
                  <p className="text-ds-gray-1000 font-geist-mono">{result.userCount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-ds-gray-600 text-[11px] font-medium uppercase tracking-wider">Season ID</p>
                  <p className="text-ds-gray-1000 font-geist-mono">#{result.seasonId}</p>
                </div>
              </div>

              {/* Tri-Layer Breakdown */}
              {result.layerBreakdown && (
                <div className="mt-4 pt-4 border-t border-ds-green-700/20">
                  <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-2">Tri-Layer Breakdown</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-ds-blue-700/10 border border-ds-blue-700/20 rounded-lg p-2">
                      <p className="text-xs text-ds-blue-400 font-medium">Base Layer</p>
                      <p className="text-sm text-ds-gray-1000 font-semibold font-geist-mono">
                        {parseFloat(result.layerBreakdown.baseLayerTotal).toLocaleString()} Pts
                      </p>
                      <div className="flex gap-2 text-xs text-ds-gray-600 mt-1">
                        <span>LP: {parseFloat(result.layerBreakdown.baseLayerLp).toLocaleString()}</span>
                        <span>Trade: {parseFloat(result.layerBreakdown.baseLayerTrade).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="bg-ds-purple-700/10 border border-ds-purple-700/20 rounded-lg p-2">
                      <p className="text-xs text-ds-purple-400 font-medium">Season Layer</p>
                      <p className="text-sm text-ds-gray-1000 font-semibold font-geist-mono">
                        {parseFloat(result.layerBreakdown.seasonLayerTotal).toLocaleString()} Pts
                      </p>
                      <div className="flex gap-2 text-xs text-ds-gray-600 mt-1">
                        <span>LP: {parseFloat(result.layerBreakdown.seasonLayerLp).toLocaleString()}</span>
                        <span>Trade: {parseFloat(result.layerBreakdown.seasonLayerTrade).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sector Breakdown */}
              <div className="mt-4 pt-4 border-t border-ds-green-700/20">
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-2">Sector Totals</p>
                <div className="space-y-2">
                  {result.sectorBreakdown.map((sector) => (
                    <div key={sector.sector} className="flex items-center justify-between text-sm">
                      <span className="text-ds-gray-700">{sector.sector}</span>
                      <span className="text-ds-gray-1000 font-geist-mono">
                        {parseFloat(sector.totalPoints).toLocaleString()} Pts ({sector.userCount} users)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
