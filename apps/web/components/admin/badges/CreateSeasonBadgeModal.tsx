"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/admin/ui";
import { Select } from "@/components/admin/ui";
import type {
  CreateSeasonBadgeDefinitionRequest,
  SeasonConfig,
} from "@/types/admin";

interface CreateSeasonBadgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    data: CreateSeasonBadgeDefinitionRequest,
    imageFile?: File,
  ) => Promise<void>;
  seasons: SeasonConfig[];
}

export function CreateSeasonBadgeModal({
  isOpen,
  onClose,
  onSubmit,
  seasons,
}: CreateSeasonBadgeModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    level: 1,
    boostPercent: 5,
    percentileFrom: 0,
    percentileTo: 10,
    seasonId: "",
    isPreSeason: false,
  });

  const resetForm = () => {
    setForm({
      name: "",
      level: 1,
      boostPercent: 5,
      percentileFrom: 0,
      percentileTo: 10,
      seasonId: "",
      isPreSeason: false,
    });
    setImageFile(null);
    setImagePreview(null);
    setError(null);
  };

  const handleImageSelect = useCallback((file: File) => {
    if (file.size > 1024 * 1024) {
      setError("Image must be less than 1MB");
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        handleImageSelect(file);
      }
    },
    [handleImageSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Badge name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(
        {
          name: form.name.trim(),
          level: form.level,
          boostPercent: form.boostPercent,
          targetPercentile: form.percentileTo,
          seasonId: form.seasonId ? parseInt(form.seasonId) : undefined,
          isPreSeason: form.isPreSeason,
        },
        imageFile || undefined,
      );
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create badge");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-ds-background-200 rounded-lg border border-ds-gray-400 w-full max-w-lg mx-4 shadow-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-ds-gray-400">
            <h2 className="text-sm font-semibold text-ds-gray-1000">Create Badge</h2>
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
          <div className="px-6 py-4 space-y-5">
            {error && (
              <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-3 text-sm text-ds-red-400">
                {error}
              </div>
            )}

            {/* Level */}
            <Select
              label="Level"
              value={form.level.toString()}
              onChange={(e) =>
                setForm({ ...form, level: parseInt(e.target.value) })
              }
              options={[1, 2, 3, 4, 5, 6].map((lv) => ({
                value: lv.toString(),
                label: `Lv${lv}`,
              }))}
            />

            {/* Season Badge Name */}
            <div className="flex items-center gap-4">
              <label className="text-xs font-medium text-ds-gray-800 whitespace-nowrap min-w-[140px]">
                Season Badge Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder=""
                className="flex-1 h-9 px-3 bg-ds-background-100 border border-ds-gray-400 rounded-md text-sm text-ds-gray-900 placeholder:text-ds-gray-600 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 transition-colors"
                required
              />
            </div>

            {/* Divider */}
            <div className="border-t border-ds-gray-400" />

            {/* Boost Percentage */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ds-gray-800">
                Boost Percentage (%)
              </label>
              <input
                type="number"
                value={form.boostPercent}
                onChange={(e) =>
                  setForm({
                    ...form,
                    boostPercent: parseFloat(e.target.value) || 0,
                  })
                }
                step="0.01"
                min="0"
                max="100"
                className="h-9 w-full px-3 bg-ds-background-100 border border-ds-gray-400 rounded-md text-sm text-ds-gray-900 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 transition-colors font-geist-mono"
                required
              />
            </div>

            {/* Recipient Top Percentage */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ds-gray-800">
                Recipient Top Percentage (%)
              </label>
              <div className="flex items-center gap-3">
                <span className="text-sm text-ds-gray-700">From</span>
                <input
                  type="number"
                  value={form.percentileFrom}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      percentileFrom: parseFloat(e.target.value) || 0,
                    })
                  }
                  step="0.01"
                  min="0"
                  max="100"
                  className="flex-1 h-9 px-3 bg-ds-background-100 border border-ds-gray-400 rounded-md text-sm text-ds-gray-900 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 transition-colors font-geist-mono"
                />
                <span className="text-sm text-ds-gray-600">~</span>
                <input
                  type="number"
                  value={form.percentileTo}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      percentileTo: parseFloat(e.target.value) || 0,
                    })
                  }
                  step="0.01"
                  min="0"
                  max="100"
                  className="flex-1 h-9 px-3 bg-ds-background-100 border border-ds-gray-400 rounded-md text-sm text-ds-gray-900 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 transition-colors font-geist-mono"
                />
                <span className="text-sm text-ds-gray-700">%</span>
              </div>
              <p className="text-xs text-ds-gray-600">
                e.g. Top 10% → 10%
              </p>
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
                className={`relative rounded-lg border-2 border-dashed transition-colors ${
                  isDragOver
                    ? "border-ds-blue-700 bg-ds-blue-700/5"
                    : "border-ds-gray-400 bg-ds-gray-100"
                }`}
              >
                {imagePreview ? (
                  <div className="flex items-center gap-4 p-5">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-ds-gray-400 shrink-0">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ds-gray-1000 truncate">
                        {imageFile?.name}
                      </p>
                      <p className="text-xs text-ds-gray-700 mt-0.5">
                        {imageFile &&
                          (imageFile.size / 1024).toFixed(1) + " KB"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className="text-ds-gray-700 hover:text-ds-red-400 transition-colors shrink-0"
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
                ) : (
                  <div className="flex items-center gap-4 p-5">
                    <div className="w-12 h-12 rounded-lg bg-ds-gray-200 border border-ds-gray-400 flex items-center justify-center text-ds-gray-600 shrink-0">
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
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-ds-gray-700">
                        Click or drag image to upload
                      </p>
                      <p className="text-xs text-ds-gray-600 mt-0.5">
                        Recommended: 200x200 PNG
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                    >
                      + Upload
                    </Button>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  tabIndex={-1}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-ds-gray-400">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                resetForm();
                onClose();
              }}
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
