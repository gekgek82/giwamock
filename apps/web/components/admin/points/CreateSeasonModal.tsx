"use client";

import { useState } from "react";
import type { CreateSeasonRequest, RewardType } from "@/types/admin";
import { ConfirmationModal } from "./ConfirmationModal";
import { Button, DatePicker } from "@/components/admin/ui";

interface CreateSeasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSeasonRequest) => Promise<void>;
}

export function CreateSeasonModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateSeasonModalProps) {
  // Common fields
  const [name, setName] = useState("");
  const [rewardType, setRewardType] = useState<RewardType>("DISTRIBUTION");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // DISTRIBUTION fields
  const [lpPercent, setLpPercent] = useState(60);

  // FIXED fields
  const [fixedAmount, setFixedAmount] = useState("100");
  const [triggerType, setTriggerType] = useState("WALLET_CONNECT");

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const tradePercent = 100 - lpPercent;

  const handleSubmitClick = () => {
    if (!name.trim()) {
      setError("Season name is required");
      return;
    }
    if (rewardType === "DISTRIBUTION" && lpPercent + tradePercent !== 100) {
      setError("LP and SWAP must sum to 100%");
      return;
    }
    setError(null);
    setShowConfirm(true);
  };

  const buildRequest = (): CreateSeasonRequest => {
    const base: CreateSeasonRequest = {
      name: name.trim(),
      rewardType,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      description: description.trim() || undefined,
    };

    if (rewardType === "DISTRIBUTION") {
      return {
        ...base,
        weights: [
          { sector: "LP", weight: lpPercent / 100 },
          { sector: "TRADE", weight: tradePercent / 100 },
        ],
      };
    }

    // FIXED type
    return {
      ...base,
      dailyCap: "0",
      rewardConfig: {
        triggerType,
        fixedAmount,
      },
    };
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setShowConfirm(false);
    try {
      await onSubmit(buildRequest());
      // Reset form
      setName("");
      setDescription("");
      setLpPercent(60);
      setStartDate("");
      setEndDate("");
      setFixedAmount("100");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create season");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-ds-background-200 border border-ds-gray-400 rounded-lg p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-ds-gray-1000">Create Season</h3>
              <p className="text-sm text-ds-gray-700 mt-1">
                Configure a new season for point distribution
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
            {/* Reward Type Toggle */}
            <div>
              <label className="block text-xs font-medium text-ds-gray-800 mb-2">Reward Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setRewardType("FIXED")}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                    rewardType === "FIXED"
                      ? "bg-ds-purple-700/10 border-ds-purple-700/20 text-ds-purple-400"
                      : "bg-ds-gray-200 border-ds-gray-400 text-ds-gray-700 hover:border-ds-gray-500"
                  }`}
                >
                  <div className="font-semibold mb-0.5">Fixed</div>
                  <div className="text-xs opacity-70">Wallet connect, Lock & Vote</div>
                </button>
                <button
                  onClick={() => setRewardType("DISTRIBUTION")}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                    rewardType === "DISTRIBUTION"
                      ? "bg-ds-blue-700/10 border-ds-blue-700/20 text-ds-blue-400"
                      : "bg-ds-gray-200 border-ds-gray-400 text-ds-gray-700 hover:border-ds-gray-500"
                  }`}
                >
                  <div className="font-semibold mb-0.5">Distribution</div>
                  <div className="text-xs opacity-70">30% allocated point split</div>
                </button>
              </div>
            </div>

            {/* Season Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ds-gray-800">Season Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Season 1 — Liquidity"
                className="h-9 w-full rounded-md border border-ds-gray-400 bg-ds-background-100 px-3 text-sm text-ds-gray-900 placeholder:text-ds-gray-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 hover:border-ds-gray-500"
              />
            </div>

            {/* DISTRIBUTION-specific fields */}
            {rewardType === "DISTRIBUTION" && (
              <>
                {/* LP/SWAP Ratio */}
                <div>
                  <label className="block text-xs font-medium text-ds-gray-800 mb-3">
                    Season Layer LP : SWAP Ratio
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={lpPercent}
                    onChange={(e) => setLpPercent(parseInt(e.target.value))}
                    className="w-full h-2 bg-ds-gray-300 rounded-lg appearance-none cursor-pointer accent-ds-purple-400"
                  />
                  <div className="flex justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-ds-purple-400" />
                      <span className="text-sm text-ds-purple-400">LP</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={lpPercent}
                        onChange={(e) => setLpPercent(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
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

                {/* Period */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-ds-gray-800">Start Date</label>
                    <DatePicker
                      value={startDate}
                      onChange={setStartDate}
                      placeholder="Start date"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-ds-gray-800">End Date</label>
                    <DatePicker
                      value={endDate}
                      onChange={setEndDate}
                      placeholder="End date"
                    />
                  </div>
                </div>
              </>
            )}

            {/* FIXED-specific fields */}
            {rewardType === "FIXED" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ds-gray-800">Trigger Type</label>
                  <div className="relative">
                    <select
                      value={triggerType}
                      onChange={(e) => setTriggerType(e.target.value)}
                      className="h-9 w-full rounded-md border border-ds-gray-400 bg-ds-background-100 pl-3 pr-8 text-sm text-ds-gray-900 appearance-none transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 hover:border-ds-gray-500"
                    >
                      <option value="WALLET_CONNECT">Wallet Connect</option>
                      <option value="LOCK_AND_VOTE">Lock & Vote</option>
                    </select>
                    <svg
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ds-gray-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ds-gray-800">Fixed Amount (Points)</label>
                  <input
                    type="text"
                    value={fixedAmount}
                    onChange={(e) => setFixedAmount(e.target.value)}
                    placeholder="e.g., 100"
                    className="h-9 w-full rounded-md border border-ds-gray-400 bg-ds-background-100 px-3 text-sm text-ds-gray-900 placeholder:text-ds-gray-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 hover:border-ds-gray-500"
                  />
                </div>

                {/* Period for FIXED */}
                <div>
                  <label className="block text-xs font-medium text-ds-gray-800 mb-1">Period</label>
                  <p className="text-xs text-ds-gray-600 mb-3">
                    Actions within this period qualify for points
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">Start Date</label>
                      <DatePicker
                        value={startDate}
                        onChange={setStartDate}
                        placeholder="Start date"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">End Date</label>
                      <DatePicker
                        value={endDate}
                        onChange={setEndDate}
                        placeholder="End date"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ds-gray-800">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Season description..."
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
              disabled={!name.trim()}
              className="w-full"
            >
              {isSubmitting ? "Creating..." : "Create Season"}
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
        title="Confirm Season Creation"
        message="Are you sure you want to create this season? This will affect the point distribution structure."
        detail={
          <div className="space-y-1 text-ds-gray-700">
            <div className="flex justify-between">
              <span>Name</span>
              <span className="text-ds-gray-1000 font-medium">{name}</span>
            </div>
            <div className="flex justify-between">
              <span>Type</span>
              <span className={`font-medium ${rewardType === "FIXED" ? "text-ds-purple-400" : "text-ds-blue-400"}`}>
                {rewardType}
              </span>
            </div>
            {rewardType === "DISTRIBUTION" && (
              <div className="flex justify-between">
                <span>LP / SWAP</span>
                <span className="text-ds-gray-1000 font-medium font-geist-mono">{lpPercent}% / {tradePercent}%</span>
              </div>
            )}
            {rewardType === "FIXED" && (
              <div className="flex justify-between">
                <span>Fixed Amount</span>
                <span className="text-ds-gray-1000 font-medium font-geist-mono">{Number(fixedAmount).toLocaleString()} P</span>
              </div>
            )}
            {startDate && (
              <div className="flex justify-between">
                <span>Period</span>
                <span className="text-ds-gray-1000 font-medium">
                  {startDate} ~ {endDate || "TBD"}
                </span>
              </div>
            )}
          </div>
        }
        confirmLabel="Confirm Create"
        isLoading={isSubmitting}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
