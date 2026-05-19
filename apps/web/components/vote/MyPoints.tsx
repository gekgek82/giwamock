"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useUserPoints } from "@/hooks/useUserPoints";
import { useTPointUserLocks } from "@/hooks/useTPointLocks";
import { useBanner } from "@/hooks/useBanner";
import { bannerApi } from "@/lib/gatewayBrokerApi";
import { IS_PRE_TGE } from "@/lib/config";
import { formatNumber } from "@/hooks/useIndexerStats";
import { Button } from "@/components/common/Button";
import { PageHeader } from "@/components/common/PageHeader";

function InfoIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-50"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="8" cy="5" r="0.85" fill="currentColor" />
      <path
        d="M8 7.5v4"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "green10" | "green20";
  children: React.ReactNode;
}) {
  const bg = tone === "green10" ? "bg-green-10" : "bg-green-20";
  return (
    <span
      className={`${bg} inline-flex items-center justify-center px-1.5 py-1 rounded-full text-white text-[12px] leading-[18px] font-medium whitespace-nowrap`}
    >
      {children}
    </span>
  );
}

export function MyPoints() {
  const t = useTranslations();
  const { points, locks, isLoading, isConnected } = useUserPoints();
  const { summary: tpointSummary, isLoading: tpointLoading } =
    useTPointUserLocks();

  const pointValue = IS_PRE_TGE
    ? Math.max(
        0,
        parseFloat(points?.onChainBalance ?? "0") -
          parseFloat(tpointSummary?.totalLocked ?? "0"),
      ).toString()
    : (points?.onChainBalance ?? "0");
  const vePointValue = IS_PRE_TGE
    ? (tpointSummary?.totalVotingPower ?? "0")
    : (points?.vePoints ?? "0");
  const locksCount = IS_PRE_TGE
    ? (tpointSummary?.totalLocks ?? 0)
    : (locks?.summary?.totalLocks ?? 0);
  const lockupAvailable = parseFloat(pointValue) > 0;
  const voteAvailable = locksCount > 0;
  const loading = isLoading || (IS_PRE_TGE && tpointLoading);
  const { banners } = useBanner("LOCK");
  const banner = banners[0] ?? null;

  const Skeleton = () => (
    <div className="h-7 w-32 bg-gray-30 rounded animate-pulse" />
  );

  return (
    <div className="flex flex-col gap-2.5">
      {/* My Points Card */}
      <div className="bg-gray-10 rounded-[40px] flex flex-col items-center gap-5 pt-[30px] pb-[30px]">
        <PageHeader title={t("vote.myPoints")} size="lg" />

        {!isConnected ? (
          <div className="w-[610px] max-w-full text-center py-4">
            <p className="body-14 text-gray-60">{t("common.connectWallet")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-[25px] items-start w-[610px] max-w-[calc(100%-40px)]">
            {/* Point (tPOINT / Ter) */}
            <div className="bg-gray-20 rounded-[20px] px-[30px] py-[35px] flex items-center justify-between w-full">
              <div className="flex gap-3 items-center flex-wrap">
                <div className="flex gap-1 items-center">
                  <span className="body-16-medium text-gray-100">
                    {IS_PRE_TGE ? "tPOINT" : "Point(≈Ter)"}
                  </span>
                  <span className="inline-flex items-center justify-center bg-gray-20 rounded-full p-1 size-4">
                    <InfoIcon />
                  </span>
                </div>
                {lockupAvailable && (
                  <Badge tone="green10">{t("vote.lockupAvailable")}</Badge>
                )}
              </div>
              {loading ? (
                <Skeleton />
              ) : (
                <span className="text-[24px] leading-[36px] font-bold text-gray-100 text-right whitespace-nowrap">
                  {formatNumber(pointValue)}
                </span>
              )}
            </div>

            {/* VePoint */}
            <div className="bg-gray-20 rounded-[20px] px-[30px] py-[35px] flex items-center justify-between w-full">
              <div className="flex gap-3 items-center flex-wrap">
                <div className="flex gap-1 items-center">
                  <span className="body-16-medium text-gray-100">
                    {IS_PRE_TGE ? "vePOINT" : "VePoint"}
                  </span>
                  <span className="inline-flex items-center justify-center bg-gray-20 rounded-full p-1 size-4">
                    <InfoIcon />
                  </span>
                </div>
                <div className="flex gap-1 items-center">
                  {voteAvailable && (
                    <Badge tone="green10">{t("vote.voteAvailable")}</Badge>
                  )}
                  {locksCount > 0 && (
                    <Badge tone="green20">
                      {t("vote.locksCount", { count: locksCount })}
                    </Badge>
                  )}
                </div>
              </div>
              {loading ? (
                <Skeleton />
              ) : (
                <span className="text-[24px] leading-[36px] font-bold text-gray-100 text-right whitespace-nowrap">
                  {formatNumber(vePointValue)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lock CTA */}
      <div className="bg-gray-10 rounded-[40px] p-[30px] flex items-center gap-5">
        <p className="flex-1 body-16-bold text-gray-100">
          {t("vote.lockMore")}
        </p>
        <Link href="/vote/lock" className="shrink-0">
          <Button variant="primary" size="lg" className="w-[120px]!">
            {t("vote.lockNow")}
          </Button>
        </Link>
      </div>

      {/* Go Portfolio */}
      <div className="bg-gray-10 rounded-[40px] p-[30px] flex items-center gap-5">
        <p className="flex-1 body-16-bold text-gray-100">
          {t("vote.trackActivePositions")}
        </p>
        <Link href="/portfolio" className="shrink-0">
          <Button variant="primary" size="lg" className="w-auto!">
            {t("vote.goPortfolio")}
          </Button>
        </Link>
      </div>

      {/* Gradient Banner (admin-managed with default fallback) */}
      {banner && banner.imagePcUrl ? (
        <div className="rounded-[40px] overflow-hidden">
          {(() => {
            const handleClick = () => {
              bannerApi.recordClick(banner.id);
            };
            const Tag = banner.linkUrl ? "a" : "div";
            const linkProps = banner.linkUrl
              ? {
                  href: banner.linkUrl,
                  target:
                    banner.clickTarget === "NEW_TAB"
                      ? ("_blank" as const)
                      : undefined,
                  rel:
                    banner.clickTarget === "NEW_TAB"
                      ? "noopener noreferrer"
                      : undefined,
                }
              : {};
            return (
              <>
                <Tag
                  {...linkProps}
                  onClick={handleClick}
                  className={`hidden md:block ${banner.linkUrl ? "cursor-pointer" : ""}`}
                >
                  <img
                    src={banner.imagePcUrl!}
                    alt=""
                    width={670}
                    height={205}
                    className="w-full h-auto object-cover"
                    style={{ aspectRatio: "670/205" }}
                  />
                </Tag>
                {banner.imageMobileUrl && (
                  <Tag
                    {...linkProps}
                    onClick={handleClick}
                    className={`block md:hidden ${banner.linkUrl ? "cursor-pointer" : ""}`}
                  >
                    <img
                      src={banner.imageMobileUrl}
                      alt=""
                      width={390}
                      height={120}
                      className="w-full h-auto object-cover"
                      style={{ aspectRatio: "390/120" }}
                    />
                  </Tag>
                )}
              </>
            );
          })()}
        </div>
      ) : (
        <DefaultBanner
          title={t("vote.bannerTitle")}
          description={t("vote.bannerDescription")}
        />
      )}
    </div>
  );
}

function DefaultBanner({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="relative bg-gray-70 rounded-[40px] overflow-hidden h-[205px] flex flex-col items-center justify-center px-6">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 50%, rgba(0,254,162,0.15) 0%, transparent 60%), repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 8px)",
        }}
      />
      <div className="relative flex flex-col items-center text-center gap-3">
        <p className="text-[24px] leading-[36px] font-bold text-gray-10">
          {title}{" "}
          <span className="text-brand-green font-bold">GIWATER</span>
        </p>
        <p className="body-14-medium text-gray-20 max-w-[560px]">
          {description}
        </p>
      </div>
    </div>
  );
}
