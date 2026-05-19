"use client";

import { ReactNode, useEffect, useState } from "react";
import { GIWASCAN_URL } from "@/lib/config";
import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/admin/ui/Card";

// ============================================================================
// Types
// ============================================================================

export interface StateItem {
  label: string;
  value: string | ReactNode;
  type?: "address" | "number" | "boolean" | "text";
  copyable?: boolean;
}

interface ContractStateCardProps {
  title: string;
  description?: string;
  contractAddress?: string;
  items: StateItem[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

// ============================================================================
// Helper Components
// ============================================================================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-2 p-1 hover:bg-ds-gray-200 rounded transition-colors"
      title={copied ? "Copied!" : "Copy to clipboard"}
    >
      {copied ? (
        <svg
          className="w-3.5 h-3.5 text-ds-green-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className="w-3.5 h-3.5 text-ds-gray-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}

function formatAddress(address: string): string {
  if (address.length <= 13) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ContractStateCard Component
 *
 * Displays contract state values in a card format.
 * Supports different value types and copy functionality.
 */
export function ContractStateCard({
  title,
  description,
  contractAddress,
  items,
  isLoading = false,
  error = null,
  onRefresh,
}: ContractStateCardProps) {
  return (
    <Card>
      {/* Header */}
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ds-gray-1000">{title}</h3>
            {description && (
              <p className="text-sm text-ds-gray-700 mt-1">{description}</p>
            )}
            {contractAddress && (
              <div className="flex items-center gap-2 mt-1">
                <a
                  href={`${GIWASCAN_URL}/address/${contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-geist-mono text-ds-blue-400 hover:text-ds-blue-400/80 transition-colors"
                  title={contractAddress}
                >
                  {formatAddress(contractAddress)}
                </a>
                <CopyButton text={contractAddress} />
              </div>
            )}
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 hover:bg-ds-gray-200 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <svg
                className={`w-4 h-4 text-ds-gray-700 ${
                  isLoading ? "animate-spin" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Error State */}
        {error && (
          <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-3 mb-4 text-ds-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between items-center py-2">
                <div className="h-4 w-24 bg-ds-gray-300 rounded animate-pulse" />
                <div className="h-4 w-32 bg-ds-gray-300 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          /* State Items */
          <div className="space-y-0">
            {items.map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-2.5 border-b border-ds-gray-400 last:border-0"
              >
                <span className="text-xs text-ds-gray-700">{item.label}</span>
                <div className="flex items-center">
                  {item.type === "address" && typeof item.value === "string" ? (
                    <>
                      <span
                        className="text-sm font-geist-mono text-ds-blue-400"
                        title={item.value}
                      >
                        {formatAddress(item.value)}
                      </span>
                      {item.copyable !== false && (
                        <CopyButton text={item.value} />
                      )}
                    </>
                  ) : item.type === "boolean" ? (
                    <span
                      className={`text-sm font-medium ${
                        item.value === true || item.value === "true"
                          ? "text-ds-green-400"
                          : "text-ds-red-400"
                      }`}
                    >
                      {String(item.value)}
                    </span>
                  ) : item.type === "number" ? (
                    <span className="text-sm font-geist-mono text-ds-gray-1000">
                      {item.value}
                    </span>
                  ) : (
                    <span className="text-sm text-ds-gray-1000">{item.value}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
