"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";
import type {
  BadgeDefinition,
} from "@/types/admin";
import { BadgeImageUpload } from "./BadgeImageUpload";
import { CreateCustomBadgeModal } from "./CreateCustomBadgeModal";
import type { CreateCustomBadgeData } from "./CreateCustomBadgeModal";
import { AssignCustomBadgeModal } from "./AssignCustomBadgeModal";
import { AssignedUsersModal } from "./AssignedUsersModal";
import {
  Button,
  Card,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/admin/ui";
import toast from "react-hot-toast";

export function CustomBadgeSection() {
  const [definitions, setDefinitions] = useState<BadgeDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [assignBadge, setAssignBadge] = useState<BadgeDefinition | null>(null);
  const [viewUsersBadge, setViewUsersBadge] = useState<BadgeDefinition | null>(
    null,
  );

  const loadDefinitions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getBadgeDefinitions("CUSTOM");
      setDefinitions(data.definitions);
    } catch {
      toast.error("Failed to load custom badge definitions");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDefinitions();
  }, [loadDefinitions]);

  const handleCreate = async (data: CreateCustomBadgeData) => {
    // 1. Create badge definition
    const created = await adminApi.createCustomBadgeDefinition({
      name: data.name,
      boostPercent: data.boostPercent,
    });

    // 2. Upload image if provided
    if (data.imageFile) {
      await adminApi.uploadBadgeImage(created.id, data.imageFile);
    }

    // 3. Assign addresses if provided
    if (data.addresses.length > 0) {
      const result = await adminApi.assignCustomBadge({
        badgeDefinitionId: created.id,
        addresses: data.addresses,
      });
      const msg =
        result.failed.length > 0
          ? `Badge created & assigned to ${result.assigned} address(es) (${result.failed.length} skipped)`
          : `Badge created & assigned to ${result.assigned} address(es)`;
      toast.success(msg);
    } else {
      toast.success("Custom badge created");
    }

    loadDefinitions();
  };

  const handleAssign = async (data: {
    badgeDefinitionId: number;
    addresses: string[];
    expiresAt?: string;
  }) => {
    const result = await adminApi.assignCustomBadge(data);
    toast.success(
      `Assigned to ${result.assigned} address(es)${result.failed.length > 0 ? ` (${result.failed.length} skipped)` : ""}`,
    );
    loadDefinitions();
  };

  const handleUploadImage = async (id: number, file: File) => {
    await adminApi.uploadBadgeImage(id, file);
    toast.success("Image uploaded");
    loadDefinitions();
  };

  const handleDeleteImage = async (id: number) => {
    await adminApi.deleteBadgeImage(id);
    toast.success("Image deleted");
    loadDefinitions();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this badge definition?"))
      return;
    await adminApi.deleteBadgeDefinition(id);
    toast.success("Badge definition deleted");
    loadDefinitions();
  };

  const handleToggleActive = async (def: BadgeDefinition) => {
    await adminApi.updateBadgeDefinition(def.id, {
      isActive: !def.isActive,
    });
    toast.success(def.isActive ? "Badge deactivated" : "Badge activated");
    loadDefinitions();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ds-gray-700">
          Custom badges are manually assigned to specific wallet addresses
        </p>
        <Button onClick={() => setIsCreateOpen(true)}>
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create Badge
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-ds-gray-300 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : definitions.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-sm font-semibold text-ds-gray-1000 mb-2">
            No Custom Badges
          </h3>
          <p className="text-sm text-ds-gray-700">
            Create custom badge definitions for manual assignment
          </p>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Boost %</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {definitions.map((def) => (
              <TableRow key={def.id}>
                <TableCell>
                  <BadgeImageUpload
                    currentImageUrl={def.imageUrl}
                    onUpload={(file) => handleUploadImage(def.id, file)}
                    onDelete={() => handleDeleteImage(def.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {def.name}
                </TableCell>
                <TableCell>
                  <span className="text-ds-green-400 font-geist-mono">+{def.boostPercent}%</span>
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => setViewUsersBadge(def)}
                    className="text-ds-blue-400 hover:text-ds-blue-700 text-sm transition-colors"
                  >
                    {def.assignedCount ?? 0} users
                  </button>
                </TableCell>
                <TableCell>
                  <button onClick={() => handleToggleActive(def)}>
                    <Badge variant={def.isActive ? "success" : "default"}>
                      {def.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAssignBadge(def)}
                    >
                      Assign
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(def.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateCustomBadgeModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <AssignCustomBadgeModal
        isOpen={assignBadge !== null}
        onClose={() => setAssignBadge(null)}
        onSubmit={handleAssign}
        badge={assignBadge}
      />

      <AssignedUsersModal
        isOpen={viewUsersBadge !== null}
        onClose={() => setViewUsersBadge(null)}
        badge={viewUsersBadge}
        onRevoke={loadDefinitions}
      />
    </div>
  );
}
