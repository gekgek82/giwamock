"use client";

import { useState, useEffect, useRef } from "react";
import {
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Card,
  CardContent,
} from "@/components/admin/ui";
import type { CacheKeyListItem } from "@/types/admin";

interface CacheKeyTableProps {
  items: CacheKeyListItem[];
  isLoading: boolean;
  onView: (key: string) => void;
  onDelete: (key: string) => void;
}

function getKeyPrefix(key: string): string {
  const parts = key.split(":");
  return parts.length > 1 ? parts[0] : key;
}

const prefixVariants: Record<string, "blue" | "success" | "purple" | "default"> = {
  stats: "blue",
  price: "success",
  pools: "purple",
};

function formatTtl(ttl: number): string {
  if (ttl === -1) return "No expiry";
  if (ttl === -2) return "N/A";
  if (ttl <= 0) return "Expired";
  if (ttl < 60) return `${ttl}s`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`;
  const h = Math.floor(ttl / 3600);
  const m = Math.floor((ttl % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getTtlColor(ttl: number): string {
  if (ttl === -1) return "text-ds-gray-600";
  if (ttl === -2) return "text-ds-gray-500";
  if (ttl <= 0) return "text-ds-red-400";
  if (ttl < 60) return "text-ds-red-400";
  if (ttl < 300) return "text-ds-amber-500";
  return "text-ds-green-500";
}

/** Tracks elapsed seconds since items were fetched, to compute live TTL countdown */
function useTtlTick(items: CacheKeyListItem[]) {
  const [elapsed, setElapsed] = useState(0);
  const prevItemsRef = useRef(items);

  // Reset elapsed when items change (new fetch)
  useEffect(() => {
    if (items !== prevItemsRef.current) {
      setElapsed(0);
      prevItemsRef.current = items;
    }
  }, [items]);

  // Tick every 1s
  useEffect(() => {
    if (items.length === 0) return;
    const hasCountdown = items.some((i) => i.ttl > 0);
    if (!hasCountdown) return;

    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [items]);

  return elapsed;
}

function getLiveTtl(originalTtl: number, elapsed: number): number {
  // -1 (no expiry) and -2 (not found) stay as-is
  if (originalTtl < 0) return originalTtl;
  return Math.max(originalTtl - elapsed, 0);
}

export function CacheKeyTable({
  items,
  isLoading,
  onView,
  onDelete,
}: CacheKeyTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-ds-gray-300 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const elapsed = useTtlTick(items);

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <svg
            className="w-10 h-10 text-ds-gray-600 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
            />
          </svg>
          <p className="text-sm font-medium text-ds-gray-700">No cache keys found</p>
          <p className="text-xs text-ds-gray-600 mt-1">
            Try a different search pattern or check Redis connection
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Key</TableHead>
          <TableHead>Prefix</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>TTL</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const prefix = getKeyPrefix(item.key);
          const badgeVariant = prefixVariants[prefix] || "default";

          return (
            <TableRow key={item.key}>
              <TableCell>
                <button
                  onClick={() => onView(item.key)}
                  className="text-sm font-geist-mono text-ds-gray-900 hover:text-ds-blue-700 transition-colors text-left"
                >
                  {item.key}
                </button>
              </TableCell>
              <TableCell>
                <Badge variant={badgeVariant}>
                  {prefix}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[200px]">
                {item.valuePreview != null ? (
                  <span className="text-xs font-geist-mono text-ds-gray-700 truncate block">
                    {item.valuePreview}
                  </span>
                ) : (
                  <span className="text-xs text-ds-gray-500 italic">null</span>
                )}
              </TableCell>
              <TableCell>
                {(() => {
                  const live = getLiveTtl(item.ttl, elapsed);
                  return (
                    <span className={`text-xs font-geist-mono ${getTtlColor(live)}`}>
                      {formatTtl(live)}
                    </span>
                  );
                })()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(item.key)}
                  >
                    View
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(item.key)}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
