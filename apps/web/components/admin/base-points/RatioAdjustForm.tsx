"use client";

import { useState } from "react";
import type { UpdateBasePointConfigRequest } from "@/types/admin";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
} from "@/components/admin/ui";

const DAILY_BASE_CAP = 700_000;

interface RatioAdjustFormProps {
  onSubmit: (data: UpdateBasePointConfigRequest) => Promise<void>;
}

export function RatioAdjustForm({ onSubmit }: RatioAdjustFormProps) {
  const [lpPercent, setLpPercent] = useState(70);
  const [createdBy, setCreatedBy] = useState("");
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tradePercent = 100 - lpPercent;
  const lpPoints = Math.round(DAILY_BASE_CAP * (lpPercent / 100));
  const tradePoints = Math.round(DAILY_BASE_CAP * (tradePercent / 100));

  const handleSliderChange = (value: number) => {
    setLpPercent(Math.max(0, Math.min(100, value)));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        lpWeight: lpPercent / 100,
        tradeWeight: tradePercent / 100,
        createdBy: createdBy || undefined,
        memo: memo || undefined,
      });
      // Reset form
      setMemo("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update config"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Ratio</CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* LP/TRADE Ratio Slider */}
        <div>
          <label className="block text-xs font-medium text-ds-gray-800 mb-3">
            LP : SWAP Ratio
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={lpPercent}
            onChange={(e) => handleSliderChange(parseInt(e.target.value))}
            className="w-full h-2 bg-ds-gray-300 rounded-lg appearance-none cursor-pointer accent-ds-blue-700"
          />
          <div className="flex justify-between mt-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ds-blue-700" />
              <span className="text-sm text-ds-blue-400">LP</span>
              <input
                type="number"
                min="0"
                max="100"
                value={lpPercent}
                onChange={(e) =>
                  handleSliderChange(parseInt(e.target.value) || 0)
                }
                className="w-16 h-7 px-2 text-sm bg-ds-background-100 border border-ds-gray-400 rounded-md text-ds-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700"
              />
              <span className="text-sm text-ds-gray-600">%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ds-yellow-400" />
              <span className="text-sm text-ds-yellow-400">SWAP</span>
              <span className="text-sm font-medium text-ds-gray-1000 font-geist-mono">
                {tradePercent}%
              </span>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-ds-gray-200 border border-ds-gray-400 rounded-lg p-4">
          <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-2">
            Preview (based on {DAILY_BASE_CAP.toLocaleString()}P daily base cap)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-ds-blue-400">LP Points/day</p>
              <p className="text-lg font-semibold text-ds-gray-1000 font-geist-mono">
                {lpPoints.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-ds-yellow-400">SWAP Points/day</p>
              <p className="text-lg font-semibold text-ds-gray-1000 font-geist-mono">
                {tradePoints.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Changed By */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ds-gray-800">
            Changed By (optional)
          </label>
          <input
            type="text"
            value={createdBy}
            onChange={(e) => setCreatedBy(e.target.value)}
            placeholder="e.g., admin@giwater.io"
            className="h-9 w-full rounded-md border border-ds-gray-400 bg-ds-background-100 px-3 text-sm text-ds-gray-900 placeholder:text-ds-gray-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 hover:border-ds-gray-500"
          />
        </div>

        {/* Memo */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ds-gray-800">
            Memo (optional)
          </label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Reason for this change..."
            rows={2}
            className="w-full rounded-md border border-ds-gray-400 bg-ds-background-100 px-3 py-2 text-sm text-ds-gray-900 placeholder:text-ds-gray-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 hover:border-ds-gray-500 resize-none"
          />
        </div>

        {/* Submit */}
        <Button
          variant="primary"
          size="lg"
          loading={isSubmitting}
          onClick={handleSubmit}
          className="w-full"
        >
          {isSubmitting ? "Updating..." : "Update Config"}
        </Button>

        {/* Error */}
        {error && (
          <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-3 text-sm text-ds-red-400">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
