"use client";

import { useState, useEffect } from "react";
import type {
  AdminTokenInfo,
  CreateTokenRequest,
  UpdateTokenRequest,
} from "@/types/admin";
import { Button, Input } from "@/components/admin/ui";

interface TokenFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTokenRequest | UpdateTokenRequest) => Promise<void>;
  editingToken: AdminTokenInfo | null;
}

export function TokenFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingToken,
}: TokenFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    address: string;
    symbol: string;
    name: string;
  }>({
    address: "",
    symbol: "",
    name: "",
  });

  const isEditing = editingToken !== null;

  useEffect(() => {
    if (editingToken) {
      setFormData({
        address: editingToken.address,
        symbol: editingToken.symbol,
        name: editingToken.name,
      });
    } else {
      setFormData({
        address: "",
        symbol: "",
        name: "",
      });
    }
    setError(null);
  }, [editingToken, isOpen]);

  const validateAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!isEditing && !validateAddress(formData.address)) {
      setError(
        "Please enter a valid Ethereum address (0x + 40 hex characters)"
      );
      return;
    }

    if (!formData.symbol.trim()) {
      setError("Symbol is required");
      return;
    }

    if (formData.symbol.length > 20) {
      setError("Symbol must be 20 characters or less");
      return;
    }

    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    if (formData.name.length > 100) {
      setError("Name must be 100 characters or less");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing) {
        const updateData: UpdateTokenRequest = {
          symbol: formData.symbol,
          name: formData.name,
        };
        await onSubmit(updateData);
      } else {
        const createData: CreateTokenRequest = {
          address: formData.address.toLowerCase(),
          symbol: formData.symbol,
          name: formData.name,
        };
        await onSubmit(createData);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save token");
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
            <h2 className="text-sm font-semibold text-ds-gray-1000">
              {isEditing ? "Edit Token" : "Add New Token"}
            </h2>
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

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            {error && (
              <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-3 text-sm text-ds-red-400">
                {error}
              </div>
            )}

            {/* Address */}
            <Input
              label={`Contract Address${!isEditing ? " *" : ""}`}
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="0x..."
              disabled={isEditing}
              required={!isEditing}
              className={`font-geist-mono ${isEditing ? "opacity-60" : ""}`}
              hint={isEditing ? "Address cannot be changed" : undefined}
            />

            {/* Symbol */}
            <Input
              label="Symbol *"
              value={formData.symbol}
              onChange={(e) =>
                setFormData({ ...formData, symbol: e.target.value })
              }
              placeholder="e.g., TER"
              maxLength={20}
              required
            />

            {/* Name */}
            <Input
              label="Name *"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., TER Token"
              maxLength={100}
              required
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-ds-gray-400">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : isEditing
                ? "Update Token"
                : "Add Token"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
