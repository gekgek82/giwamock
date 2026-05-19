"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui";
import type { BadgeDefinition } from "@/types/admin";

interface AssignCustomBadgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    badgeDefinitionId: number;
    addresses: string[];
    expiresAt?: string;
  }) => Promise<void>;
  badge: BadgeDefinition | null;
}

export function AssignCustomBadgeModal({
  isOpen,
  onClose,
  onSubmit,
  badge,
}: AssignCustomBadgeModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressText, setAddressText] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const parseAddresses = (text: string): string[] => {
    return text
      .split(/[\n,;]+/)
      .map((addr) => addr.trim().toLowerCase())
      .filter((addr) => /^0x[a-f0-9]{40}$/i.test(addr));
  };

  const parsedAddresses = parseAddresses(addressText);
  const rawLines = addressText
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const invalidCount = rawLines.length - parsedAddresses.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!badge) return;

    if (parsedAddresses.length === 0) {
      setError("Please enter at least one valid wallet address");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        badgeDefinitionId: badge.id,
        addresses: parsedAddresses,
        expiresAt: expiresAt
          ? new Date(expiresAt).toISOString()
          : undefined,
      });
      setAddressText("");
      setExpiresAt("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign badges");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !badge) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-ds-background-200 rounded-lg border border-ds-gray-400 w-full max-w-lg mx-4">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-ds-gray-400">
            <div>
              <h2 className="text-sm font-semibold text-ds-gray-1000">
                Assign Badge
              </h2>
              <p className="text-sm text-ds-gray-700 mt-1">
                {badge.name} (+{badge.boostPercent}% boost)
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-ds-gray-700 hover:text-ds-gray-1000 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="px-6 py-4 space-y-4">
            {error && (
              <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-3 text-sm text-ds-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ds-gray-800">
                Wallet Addresses (one per line)
              </label>
              <textarea
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                placeholder={"0x1234...abcd\n0x5678...efgh\n0x9abc...ijkl"}
                rows={8}
                className="w-full px-3 py-2 bg-ds-background-100 border border-ds-gray-400 rounded-md text-sm text-ds-gray-900 placeholder:text-ds-gray-600 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 font-geist-mono resize-none"
                required
              />
              <div className="flex items-center gap-3 text-xs">
                <span className="text-ds-green-400">
                  {parsedAddresses.length} valid
                </span>
                {invalidCount > 0 && (
                  <span className="text-ds-red-400">
                    {invalidCount} invalid
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ds-gray-800">
                Expiration (Optional)
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="h-9 w-full px-3 bg-ds-background-100 border border-ds-gray-400 rounded-md text-sm text-ds-gray-900 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700"
              />
              <p className="text-xs text-ds-gray-600">
                Leave empty for no expiration
              </p>
            </div>
          </div>

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
              disabled={parsedAddresses.length === 0}
              loading={isSubmitting}
            >
              {isSubmitting
                ? "Assigning..."
                : `Assign to ${parsedAddresses.length} address(es)`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
