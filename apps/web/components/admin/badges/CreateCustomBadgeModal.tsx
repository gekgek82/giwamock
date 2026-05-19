"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/admin/ui";

interface CreateCustomBadgeData {
  name: string;
  boostPercent: number;
  addresses: string[];
  imageFile: File | null;
}

interface CreateCustomBadgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCustomBadgeData) => Promise<void>;
}

export type { CreateCustomBadgeData };

export function CreateCustomBadgeModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateCustomBadgeModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [boostPercent, setBoostPercent] = useState(5);
  const [addressText, setAddressText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseAddresses = (text: string): string[] => {
    return text
      .split(/[,\n]+/)
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
  };

  const addressCount = parseAddresses(addressText).length;

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleImageSelect(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const resetForm = () => {
    setName("");
    setBoostPercent(5);
    setAddressText("");
    setImageFile(null);
    setImagePreview(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Badge name is required");
      return;
    }

    const addresses = parseAddresses(addressText);
    if (addresses.length > 500) {
      setError("Maximum 500 addresses allowed");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        boostPercent,
        addresses,
        imageFile,
      });
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create badge");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-ds-background-200 rounded-lg border border-ds-gray-400 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-ds-gray-400">
            <h2 className="text-sm font-semibold text-ds-gray-1000">Create Badge</h2>
            <button
              type="button"
              onClick={handleClose}
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

          <div className="px-6 py-4 space-y-5">
            {error && (
              <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-3 text-sm text-ds-red-400">
                {error}
              </div>
            )}

            {/* Badge Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ds-gray-800">
                Season Badge Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 w-full px-3 bg-ds-background-100 border border-ds-gray-400 rounded-md text-sm text-ds-gray-900 placeholder:text-ds-gray-600 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700"
                required
              />
            </div>

            {/* Wallet Addresses */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-ds-gray-800">
                  Wallet Addresses
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.readText().then((text) => {
                      setAddressText((prev) =>
                        prev ? prev + "\n" + text : text,
                      );
                    });
                  }}
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add List
                </Button>
              </div>
              <textarea
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                placeholder="Enter or paste wallet addresses. Separate multiple addresses with a comma or add them in bulk as a list."
                rows={4}
                className="w-full px-3 py-2 bg-ds-background-100 border border-ds-gray-400 rounded-md text-sm text-ds-gray-900 placeholder:text-ds-gray-600 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 resize-none"
              />
              <p className="text-xs text-ds-gray-600">
                * Maximum 500 addresses
                {addressCount > 0 && (
                  <span className="text-ds-gray-700 ml-2">
                    ({addressCount} address{addressCount !== 1 ? "es" : ""})
                  </span>
                )}
              </p>
            </div>

            {/* Boost Percentage */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ds-gray-800">
                Boost Percentage (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={boostPercent}
                  onChange={(e) =>
                    setBoostPercent(parseFloat(e.target.value) || 0)
                  }
                  step="0.01"
                  min="0"
                  max="100"
                  className="h-9 w-full px-3 pr-10 bg-ds-background-100 border border-ds-gray-400 rounded-md text-sm text-ds-gray-900 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 font-geist-mono"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ds-gray-600 text-sm">
                  %
                </span>
              </div>
            </div>

            {/* Badge Image */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ds-gray-800">
                Badge Image
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDragging
                    ? "border-ds-blue-700 bg-ds-blue-700/10"
                    : "border-ds-gray-400 bg-ds-gray-100"
                }`}
              >
                {imagePreview ? (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="text-xs text-ds-red-400 hover:text-ds-red-700 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-ds-gray-200 flex items-center justify-center text-ds-gray-600">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <span className="text-sm text-ds-gray-700">
                        Click or drag image to upload{" "}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => fileRef.current?.click()}
                      >
                        + Upload
                      </Button>
                    </div>
                    <p className="text-xs text-ds-gray-600">
                      Recommended: 200x200 PNG
                    </p>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-ds-gray-400">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
