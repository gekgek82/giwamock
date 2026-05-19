"use client";

import { Badge } from "@/components/admin/ui/Badge";

// ============================================================================
// Types
// ============================================================================

export type PermissionType =
  | "team"
  | "governor"
  | "emergencyCouncil"
  | "owner"
  | "feeManager"
  | "pauser"
  | "minter"
  | "voter";

interface PermissionBadgeProps {
  permission: PermissionType;
  hasPermission?: boolean;
  showStatus?: boolean;
}

// ============================================================================
// Permission Config
// ============================================================================

const permissionConfig: Record<
  PermissionType,
  { label: string; variant: "purple" | "blue" | "error" | "warning" | "success" | "default" | "cyan" }
> = {
  team: { label: "Team", variant: "purple" },
  governor: { label: "Governor", variant: "blue" },
  emergencyCouncil: { label: "Emergency Council", variant: "error" },
  owner: { label: "Owner", variant: "warning" },
  feeManager: { label: "Fee Manager", variant: "success" },
  pauser: { label: "Pauser", variant: "warning" },
  minter: { label: "Minter", variant: "purple" },
  voter: { label: "Voter", variant: "cyan" },
};

// ============================================================================
// Component
// ============================================================================

/**
 * PermissionBadge Component
 *
 * Displays a badge indicating the required permission for an action.
 */
export function PermissionBadge({
  permission,
  hasPermission,
  showStatus = false,
}: PermissionBadgeProps) {
  const config = permissionConfig[permission];

  return (
    <div className="flex items-center gap-2">
      <Badge variant={config.variant}>{config.label}</Badge>
      {showStatus && hasPermission !== undefined && (
        <span
          className={`inline-flex items-center gap-1 text-xs ${
            hasPermission ? "text-ds-green-400" : "text-ds-gray-600"
          }`}
        >
          {hasPermission ? (
            <>
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Authorized
            </>
          ) : (
            <>
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Not authorized
            </>
          )}
        </span>
      )}
    </div>
  );
}
