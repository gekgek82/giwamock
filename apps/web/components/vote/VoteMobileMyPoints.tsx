"use client";

import { useTranslations } from "next-intl";
import { useBanner } from "@/hooks/useBanner";
import { useUserPoints } from "@/hooks/useUserPoints";
import { useTPointUserLocks } from "@/hooks/useTPointLocks";
import { formatNumber } from "@/hooks/useIndexerStats";
import { bannerApi } from "@/lib/gatewayBrokerApi";
import { IS_PRE_TGE } from "@/lib/config";

// Mobile My Points panel: points / vePoints summary card + gradient banner.
// CTAs (Lock Now / Go Portfolio) live under the Lock tab of `VoteMobilePageView`
// per the mobile Figma, so this component only renders the data block + banner.

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
      className={`${bg} inline-flex items-center justify-center px-1.5 py-1 rounded-full text-white text-[10px] leading-[12px] font-medium whitespace-nowrap`}
    >
      {children}
    </span>
  );
}

function ValueSkeleton() {
  return <div className="h-5 w-20 bg-gray-30 rounded animate-pulse" />;
}

export function VoteMobileMyPoints() {
  const t = useTranslations();
  const { points, locks, isLoading, isConnected } = useUserPoints();
  const { summary: tpointSummary, isLoading: tpointLoading } =
    useTPointUserLocks();
  const { banners } = useBanner("LOCK");
  const banner = banners[0] ?? null;

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

  return (
    <div className="flex flex-col gap-2.5">
      {/* My Points card */}
      <div className="bg-white rounded-[20px] flex flex-col gap-2 pt-4 pb-4">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center px-4">
            <h2 className="flex-1 body-16-bold text-gray-100">
              {t("vote.myPoints")}
            </h2>
          </div>
          <div className="h-px w-full bg-gray-30" />
        </div>

        {!isConnected ? (
          <p className="body-14-medium text-gray-60 text-center py-2 px-4">
            {t("common.connectWallet")}
          </p>
        ) : (
          <div className="flex flex-col gap-3 px-4">
            {/* Point row */}
            <div className="bg-gray-20 rounded-[20px] p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="body-14-medium text-gray-100">
                  {IS_PRE_TGE ? "tPOINT" : "Point(≈Ter)"}
                </span>
                {lockupAvailable ? (
                  <Badge tone="green10">{t("vote.lockupAvailable")}</Badge>
                ) : null}
              </div>
              {loading ? (
                <ValueSkeleton />
              ) : (
                <span className="body-14-bold text-gray-100 text-right whitespace-nowrap">
                  {formatNumber(pointValue)}
                </span>
              )}
            </div>

            {/* VePoint row */}
            <div className="bg-gray-20 rounded-[20px] p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="body-14-medium text-gray-100">
                  {IS_PRE_TGE ? "vePOINT" : "VePoint"}
                </span>
                {voteAvailable ? (
                  <Badge tone="green10">{t("vote.voteAvailable")}</Badge>
                ) : null}
                {locksCount > 0 ? (
                  <Badge tone="green20">
                    {t("vote.locksCount", { count: locksCount })}
                  </Badge>
                ) : null}
              </div>
              {loading ? (
                <ValueSkeleton />
              ) : (
                <span className="body-14-bold text-gray-100 text-right whitespace-nowrap">
                  {formatNumber(vePointValue)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Gradient banner */}
      {banner && banner.imageMobileUrl ? (
        <MobileBannerLink banner={banner} />
      ) : (
        <DefaultMobileBanner
          title={t("vote.bannerTitle")}
          description={t("vote.bannerDescription")}
        />
      )}
    </div>
  );
}

function MobileBannerLink({
  banner,
}: {
  banner: NonNullable<ReturnType<typeof useBanner>["banners"][number]>;
}) {
  const handleClick = () => {
    bannerApi.recordClick(banner.id);
  };
  const linkProps = banner.linkUrl
    ? {
        href: banner.linkUrl,
        target:
          banner.clickTarget === "NEW_TAB" ? ("_blank" as const) : undefined,
        rel:
          banner.clickTarget === "NEW_TAB" ? "noopener noreferrer" : undefined,
      }
    : {};
  const Tag = banner.linkUrl ? "a" : "div";
  return (
    <Tag
      {...linkProps}
      onClick={handleClick}
      className={`block rounded-[20px] overflow-hidden ${banner.linkUrl ? "cursor-pointer" : ""}`}
    >
      <img
        src={banner.imageMobileUrl!}
        alt=""
        width={390}
        height={120}
        className="w-full h-auto object-cover"
        style={{ aspectRatio: "390/120" }}
      />
    </Tag>
  );
}

function DefaultMobileBanner({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="relative bg-gray-70 rounded-[20px] overflow-hidden h-[120px] flex flex-col items-center justify-center px-4">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 50%, rgba(0,254,162,0.15) 0%, transparent 60%), repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 8px)",
        }}
      />
      <div className="relative flex flex-col items-center text-center gap-2.5">
        <p className="body-14-bold text-gray-10">
          {title} <span className="text-brand-green font-bold">GIWATER</span>
        </p>
        <p className="text-[12px] leading-[18px] font-medium text-gray-30 max-w-[315px]">
          {description}
        </p>
      </div>
    </div>
  );
}
