"use client";

import { useState } from "react";
import type { AddBlacklistRequest, BlacklistReason } from "@/types/admin";
import { Button, Input, Select } from "@/components/admin/ui";

interface AddBlacklistFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AddBlacklistRequest) => Promise<void>;
  currentSeasonId: number;
}

const REASONS: { value: BlacklistReason; label: string }[] = [
  { value: "FLASH_LOAN_ABUSE", label: "Flash Loan Abuse (24h in/out)" },
  { value: "SYBIL_ATTACK", label: "Sybil Attack (Multiple accounts)" },
  { value: "SELF_REFERRAL", label: "Self Referral" },
  { value: "WASH_TRADING", label: "Wash Trading" },
  { value: "MANUAL_BAN", label: "Manual Ban" },
];

/**
 * Add to Blacklist Form Modal
 */
export function AddBlacklistForm({
  isOpen,
  onClose,
  onSubmit,
  currentSeasonId,
}: AddBlacklistFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<AddBlacklistRequest>({
    userAddress: "",
    seasonId: currentSeasonId,
    reason: "MANUAL_BAN",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.userAddress || !formData.userAddress.startsWith("0x")) {
      setError("Please enter a valid wallet address");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      // Reset form
      setFormData({
        userAddress: "",
        seasonId: currentSeasonId,
        reason: "MANUAL_BAN",
        description: "",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to blacklist");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-ds-background-200 rounded-lg border border-ds-gray-400 w-full max-w-lg mx-4">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-ds-gray-400">
            <h2 className="text-sm font-semibold text-ds-gray-1000">Add to Blacklist</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-ds-gray-600 hover:text-ds-gray-1000 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            {error && (
              <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-3 text-xs text-ds-red-400">
                {error}
              </div>
            )}

            <div className="bg-ds-yellow-700/10 border border-ds-yellow-700/20 rounded-lg p-3 text-xs text-ds-yellow-400">
              Blacklisting a user will forfeit all their points for the selected season.
            </div>

            <Input
              label="Wallet Address"
              type="text"
              value={formData.userAddress}
              onChange={(e) => setFormData({ ...formData, userAddress: e.target.value })}
              placeholder="0x..."
              className="font-geist-mono"
              required
            />

            <Input
              label="Season"
              type="number"
              value={formData.seasonId}
              onChange={(e) => setFormData({ ...formData, seasonId: parseInt(e.target.value) })}
              required
            />

            <Select
              label="Reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value as BlacklistReason })}
              options={REASONS.map((r) => ({ value: r.value, label: r.label }))}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ds-gray-800">
                Description (Optional)
              </label>
              <textarea
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details about the ban..."
                rows={3}
                className="w-full rounded-md border border-ds-gray-400 hover:border-ds-gray-500 bg-ds-background-100 px-3 py-2 text-sm text-ds-gray-900 placeholder:text-ds-gray-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-ds-gray-400">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="md"
              loading={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add to Blacklist"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
