"use client";

import { ReactNode, FormEvent } from "react";
import { PermissionBadge, PermissionType } from "./PermissionBadge";
import { TransactionStatus, TxStatus } from "./TransactionStatus";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/admin/ui/Card";
import { Button } from "@/components/admin/ui/Button";

// ============================================================================
// Types
// ============================================================================

interface AdminFunctionFormProps {
  title: string;
  description?: string;
  permission: PermissionType;
  hasPermission?: boolean;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
  txStatus?: TxStatus;
  txHash?: string;
  txError?: string;
  onTxReset?: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AdminFunctionForm Component
 *
 * Wrapper for admin function execution forms with permission display.
 */
export function AdminFunctionForm({
  title,
  description,
  permission,
  hasPermission = true,
  children,
  onSubmit,
  submitLabel = "Execute",
  isLoading = false,
  disabled = false,
  txStatus = "idle",
  txHash,
  txError,
  onTxReset,
}: AdminFunctionFormProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isLoading && !disabled && hasPermission) {
      onSubmit();
    }
  };

  const isFormDisabled =
    isLoading ||
    disabled ||
    !hasPermission ||
    txStatus === "pending" ||
    txStatus === "confirming";

  return (
    <Card>
      {/* Header */}
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ds-gray-1000">{title}</h3>
            {description && (
              <p className="text-sm text-ds-gray-700 mt-1">{description}</p>
            )}
          </div>
          <PermissionBadge
            permission={permission}
            hasPermission={hasPermission}
            showStatus
          />
        </div>
      </CardHeader>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {children}

          {/* Transaction Status */}
          {txStatus !== "idle" && (
            <TransactionStatus
              status={txStatus}
              txHash={txHash}
              error={txError}
              onReset={onTxReset}
            />
          )}
        </CardContent>

        {/* Submit Button */}
        <CardFooter>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isFormDisabled}
            loading={
              isLoading ||
              txStatus === "pending" ||
              txStatus === "confirming"
            }
            className="w-full"
          >
            {submitLabel}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
