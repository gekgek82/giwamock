"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useBanner } from "@/hooks/useBanner";
import { bannerApi } from "@/lib/gatewayBrokerApi";
import type { ActiveBanner } from "@/types/banner";

const CAROUSEL_INTERVAL_MS = 5000;

interface PageBannerProps {
  page: string;
  pcWidth: number;
  pcHeight: number;
  mobileWidth?: number;
  mobileHeight?: number;
}

function BannerSlide({
  banner,
  pcWidth,
  pcHeight,
  mobileWidth,
  mobileHeight,
  onVisible,
}: {
  banner: ActiveBanner;
  pcWidth: number;
  pcHeight: number;
  mobileWidth?: number;
  mobileHeight?: number;
  onVisible: (id: number) => void;
}) {
  const impressionSent = useRef(false);

  useEffect(() => {
    if (impressionSent.current) return;
    impressionSent.current = true;
    onVisible(banner.id);
  }, [banner.id, onVisible]);

  const handleClick = () => {
    bannerApi.recordClick(banner.id);
  };

  const linkProps = banner.linkUrl
    ? {
        href: banner.linkUrl,
        target: banner.clickTarget === "NEW_TAB" ? ("_blank" as const) : undefined,
        rel: banner.clickTarget === "NEW_TAB" ? "noopener noreferrer" : undefined,
      }
    : {};

  const Tag = banner.linkUrl ? "a" : "div";
  const hasMobile = mobileWidth && mobileHeight && banner.imageMobileUrl;

  return (
    <>
      {banner.imagePcUrl && (
        <Tag
          {...linkProps}
          onClick={handleClick}
          className={`block overflow-hidden rounded-2xl ${banner.linkUrl ? "cursor-pointer" : ""} ${hasMobile ? "hidden md:block" : "hidden md:block"}`}
        >
          <img
            src={banner.imagePcUrl}
            alt=""
            width={pcWidth}
            height={pcHeight}
            className="w-full h-auto object-cover"
            style={{ aspectRatio: `${pcWidth}/${pcHeight}` }}
          />
        </Tag>
      )}
      {hasMobile && (
        <Tag
          {...linkProps}
          onClick={handleClick}
          className={`block overflow-hidden rounded-xl md:hidden ${banner.linkUrl ? "cursor-pointer" : ""}`}
        >
          <img
            src={banner.imageMobileUrl!}
            alt=""
            width={mobileWidth}
            height={mobileHeight}
            className="w-full h-auto object-cover"
            style={{ aspectRatio: `${mobileWidth}/${mobileHeight}` }}
          />
        </Tag>
      )}
    </>
  );
}

export function PageBanner({
  page,
  pcWidth,
  pcHeight,
  mobileWidth,
  mobileHeight,
}: PageBannerProps) {
  const { banners, isLoading } = useBanner(page);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [banners]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % banners.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [banners.length]);

  const handleImpression = useCallback((id: number) => {
    bannerApi.recordImpression(id);
  }, []);

  if (isLoading || banners.length === 0) return null;

  const banner = banners[activeIndex];
  if (!banner) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 mb-6">
      <BannerSlide
        key={banner.id}
        banner={banner}
        pcWidth={pcWidth}
        pcHeight={pcHeight}
        mobileWidth={mobileWidth}
        mobileHeight={mobileHeight}
        onVisible={handleImpression}
      />
      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {banners.map((b, i) => (
            <button
              key={b.id}
              onClick={() => setActiveIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === activeIndex ? "bg-white" : "bg-white/30"
              }`}
              aria-label={`Banner ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
