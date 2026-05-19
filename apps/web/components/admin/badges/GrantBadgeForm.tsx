"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui";
import type { GrantBadgeRequest, BadgeType } from "@/types/admin";

interface GrantBadgeFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: GrantBadgeRequest) => Promise<void>;
}

const BADGE_TYPES: { value: BadgeType; label: string; description: string }[] = [
  { value: "EARLY_BIRD", label: "Early Bird", description: "Pre-Season participant" },
  { value: "KOL_TIER1", label: "KOL Tier 1", description: "KOL partner (8% referral rate)" },
  { value: "KOL_TIER2", label: "KOL Tier 2", description: "KOL partner (10% referral rate)" },
  { value: "KOL_PARTNER", label: "KOL Partner (Legacy)", description: "Legacy KOL partner badge" },
  { value: "WHALE", label: "Whale", description: "Whale user with special benefits" },
  { value: "OG", label: "OG", description: "Original member with special benefits" },
  { value: "PARTNER", label: "Partner", description: "Partnership badge with custom boost" },
  { value: "GENESIS_DIAMOND", label: "Genesis Diamond", description: "Season top 1% (+15% boost)" },
  { value: "GENESIS_PLATINUM", label: "Genesis Platinum", description: "Season top 5% (+10% boost)" },
  { value: "GENESIS_GOLD", label: "Genesis Gold", description: "Season top 15% (+7% boost)" },
  { value: "GENESIS_SILVER", label: "Genesis Silver", description: "Season top 40% (+4% boost)" },
  { value: "GENESIS_BRONZE", label: "Genesis Bronze", description: "Season top 100% (+2% boost)" },
];

/**
 * Grant Badge Form Modal
 */
export function GrantBadgeForm({ isOpen, onClose, onSubmit }: GrantBadgeFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    userAddress: "",
    badgeType: "EARLY_BIRD" as BadgeType,
    expiresAt: "",
    boostPercent: "",
    referralRate: "",
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
      // Build metadata based on badge type
      const metadata: Record<string, unknown> = {};
      if (formData.boostPercent) {
        metadata.boostPercent = parseFloat(formData.boostPercent);
      }
      if (formData.referralRate) {
        metadata.rate = parseFloat(formData.referralRate);
      }

      await onSubmit({
        userAddress: formData.userAddress,
        badgeType: formData.badgeType,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined,
      });

      // Reset form
      setFormData({
        userAddress: "",
        badgeType: "EARLY_BIRD",
        expiresAt: "",
        boostPercent: "",
        referralRate: "",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grant badge");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBadge = BADGE_TYPES.find((b) => b.value === formData.badgeType);

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
            <h2 className="text-sm font-semibold text-ds-gray-1000">Grant Badge</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-ds-gray-700 hover:text-ds-gray-1000 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            {error && (
              <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-3 text-sm text-ds-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ds-gray-800">Wallet Address</label>
              <input
                type="text"
                value={formData.userAddress}
                onChange={(e) => setFormData({ ...formData, userAddress: e.target.value })}
                placeholder="0x..."
                className="h-9 w-full px-3 bg-ds-background-100 border border-ds-gray-400 rounded-md text-sm text-ds-gray-900 placeholder:text-ds-gray-600 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 font-geist-mono"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ds-gray-800">Badge Type</label>
              <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {BADGE_TYPES.map((badge) => (
                  <button
                    key={badge.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, badgeType: badge.value })}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      formData.badgeType === badge.value
                        ? "border-ds-gray-1000 bg-ds-gray-200"
                        : "border-ds-gray-400 bg-ds-background-100 hover:border-ds-gray-500"
                    }`}
                  >
                    <p className="text-sm font-medium text-ds-gray-1000">{badge.label}</p>
                    <p className="text-xs text-ds-gray-700 mt-1">{badge.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Boost percent for badges with TGE boost */}
            {["GENESIS_DIAMOND", "GENESIS_PLATINUM", "GENESIS_GOLD", "GENESIS_SILVER", "GENESIS_BRONZE", "PARTNER"].includes(formData.badgeType) && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ds-gray-800">Boost Percent (%)</label>
                <input
                  type="number"
                  value={formData.boostPercent}
                  onChange={(e) => setFormData({ ...formData, boostPercent: e.target.value })}
                  placeholder="15 (for +15% TGE boost)"
                  step="0.01"
                  className="h-9 w-full px-3 bg-ds-background-100 border border-ds-gray-400 rounded-md text-sm text-ds-gray-900 placeholder:text-ds-gray-600 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 font-geist-mono"
                />
              </div>
            )}

            {/* Referral rate for KOL badges */}
            {["KOL_TIER1", "KOL_TIER2", "KOL_PARTNER"].includes(formData.badgeType) && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ds-gray-800">Referral Rate</label>
                <input
                  type="number"
                  value={formData.referralRate}
                  onChange={(e) => setFormData({ ...formData, referralRate: e.target.value })}
                  placeholder="0.10 (for 10%)"
                  step="0.01"
                  min="0"
                  max="1"
                  className="h-9 w-full px-3 bg-ds-background-100 border border-ds-gray-400 rounded-md text-sm text-ds-gray-900 placeholder:text-ds-gray-600 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 font-geist-mono"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ds-gray-800">Expiration (Optional)</label>
              <input
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                className="h-9 w-full px-3 bg-ds-background-100 border border-ds-gray-400 rounded-md text-sm text-ds-gray-900 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700"
              />
              <p className="text-xs text-ds-gray-600">Leave empty for no expiration</p>
            </div>

            {selectedBadge && (
              <div className="bg-ds-gray-100 rounded-lg p-4 border border-ds-gray-400">
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">Badge Info</p>
                <p className="text-sm text-ds-gray-1000 mt-1">{selectedBadge.description}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-ds-gray-400">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={isSubmitting}
            >
              {isSubmitting ? "Granting..." : "Grant Badge"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
