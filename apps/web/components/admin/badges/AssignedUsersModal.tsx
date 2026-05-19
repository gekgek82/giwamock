"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";
import { Button } from "@/components/admin/ui";
import { Badge } from "@/components/admin/ui";
import type { UserBadge, BadgeDefinition } from "@/types/admin";
import toast from "react-hot-toast";

interface AssignedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  badge: BadgeDefinition | null;
  onRevoke?: () => void;
}

export function AssignedUsersModal({
  isOpen,
  onClose,
  badge,
  onRevoke,
}: AssignedUsersModalProps) {
  const [users, setUsers] = useState<UserBadge[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const loadUsers = useCallback(async () => {
    if (!badge) return;
    setIsLoading(true);
    try {
      const data = await adminApi.getAssignedUsers(badge.id, limit, offset);
      setUsers(data.users);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load assigned users");
    } finally {
      setIsLoading(false);
    }
  }, [badge, offset]);

  useEffect(() => {
    if (isOpen && badge) {
      setOffset(0);
      loadUsers();
    }
  }, [isOpen, badge, loadUsers]);

  const handleRevoke = async (userBadgeId: number) => {
    try {
      await adminApi.revokeUserBadge(userBadgeId);
      toast.success("Badge revoked");
      loadUsers();
      onRevoke?.();
    } catch {
      toast.error("Failed to revoke badge");
    }
  };

  if (!isOpen || !badge) return null;

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-ds-background-200 rounded-lg border border-ds-gray-400 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ds-gray-400">
          <div>
            <h2 className="text-sm font-semibold text-ds-gray-1000">Assigned Users</h2>
            <p className="text-sm text-ds-gray-700 mt-1">
              {badge.name} - {total} user(s)
            </p>
          </div>
          <button
            onClick={onClose}
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

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 bg-ds-gray-300 rounded animate-pulse"
                />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-ds-gray-700 py-8 text-sm">
              No users assigned to this badge
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((ub) => (
                <div
                  key={ub.id}
                  className="flex items-center justify-between px-4 py-3 bg-ds-gray-100 rounded-lg hover:bg-ds-gray-200 transition-colors duration-100"
                >
                  <div>
                    <p className="text-sm text-ds-gray-1000 font-geist-mono">
                      {ub.userAddress}
                    </p>
                    <p className="text-xs text-ds-gray-700">
                      Granted:{" "}
                      {new Date(ub.grantedAt).toLocaleDateString()}
                      {ub.expiresAt &&
                        ` | Expires: ${new Date(ub.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={ub.isActive ? "success" : "default"}>
                      {ub.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {ub.isActive && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleRevoke(ub.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-ds-gray-400">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              Previous
            </Button>
            <span className="text-xs text-ds-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOffset(offset + limit)}
              disabled={currentPage >= totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
