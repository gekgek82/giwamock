"use client";

import { useState, useEffect, useRef } from "react";
import { bannerApi } from "@/lib/gatewayBrokerApi";
import type { ActiveBanner } from "@/types/banner";

export function useBanner(page: string): {
  banners: ActiveBanner[];
  isLoading: boolean;
} {
  const [banners, setBanners] = useState<ActiveBanner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const impressionSentIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    impressionSentIds.current = new Set();
    let cancelled = false;

    async function fetchBanners() {
      try {
        const result = await bannerApi.getActiveBanners(page);
        if (cancelled) return;
        setBanners(result);
      } catch {
        if (!cancelled) setBanners([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchBanners();
    return () => {
      cancelled = true;
    };
  }, [page]);

  return { banners, isLoading };
}

export function useRecordBannerImpression(bannerId: number | null | undefined) {
  const impressionSent = useRef(false);

  useEffect(() => {
    if (bannerId == null) return;
    if (impressionSent.current) return;
    impressionSent.current = true;
    bannerApi.recordImpression(bannerId);
  }, [bannerId]);
}
