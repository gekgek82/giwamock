"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import type { AdminTokenInfo } from "@/types/admin";
import { Button } from "@/components/admin/ui";

interface IconUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
  token: AdminTokenInfo | null;
  mode?: "icon" | "sticker";
}

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "image/webp",
];
const MAX_SIZE = 1 * 1024 * 1024; // 1MB

/**
 * Icon Upload Modal Component
 *
 * Handles icon file upload with drag & drop and preview.
 */
export function IconUploadModal({
  isOpen,
  onClose,
  onUpload,
  token,
  mode = "icon",
}: IconUploadModalProps) {
  const isSticker = mode === "sticker";
  const label = isSticker ? "Sticker" : "Icon";
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setPreview(null);
    setError(null);
    setIsDragging(false);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Invalid file type. Please upload PNG, JPG, JPEG, SVG, or WebP.";
    }
    if (file.size > MAX_SIZE) {
      return "File is too large. Maximum size is 1MB.";
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      await onUpload(selectedFile);
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to upload ${label.toLowerCase()}`
      );
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen || !token) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-ds-background-200 rounded-lg border border-ds-gray-400 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ds-gray-400">
          <div>
            <h2 className="text-sm font-semibold text-ds-gray-1000">
              {isSticker ? "Upload Verified Sticker" : "Upload Token Icon"}
            </h2>
            <p className="text-sm text-ds-gray-700 mt-1">
              {token.symbol} - {token.name}
            </p>
          </div>
          <button
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

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-3 text-sm text-ds-red-400">
              {error}
            </div>
          )}

          {((mode === "icon" && token.iconUrl) ||
            (mode === "sticker" && token.stickerUrl)) && (
            <div className="bg-ds-yellow-700/10 border border-ds-yellow-700/20 rounded-lg p-3 text-sm text-ds-yellow-400">
              This token already has a {label.toLowerCase()}. Uploading a new
              one will replace it.
            </div>
          )}

          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-ds-blue-700 bg-ds-blue-700/10"
                : "border-ds-gray-400 hover:border-ds-gray-600"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {preview ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <Image
                    src={preview}
                    alt="Preview"
                    width={80}
                    height={80}
                    className="rounded-full"
                  />
                </div>
                <div>
                  <p className="text-sm text-ds-gray-1000 font-medium">
                    {selectedFile?.name}
                  </p>
                  <p className="text-xs text-ds-gray-700">
                    {selectedFile && (selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreview(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="text-sm text-ds-gray-700 hover:text-ds-gray-1000 transition-colors"
                >
                  Choose different file
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <svg
                  className="w-12 h-12 mx-auto text-ds-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <div>
                  <p className="text-ds-gray-1000 font-medium text-sm">
                    Drop your file here, or
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-ds-blue-400 hover:text-ds-blue-700 font-medium text-sm transition-colors"
                  >
                    browse
                  </button>
                </div>
                <p className="text-xs text-ds-gray-600">
                  PNG, JPG, JPEG, SVG, or WebP (max 1MB)
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.svg,.webp"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>

          {/* Current Preview */}
          {((mode === "icon" && token.iconUrl) ||
            (mode === "sticker" && token.stickerUrl)) &&
            !preview && (
              <div className="flex items-center gap-3 p-3 bg-ds-gray-200 rounded-lg">
                <Image
                  src={(isSticker ? token.stickerUrl : token.iconUrl)!}
                  alt={token.symbol}
                  width={isSticker ? 12 : 40}
                  height={isSticker ? 12 : 40}
                  className={isSticker ? "" : "rounded-full"}
                />
                <div className="flex-1">
                  <p className="text-sm text-ds-gray-700">
                    Current {label.toLowerCase()}
                  </p>
                </div>
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-ds-gray-400">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!selectedFile}
            loading={isUploading}
          >
            {isUploading ? "Uploading..." : `Upload ${label}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
