"use client";

import { ReactNode } from "react";
import { Button } from "@/components/admin/ui/Button";

// ============================================================================
// Types
// ============================================================================

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ConfirmDialog Component
 *
 * Modal dialog for confirming dangerous or important actions.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  isLoading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: (
        <svg
          className="w-6 h-6 text-ds-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
      iconBg: "bg-ds-red-700/10",
      confirmVariant: "danger" as const,
    },
    warning: {
      icon: (
        <svg
          className="w-6 h-6 text-ds-yellow-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      iconBg: "bg-ds-yellow-700/10",
      confirmVariant: "primary" as const,
    },
    default: {
      icon: (
        <svg
          className="w-6 h-6 text-ds-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      iconBg: "bg-ds-blue-700/10",
      confirmVariant: "primary" as const,
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-ds-background-200 rounded-lg border border-ds-gray-400 p-6 max-w-md w-full mx-4 shadow-xl">
        {/* Icon */}
        <div
          className={`w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center mb-4`}
        >
          {styles.icon}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-ds-gray-1000 mb-2">{title}</h3>

        {/* Description */}
        {description && (
          <p className="text-ds-gray-700 text-sm mb-4">{description}</p>
        )}

        {/* Custom Content */}
        {children && <div className="mb-4">{children}</div>}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button
            variant="secondary"
            size="lg"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={styles.confirmVariant}
            size="lg"
            onClick={onConfirm}
            disabled={isLoading}
            loading={isLoading}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
