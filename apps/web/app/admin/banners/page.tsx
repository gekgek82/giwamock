"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import type { AdminBannerInfo, BannerPage } from "@/types/admin";
import toast from "react-hot-toast";
import {
  Button,
  Card,
  CardContent,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/admin/ui";

const PAGE_FILTERS: { value: BannerPage | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "SWAP", label: "Swap" },
  { value: "LIQUIDITY", label: "Liquidity" },
  { value: "LOCK", label: "Lock" },
  { value: "PORTFOLIO", label: "Portfolio" },
];

const STATUS_VARIANT: Record<string, "success" | "warning" | "default"> = {
  SCHEDULED: "warning",
  ACTIVE: "success",
  ENDED: "default",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BannersPage() {
  const [banners, setBanners] = useState<AdminBannerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageFilter, setPageFilter] = useState<BannerPage | "ALL">("ALL");

  const fetchBanners = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const page = pageFilter === "ALL" ? undefined : pageFilter;
      const response = await adminApi.getBanners(page);
      setBanners(response.banners);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load banners");
    } finally {
      setIsLoading(false);
    }
  }, [pageFilter]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const handleDelete = async (id: number) => {
    const banner = banners.find((b) => b.id === id);
    if (
      !confirm(
        `Are you sure you want to delete "${banner?.title}"? This will also remove all images.`
      )
    )
      return;
    try {
      await adminApi.deleteBanner(id);
      toast.success("Banner deleted successfully");
      fetchBanners();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete banner"
      );
    }
  };

  const activeCount = banners.filter((b) => b.status === "ACTIVE").length;
  const scheduledCount = banners.filter(
    (b) => b.status === "SCHEDULED"
  ).length;
  const endedCount = banners.filter((b) => b.status === "ENDED").length;
  const totalImpressions = banners.reduce((sum, b) => sum + b.impressions, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ds-gray-1000">Banner Management</h1>
          <p className="text-sm text-ds-gray-700">
            Manage promotional banners across pages
          </p>
        </div>
        <Link href="/admin/banners/new">
          <Button size="md">
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
            Add Banner
          </Button>
        </Link>
      </div>

      {error && (
        <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-4 text-ds-red-400">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="py-4 px-5">
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Total</p>
            <p className="text-2xl font-semibold text-ds-gray-1000 font-geist-mono">{banners.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5">
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Active</p>
            <p className="text-2xl font-semibold text-ds-green-400 font-geist-mono">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5">
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Scheduled</p>
            <p className="text-2xl font-semibold text-ds-yellow-400 font-geist-mono">{scheduledCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5">
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Ended</p>
            <p className="text-2xl font-semibold text-ds-gray-700 font-geist-mono">{endedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5">
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Impressions</p>
            <p className="text-2xl font-semibold text-ds-blue-400 font-geist-mono">
              {totalImpressions.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {PAGE_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            variant={pageFilter === filter.value ? "primary" : "ghost"}
            size="sm"
            onClick={() => setPageFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8 px-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-16 bg-ds-gray-300 rounded mb-3 last:mb-0 animate-pulse"
              />
            ))}
          </CardContent>
        </Card>
      ) : banners.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-ds-gray-700">No banners found</p>
            <Link
              href="/admin/banners/new"
              className="text-ds-blue-400 hover:text-ds-blue-700 text-sm mt-2 inline-block"
            >
              Create your first banner
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Banner</TableHead>
              <TableHead>Page</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Stats</TableHead>
              <TableHead>Images</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {banners.map((banner) => {
              const needsMobile = banner.page === "LOCK";
              return (
                <TableRow key={banner.id}>
                  {/* Banner Title + thumbnail */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {banner.imagePcUrl ? (
                        <img
                          src={banner.imagePcUrl}
                          alt=""
                          className="w-20 h-8 object-cover rounded border border-ds-gray-400"
                        />
                      ) : (
                        <div className="w-20 h-8 bg-ds-gray-200 rounded border border-ds-gray-400 flex items-center justify-center">
                          <span className="text-[10px] text-ds-gray-600">
                            No image
                          </span>
                        </div>
                      )}
                      <p className="text-sm font-medium text-ds-gray-1000">
                        {banner.title}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="blue">
                      {banner.page}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Badge variant={STATUS_VARIANT[banner.status] || "default"}>
                      {banner.status}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    {banner.startAt && banner.endAt ? (
                      <>
                        <p className="text-xs text-ds-gray-900 font-geist-mono">
                          {formatDate(banner.startAt)}
                        </p>
                        <p className="text-xs text-ds-gray-600 font-geist-mono">
                          ~ {formatDate(banner.endAt)}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-ds-gray-600">
                        Always
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="text-xs space-y-0.5 font-geist-mono">
                      <p className="text-ds-gray-900">
                        {banner.impressions.toLocaleString()} views
                      </p>
                      <p className="text-ds-gray-900">
                        {banner.clicks.toLocaleString()} clicks
                      </p>
                      <p className="text-ds-green-400">CTR {banner.ctr}%</p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${banner.imagePcUrl ? "bg-ds-green-400" : "bg-ds-gray-600"}`}
                        title={
                          banner.imagePcUrl ? "PC image set" : "No PC image"
                        }
                      />
                      <span className="text-xs text-ds-gray-700">PC</span>
                      {needsMobile && (
                        <>
                          <span
                            className={`inline-block w-2 h-2 rounded-full ml-2 ${banner.imageMobileUrl ? "bg-ds-green-400" : "bg-ds-gray-600"}`}
                            title={
                              banner.imageMobileUrl
                                ? "Mobile image set"
                                : "No mobile image"
                            }
                          />
                          <span className="text-xs text-ds-gray-700">
                            Mobile
                          </span>
                        </>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/banners/${banner.id}`}>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(banner.id)}
                        title="Delete banner"
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
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
