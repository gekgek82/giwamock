"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { adminApi } from "@/lib/adminApi";
import { CacheKeyTable, CacheValueModal } from "@/components/admin/cache";
import { ConfirmDialog } from "@/components/admin/contracts/ConfirmDialog";
import type { CacheKeyInfo, CacheKeyListItem } from "@/types/admin";
import toast from "react-hot-toast";
import {
  Button,
  Card,
  CardContent,
} from "@/components/admin/ui";

export default function CachePage() {
  const [items, setItems] = useState<CacheKeyListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchPattern, setSearchPattern] = useState("");

  // Flush all dialog state
  const [isFlushDialogOpen, setIsFlushDialogOpen] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);

  // Value modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKeyInfo, setSelectedKeyInfo] = useState<CacheKeyInfo | null>(
    null
  );
  const [isModalLoading, setIsModalLoading] = useState(false);

  const fetchKeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await adminApi.getCacheKeys();
      setItems(response.items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load cache keys"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!searchPattern.trim()) return items;
    const pattern = searchPattern.trim().toLowerCase();

    // Support glob-like pattern with *
    if (pattern.includes("*")) {
      const regex = new RegExp(
        "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
      );
      return items.filter((item) => regex.test(item.key.toLowerCase()));
    }

    return items.filter((item) => item.key.toLowerCase().includes(pattern));
  }, [items, searchPattern]);

  // Group keys by prefix for summary
  const prefixGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    items.forEach((item) => {
      const prefix = item.key.split(":")[0];
      groups[prefix] = (groups[prefix] || 0) + 1;
    });
    return groups;
  }, [items]);

  // View key value
  const handleView = async (key: string) => {
    setIsModalOpen(true);
    setIsModalLoading(true);
    setSelectedKeyInfo(null);

    try {
      const info = await adminApi.getCacheKeyInfo(key);
      setSelectedKeyInfo(info);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load key info"
      );
      setIsModalOpen(false);
    } finally {
      setIsModalLoading(false);
    }
  };

  // Delete single key
  const handleDelete = async (key: string) => {
    if (!confirm(`Delete cache key "${key}"?`)) return;

    try {
      await adminApi.deleteCacheKey(key);
      toast.success(`Deleted: ${key}`);
      setItems((prev) => prev.filter((item) => item.key !== key));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete key");
    }
  };

  // Flush all cache
  const handleFlushAll = async () => {
    setIsFlushing(true);
    try {
      const response = await adminApi.deleteCacheKeysByPattern("*");
      toast.success(`Flushed ${response.deletedCount} keys`);
      setItems([]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to flush cache"
      );
    } finally {
      setIsFlushing(false);
      setIsFlushDialogOpen(false);
    }
  };

  // Bulk delete by pattern
  const handleBulkDelete = async () => {
    const pattern = searchPattern.trim();
    if (!pattern) {
      toast.error("Enter a pattern to bulk delete (e.g. stats:*)");
      return;
    }
    if (
      !confirm(
        `Delete all ${filteredItems.length} keys matching "${pattern}"?`
      )
    )
      return;

    try {
      const response = await adminApi.deleteCacheKeysByPattern(pattern);
      toast.success(`Deleted ${response.deletedCount} keys`);
      fetchKeys();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to bulk delete"
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ds-gray-1000">Cache Management</h1>
          <p className="text-sm text-ds-gray-700 mt-1">
            Inspect and manage Redis cached values
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="danger"
            size="md"
            onClick={() => setIsFlushDialogOpen(true)}
            disabled={isLoading || items.length === 0}
          >
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Flush All
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={fetchKeys}
            loading={isLoading}
          >
            <svg
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-4 text-ds-red-400">
          <div className="flex items-center gap-2">
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
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Total Keys</p>
            <p className="text-2xl font-semibold text-ds-gray-1000 font-geist-mono">{items.length}</p>
          </CardContent>
        </Card>
        {Object.entries(prefixGroups)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([prefix, count]) => (
            <Card key={prefix}>
              <CardContent className="py-4">
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">
                  {prefix}:*
                </p>
                <p className="text-2xl font-semibold text-ds-blue-700 font-geist-mono">{count}</p>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Search & Bulk Actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ds-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchPattern}
            onChange={(e) => setSearchPattern(e.target.value)}
            placeholder="Search keys... (e.g. stats:* or pool)"
            className="w-full h-9 pl-9 pr-4 bg-ds-background-100 border border-ds-gray-400 rounded-md text-sm text-ds-gray-900 placeholder:text-ds-gray-600 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 focus:border-ds-gray-700 transition-colors duration-150"
          />
        </div>
        {searchPattern.trim() && filteredItems.length > 0 && (
          <Button
            variant="danger"
            size="md"
            onClick={handleBulkDelete}
          >
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete {filteredItems.length} keys
          </Button>
        )}
      </div>

      {/* Results count */}
      {searchPattern.trim() && (
        <p className="text-xs text-ds-gray-700">
          Showing {filteredItems.length} of {items.length} keys
        </p>
      )}

      {/* Key Table */}
      <CacheKeyTable
        items={filteredItems}
        isLoading={isLoading}
        onView={handleView}
        onDelete={handleDelete}
      />

      {/* Value Modal */}
      <CacheValueModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        keyInfo={selectedKeyInfo}
        isLoading={isModalLoading}
      />

      {/* Flush All Confirm Dialog */}
      <ConfirmDialog
        isOpen={isFlushDialogOpen}
        onClose={() => setIsFlushDialogOpen(false)}
        onConfirm={handleFlushAll}
        title="Flush All Cache"
        description={`This will permanently delete all ${items.length} cached keys. All services will need to re-fetch data from source. This action cannot be undone.`}
        confirmLabel="Flush All"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isFlushing}
      />
    </div>
  );
}
