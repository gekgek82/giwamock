"use client";

import { GIWASCAN_URL } from "@/lib/config";

// ============================================================================
// Types
// ============================================================================

export type TxStatus = "idle" | "pending" | "confirming" | "success" | "error";

interface TransactionStatusProps {
  status: TxStatus;
  txHash?: string;
  error?: string;
  onReset?: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * TransactionStatus Component
 *
 * Displays the current status of a blockchain transaction.
 */
export function TransactionStatus({
  status,
  txHash,
  error,
  onReset,
}: TransactionStatusProps) {
  if (status === "idle") return null;

  const getExplorerUrl = (hash: string) => `${GIWASCAN_URL}/tx/${hash}`;

  return (
    <div
      className={`rounded-lg p-4 border ${
        status === "error"
          ? "bg-ds-red-700/10 border-ds-red-700/20"
          : status === "success"
          ? "bg-ds-green-700/10 border-ds-green-700/20"
          : "bg-ds-blue-700/10 border-ds-blue-700/20"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {status === "pending" || status === "confirming" ? (
            <svg
              className="w-5 h-5 text-ds-blue-400 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : status === "success" ? (
            <svg
              className="w-5 h-5 text-ds-green-400"
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
              className="w-5 h-5 text-ds-red-400"
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
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium ${
              status === "error"
                ? "text-ds-red-400"
                : status === "success"
                ? "text-ds-green-400"
                : "text-ds-blue-400"
            }`}
          >
            {status === "pending" && "Waiting for wallet confirmation..."}
            {status === "confirming" &&
              "Transaction submitted, waiting for confirmation..."}
            {status === "success" && "Transaction confirmed!"}
            {status === "error" && "Transaction failed"}
          </p>

          {/* Transaction Hash */}
          {txHash && (
            <div className="mt-2">
              <a
                href={getExplorerUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-ds-gray-700 hover:text-ds-gray-1000 transition-colors font-geist-mono"
              >
                {txHash.slice(0, 10)}...{txHash.slice(-8)}
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          )}

          {/* Error Message */}
          {error && <p className="mt-1 text-xs text-ds-red-400/80">{error}</p>}
        </div>

        {/* Reset Button */}
        {(status === "success" || status === "error") && onReset && (
          <button
            onClick={onReset}
            className="flex-shrink-0 p-1 hover:bg-ds-gray-200 rounded transition-colors"
          >
            <svg
              className="w-4 h-4 text-ds-gray-700"
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
        )}
      </div>
    </div>
  );
}
