"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";
import type {
  BadgeDefinition,
  SeasonConfig,
  CreateSeasonBadgeDefinitionRequest,
} from "@/types/admin";
import { BadgeImageUpload } from "./BadgeImageUpload";
import { CreateSeasonBadgeModal } from "./CreateSeasonBadgeModal";
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

interface SeasonBadgeSectionProps {
  seasons: SeasonConfig[];
}

export function SeasonBadgeSection({ seasons }: SeasonBadgeSectionProps) {
  const [definitions, setDefinitions] = useState<BadgeDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const loadDefinitions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getBadgeDefinitions("SEASON");
      setDefinitions(data.definitions);
    } catch {
      toast.error("Failed to load season badge definitions");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDefinitions();
  }, [loadDefinitions]);

  const handleCreate = async (
    data: CreateSeasonBadgeDefinitionRequest,
    imageFile?: File,
  ) => {
    const badge = await adminApi.createSeasonBadgeDefinition(data);
    if (imageFile) {
      await adminApi.uploadBadgeImage(badge.id, imageFile);
    }
    toast.success("Season badge created");
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

  // Group by season
  const grouped = definitions.reduce(
    (acc, def) => {
      const key = def.seasonId
        ? `Season: ${seasons.find((s) => s.id === def.seasonId)?.name || `#${def.seasonId}`}`
        : "No Season Assigned";
      if (!acc[key]) acc[key] = [];
      acc[key].push(def);
      return acc;
    },
    {} as Record<string, BadgeDefinition[]>,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ds-gray-700">
          Season badges are auto-awarded to top-performing users at season end
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
            No Season Badges
          </h3>
          <p className="text-sm text-ds-gray-700">
            Create season badge definitions to auto-award at season end
          </p>
        </Card>
      ) : (
        (
          Object.entries(grouped) as [string, BadgeDefinition[]][]
        ).map(([groupName, defs]) => (
          <div key={groupName} className="space-y-3">
            <h3 className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
              {groupName}
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Boost %</TableHead>
                  <TableHead>Top %</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defs
                  .sort((a: BadgeDefinition, b: BadgeDefinition) => (a.level ?? 99) - (b.level ?? 99))
                  .map((def: BadgeDefinition) => (
                    <TableRow key={def.id}>
                      <TableCell>
                        <BadgeImageUpload
                          currentImageUrl={def.imageUrl}
                          onUpload={(file) =>
                            handleUploadImage(def.id, file)
                          }
                          onDelete={() => handleDeleteImage(def.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium font-geist-mono">
                        {def.level ? `Lv ${def.level}` : "-"}
                      </TableCell>
                      <TableCell>{def.name}</TableCell>
                      <TableCell>
                        <span className="text-ds-green-400 font-geist-mono">+{def.boostPercent}%</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-ds-blue-400 font-geist-mono">
                          {def.targetPercentile
                            ? `Top ${def.targetPercentile}%`
                            : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={def.isPreSeason ? "warning" : "blue"}>
                          {def.isPreSeason ? "Pre-Season" : "Season"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <button onClick={() => handleToggleActive(def)}>
                          <Badge variant={def.isActive ? "success" : "default"}>
                            {def.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(def.id)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        ))
      )}

      <CreateSeasonBadgeModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        seasons={seasons}
      />
    </div>
  );
}
