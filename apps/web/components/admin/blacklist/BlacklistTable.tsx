"use client";

import type { BlacklistEntry } from "@/types/admin";
import {
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Button,
} from "@/components/admin/ui";

interface BlacklistTableProps {
  entries: BlacklistEntry[];
  isLoading: boolean;
  onRemove: (address: string, seasonId: number) => void;
}

/**
 * Blacklist Table Component
 *
 * Displays all blacklisted users with their details.
 */
export function BlacklistTable({ entries, isLoading, onRemove }: BlacklistTableProps) {
  const formatAddress = (address: string): string => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getReasonBadge = (reason: string) => {
    const variantMap: Record<string, "purple" | "error" | "warning" | "default"> = {
      FLASH_LOAN_ABUSE: "purple",
      SYBIL_ATTACK: "error",
      SELF_REFERRAL: "warning",
      WASH_TRADING: "warning",
      MANUAL_BAN: "default",
    };
    return (
      <Badge variant={variantMap[reason] || "default"}>
        {reason.replace(/_/g, " ")}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-ds-gray-300 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-ds-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-sm font-semibold text-ds-gray-1000 mb-1">No Blacklisted Users</h3>
          <p className="text-sm text-ds-gray-700">All users are in good standing</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Address</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Forfeited</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={`${entry.userAddress}-${entry.seasonId}`}>
            <TableCell>
              <span className="font-geist-mono text-sm text-ds-gray-1000">
                {formatAddress(entry.userAddress)}
              </span>
              <p className="text-xs text-ds-gray-600 mt-0.5">Season #{entry.seasonId}</p>
            </TableCell>
            <TableCell>{getReasonBadge(entry.reason)}</TableCell>
            <TableCell>
              <p className="text-sm text-ds-gray-700 max-w-xs truncate">
                {entry.description || "-"}
              </p>
            </TableCell>
            <TableCell className="text-right">
              <span className="text-sm font-medium font-geist-mono text-ds-red-400">
                {parseFloat(entry.forfeitedPoints).toLocaleString()} Pts
              </span>
            </TableCell>
            <TableCell>
              <span className="text-sm text-ds-gray-700">
                {new Date(entry.blacklistedAt).toLocaleDateString()}
              </span>
            </TableCell>
            <TableCell>
              {entry.isActive ? (
                <Badge variant="error">ACTIVE</Badge>
              ) : (
                <Badge variant="default">REMOVED</Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              {entry.isActive && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onRemove(entry.userAddress, entry.seasonId)}
                >
                  Remove
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
