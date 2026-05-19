"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/admin/ui";

interface BadgeImageUploadProps {
  currentImageUrl: string | null;
  onUpload: (file: File) => Promise<void>;
  onDelete?: () => Promise<void>;
  disabled?: boolean;
}

export function BadgeImageUpload({
  currentImageUrl,
  onUpload,
  onDelete,
  disabled,
}: BadgeImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await onUpload(file);
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-4">
      {currentImageUrl ? (
        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-ds-gray-400">
          <img
            src={currentImageUrl}
            alt="Badge"
            className="w-full h-full object-cover"
          />
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={disabled}
              className="absolute -top-1 -right-1 w-5 h-5 bg-ds-red-400 rounded-full flex items-center justify-center text-ds-background-100 text-xs hover:bg-ds-red-700"
            >
              x
            </button>
          )}
        </div>
      ) : (
        <div className="w-16 h-16 rounded-lg border-2 border-dashed border-ds-gray-400 flex items-center justify-center text-ds-gray-600">
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
      )}

      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled || isUploading}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || isUploading}
          loading={isUploading}
        >
          {isUploading ? "Uploading..." : currentImageUrl ? "Change" : "Upload"}
        </Button>
        <p className="text-xs text-ds-gray-600 mt-1">
          PNG, JPG, WebP (max 1MB)
        </p>
      </div>
    </div>
  );
}
