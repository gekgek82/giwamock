"use client";

import type { CacheKeyInfo } from "@/types/admin";
import { Button } from "@/components/admin/ui";

interface CacheValueModalProps {
  isOpen: boolean;
  onClose: () => void;
  keyInfo: CacheKeyInfo | null;
  isLoading: boolean;
}

function formatTtl(ttl: number): string {
  if (ttl === -1) return "No expiry";
  if (ttl === -2) return "Key not found";
  if (ttl < 60) return `${ttl}s`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`;
  return `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`;
}

function formatValue(value: string | null): string {
  if (value === null) return "(null)";
  try {
    const parsed = JSON.parse(value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

export function CacheValueModal({
  isOpen,
  onClose,
  keyInfo,
  isLoading,
}: CacheValueModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-50 w-full max-w-2xl max-h-[80vh] bg-ds-background-200 rounded-lg border border-ds-gray-400 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ds-gray-400">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-ds-gray-1000">Cache Key Details</h3>
            {keyInfo && (
              <p className="text-xs text-ds-gray-700 font-geist-mono mt-1 truncate">
                {keyInfo.key}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-1.5 text-ds-gray-700 hover:text-ds-gray-1000 hover:bg-ds-gray-200 rounded-md transition-colors"
          >
            <svg
              className="w-4 h-4"
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

        {/* Content */}
        <div className="px-6 py-4 overflow-auto flex-1">
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-6 bg-ds-gray-300 rounded animate-pulse w-1/3" />
              <div className="h-40 bg-ds-gray-300 rounded animate-pulse" />
            </div>
          ) : keyInfo ? (
            <div className="space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-ds-gray-100 border border-ds-gray-400 rounded-md p-3">
                  <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Type</p>
                  <p className="text-sm font-medium text-ds-gray-1000">{keyInfo.type}</p>
                </div>
                <div className="bg-ds-gray-100 border border-ds-gray-400 rounded-md p-3">
                  <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">TTL</p>
                  <p className="text-sm font-medium text-ds-gray-1000 font-geist-mono">
                    {formatTtl(keyInfo.ttl)}
                  </p>
                </div>
              </div>

              {/* Value */}
              <div>
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-2">Value</p>
                <pre className="bg-ds-gray-100 border border-ds-gray-400 rounded-md p-4 text-sm text-ds-gray-900 font-geist-mono overflow-auto max-h-96 whitespace-pre-wrap break-all">
                  {formatValue(keyInfo.value)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-ds-gray-700 text-sm text-center">No data available</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-3 border-t border-ds-gray-400">
          <Button variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
