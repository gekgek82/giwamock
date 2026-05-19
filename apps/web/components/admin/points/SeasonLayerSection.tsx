"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";
import type {
  SeasonConfig,
  CreateSeasonRequest,
  UpdateSeasonRequest,
} from "@/types/admin";
import { CreateSeasonModal } from "./CreateSeasonModal";
import { EditSeasonModal } from "./EditSeasonModal";
import { ConfirmationModal } from "./ConfirmationModal";
import toast from "react-hot-toast";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
} from "@/components/admin/ui";

type DisplayStatus = "Scheduled" | "Active" | "Completed";

/** Map API-computed season status to display label */
function toDisplayStatus(status: string): DisplayStatus {
  if (status === "active") return "Active";
  if (status === "completed") return "Completed";
  return "Scheduled";
}

export function SeasonLayerSection() {
  const [seasons, setSeasons] = useState<SeasonConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState<SeasonConfig | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<SeasonConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchSeasons = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getSeasons();
      setSeasons(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons]);

  const handleCreate = async (data: CreateSeasonRequest) => {
    await adminApi.createSeason(data);
    toast.success("Season created successfully");
    fetchSeasons();
  };

  const handleEdit = async (id: number, data: UpdateSeasonRequest) => {
    await adminApi.updateSeason(id, data);
    toast.success("Season updated successfully");
    fetchSeasons();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await adminApi.deleteSeason(deleteTarget.id, forceDelete);
      toast.success("Season deleted");
      setDeleteTarget(null);
      setForceDelete(false);
      fetchSeasons();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete season";
      setDeleteError(message);
      // Auto-check force delete so the user can retry immediately
      setForceDelete(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusVariant = (status: DisplayStatus): "success" | "warning" | "default" => {
    const map: Record<DisplayStatus, "success" | "warning" | "default"> = {
      Active: "success",
      Scheduled: "warning",
      Completed: "default",
    };
    return map[status];
  };

  const getRewardTypeVariant = (rewardType: string): "purple" | "blue" => {
    return rewardType === "FIXED" ? "purple" : "blue";
  };

  return (
    <Card>
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-sm bg-ds-purple-400" />
          <div>
            <CardTitle>Season Layer</CardTitle>
            <CardDescription>
              Dynamic per-season distribution — adjusted each season
            </CardDescription>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreateModal(true)}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          Create
        </Button>
      </CardHeader>

      {/* Season List */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-ds-gray-300 rounded animate-pulse" />
            ))}
          </CardContent>
        ) : seasons.length === 0 ? (
          <div className="py-12 text-center">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-ds-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-ds-gray-700">No seasons created yet</p>
            <p className="text-sm text-ds-gray-600 mt-1">Click +Create to get started</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ds-gray-100">
                <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Season</th>
                <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Type</th>
                <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">LP/SWAP Split</th>
                <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Period</th>
                <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Status</th>
                <th className="h-10 px-4 text-right text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ds-gray-400">
              {seasons.map((season) => {
                const isDistribution = season.rewardType === "DISTRIBUTION";
                const displayStatus = toDisplayStatus(season.status);

                const lpWeight = season.weights?.find((w: { sector: string; weight: string }) => w.sector === "LP");
                const tradeWeight = season.weights?.find((w: { sector: string; weight: string }) => w.sector === "TRADE");
                const lpPct = lpWeight ? parseFloat(lpWeight.weight) * 100 : 0;
                const tradePct = tradeWeight ? parseFloat(tradeWeight.weight) * 100 : 0;

                const canDelete = true;

                return (
                  <tr
                    key={season.id}
                    className="hover:bg-ds-gray-100 transition-colors duration-100"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-ds-gray-1000">{season.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getRewardTypeVariant(season.rewardType)}>
                        {season.rewardType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {isDistribution ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-ds-gray-300 rounded-full overflow-hidden max-w-[80px]">
                            <div
                              className="h-full bg-ds-purple-400 rounded-full"
                              style={{ width: `${lpPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-ds-gray-700 font-geist-mono">
                            {lpPct.toFixed(0)}/{tradePct.toFixed(0)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-ds-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-ds-gray-700">
                      {season.startDate
                        ? `${new Date(season.startDate).toLocaleDateString()} ~ ${season.endDate ? new Date(season.endDate).toLocaleDateString() : "TBD"}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(displayStatus)}>
                        {displayStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditTarget(season)}
                        >
                          Edit
                        </Button>
                        {canDelete && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setDeleteTarget(season)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      <CreateSeasonModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
      />

      {/* Edit Modal */}
      <EditSeasonModal
        isOpen={!!editTarget}
        season={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEdit}
      />

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={!!deleteTarget}
        title="Delete Season"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        detail={
          deleteTarget ? (
            <div className="space-y-3 text-ds-gray-700">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Name</span>
                  <span className="text-ds-gray-1000 font-medium">{deleteTarget.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type</span>
                  <span className={`font-medium ${deleteTarget.rewardType === "FIXED" ? "text-ds-purple-400" : "text-ds-blue-400"}`}>
                    {deleteTarget.rewardType}
                  </span>
                </div>
                {deleteTarget.startDate && (
                  <div className="flex justify-between">
                    <span>Period</span>
                    <span className="text-ds-gray-1000 font-medium">
                      {new Date(deleteTarget.startDate).toLocaleDateString()} ~ {deleteTarget.endDate ? new Date(deleteTarget.endDate).toLocaleDateString() : "TBD"}
                    </span>
                  </div>
                )}
              </div>

              {/* Error message */}
              {deleteError && (
                <div className="bg-ds-red-400/10 border border-ds-red-400/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-ds-red-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-ds-red-400">{deleteError}</p>
                  </div>
                </div>
              )}

              {/* Force delete option */}
              <div className="border-t border-ds-gray-400 pt-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceDelete}
                    onChange={(e) => setForceDelete(e.target.checked)}
                    className="mt-0.5 rounded border-ds-gray-500 accent-ds-red-400"
                  />
                  <div>
                    <span className="text-sm font-medium text-ds-red-400">Force Delete</span>
                    <p className="text-xs text-ds-gray-600 mt-0.5">
                      Also delete all related point balances, claims, history, emissions, badges, and blacklist entries for this season.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          ) : undefined
        }
        confirmLabel="Delete"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => { setDeleteTarget(null); setForceDelete(false); setDeleteError(null); }}
      />
    </Card>
  );
}
