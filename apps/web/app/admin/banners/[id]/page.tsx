"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { adminApi } from "@/lib/adminApi";
import { BannerEditor } from "@/components/admin/banners/BannerEditor";
import type { AdminBannerInfo } from "@/types/admin";

export default function EditBannerPage() {
  const params = useParams();
  const id = Number(params.id);
  const [banner, setBanner] = useState<AdminBannerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await adminApi.getBanner(id);
        setBanner(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load banner");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-ds-gray-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !banner) {
    return (
      <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-6 text-ds-red-400 text-center">
        {error || "Banner not found"}
      </div>
    );
  }

  return <BannerEditor banner={banner} />;
}
