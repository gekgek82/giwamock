"use client";

import { Button } from "@/components/admin/ui";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  detail?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  detail,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-ds-background-200 border border-ds-gray-400 rounded-lg p-6 w-full max-w-md shadow-xl">
        {/* Warning Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-ds-yellow-700/10 flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5 text-ds-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-ds-gray-1000">{title}</h3>
        </div>

        <p className="text-sm text-ds-gray-700 mb-4">{message}</p>

        {detail && (
          <div className="bg-ds-gray-200 border border-ds-gray-400 rounded-lg p-3 mb-6 text-sm">
            {detail}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="secondary"
            size="md"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={isLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
