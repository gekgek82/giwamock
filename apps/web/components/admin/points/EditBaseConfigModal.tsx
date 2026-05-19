"use client";

import { useState, useEffect } from "react";
import type { UpdateBasePointConfigRequest, BasePointConfig } from "@/types/admin";
import { ConfirmationModal } from "./ConfirmationModal";
import { Button } from "@/components/admin/ui";

const DAILY_BASE_CAP = 700_000;

interface EditBaseConfigModalProps {
  isOpen: boolean;
  currentConfig: BasePointConfig | null;
  onClose: () => void;
  onSubmit: (data: UpdateBasePointConfigRequest) => Promise<void>;
}

export function EditBaseConfigModal({
  isOpen,
  currentConfig,
  onClose,
  onSubmit,
}: EditBaseConfigModalProps) {
  const [lpPercent, setLpPercent] = useState(70);
  const [createdBy, setCreatedBy] = useState("");
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Pre-fill with current config values when modal opens
  useEffect(() => {
    if (isOpen && currentConfig) {
      setLpPercent(Math.round(parseFloat(currentConfig.lpWeight) * 100));
      setCreatedBy("");
      setMemo("");
      setError(null);
    }
  }, [isOpen, currentConfig]);

  const tradePercent = 100 - lpPercent;
  const lpPoints = Math.round(DAILY_BASE_CAP * (lpPercent / 100));
  const tradePoints = Math.round(DAILY_BASE_CAP * (tradePercent / 100));

  const handleSliderChange = (value: number) => {
    setLpPercent(Math.max(0, Math.min(100, value)));
  };

  const hasChanged = currentConfig
    ? Math.round(parseFloat(currentConfig.lpWeight) * 100) !== lpPercent
    : true;

  const handleSubmitClick = () => {
    if (!hasChanged) {
      setError("No changes detected");
      return;
    }
    setError(null);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setShowConfirm(false);
    try {
      await onSubmit({
        lpWeight: lpPercent / 100,
        tradeWeight: tradePercent / 100,
        createdBy: createdBy || undefined,
        memo: memo || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update config");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="relative bg-ds-background-200 border border-ds-gray-400 rounded-lg p-6 w-full max-w-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-ds-gray-1000">
                Edit Base Point Config
              </h3>
              <p className="text-sm text-ds-gray-700 mt-1">
                Update LP/SWAP ratio — changes take effect immediately
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-ds-gray-600 hover:text-ds-gray-900 hover:bg-ds-gray-200 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-5">
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
                    onChange={(e) => handleSliderChange(parseInt(e.target.value) || 0)}
                    className="w-16 h-7 px-2 text-sm bg-ds-background-100 border border-ds-gray-400 rounded-md text-ds-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700"
                  />
                  <span className="text-sm text-ds-gray-600">%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-ds-yellow-400" />
                  <span className="text-sm text-ds-yellow-400">SWAP</span>
                  <span className="text-sm font-medium text-ds-gray-1000 font-geist-mono">{tradePercent}%</span>
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
                  <p className="text-lg font-semibold text-ds-gray-1000 font-geist-mono">{lpPoints.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-ds-yellow-400">SWAP Points/day</p>
                  <p className="text-lg font-semibold text-ds-gray-1000 font-geist-mono">{tradePoints.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Created By */}
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
              onClick={handleSubmitClick}
              disabled={!hasChanged}
              className="w-full"
            >
              {isSubmitting ? "Updating..." : "Update Config"}
            </Button>

            {error && (
              <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-3 text-sm text-ds-red-400">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation */}
      <ConfirmationModal
        isOpen={showConfirm}
        title="Confirm Ratio Change"
        message="Are you sure you want to update the base point ratio? This change takes effect immediately and will affect the next daily point distribution."
        detail={
          <div className="space-y-1 text-ds-gray-700">
            <div className="flex justify-between">
              <span>LP Ratio</span>
              <span className="text-ds-blue-400 font-medium font-geist-mono">{lpPercent}%</span>
            </div>
            <div className="flex justify-between">
              <span>SWAP Ratio</span>
              <span className="text-ds-yellow-400 font-medium font-geist-mono">{tradePercent}%</span>
            </div>
          </div>
        }
        confirmLabel="Confirm Update"
        isLoading={isSubmitting}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
