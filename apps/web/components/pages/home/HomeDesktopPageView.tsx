"use client";

import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/layout/PageContainer";
import { TokenBalances } from "@/components/layout/TokenBalances";
import { PointsSection } from "@/components/layout/PointsSection";
import { SitePageShell } from "@/components/pages/_lib/SitePageShell";

/** Home (`/`) — current full layout (treat as desktop / wide-viewport source of truth). */
export function HomeDesktopPageView() {
  const t = useTranslations();

  return (
    <SitePageShell>
      <PageContainer maxWidth="content" className="mt-4 mb-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-neutral-300 via-neutral-400 to-neutral-300">
          <div className="absolute left-0 top-0 bottom-0 w-1/4 opacity-40">
            <div className="absolute left-4 top-1/4 w-16 h-16 bg-white/30 rounded-lg transform -rotate-12" />
            <div className="absolute left-12 bottom-1/4 w-12 h-20 bg-white/20 rounded-lg transform rotate-6" />
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-1/4 opacity-40">
            <div className="absolute right-4 top-1/3 w-14 h-14 bg-white/30 rounded-full" />
            <div className="absolute right-12 bottom-1/4 w-16 h-16 bg-white/20 rounded-lg transform rotate-12" />
          </div>

          <div className="relative z-10 py-10 px-4 sm:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-full body-14-medium mb-4">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              테스트 단계
            </div>

            <h2 className="heading-4 text-neutral-1000 mb-3">
              GIWATER DEX 테스트넷
            </h2>
            <p className="body-16 text-neutral-800 max-w-2xl mx-auto mb-4">
              현재 이 프로젝트는{" "}
              <span className="font-bold text-primary-700">테스트 단계</span>
              입니다.
            </p>
          </div>
        </div>
      </PageContainer>

      <PageContainer as="main" maxWidth="content" className="flex-1 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-6 shadow-sm h-full">
              <h2 className="text-primary-700 heading-6 mb-4">
                {t("dashboard.tokenBalances")}
              </h2>
              <div className="h-px w-full bg-gray-30 mb-6" />
              <TokenBalances />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-primary-700 heading-6 mb-4">
                {t("dashboard.quickActions")}
              </h2>
              <div className="h-px w-full bg-gray-30 mb-6" />
              <div className="space-y-3">
                <a
                  href="/swap"
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-primary-100 hover:bg-primary-200 text-neutral-1000 rounded-xl body-14-medium transition-all"
                >
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    />
                  </svg>
                  {t("dashboard.tokenSwap")}
                </a>
                <a
                  href="/liquidity"
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-primary-100 hover:bg-primary-200 text-neutral-1000 rounded-xl body-14-medium transition-all"
                >
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.4004 9.82269L21.6004 11.9755L12.0004 16.8963L2.40039 11.9755L6.67715 9.78334M17.4004 14.5268L21.6004 16.6796L12.0004 21.6004L2.40039 16.6796L6.67715 14.4875M12.0004 2.40039L21.6004 7.32114L12.0004 12.2419L2.40039 7.32114L12.0004 2.40039Z"
                    />
                  </svg>
                  {t("dashboard.manageLiquidity")}
                </a>
                <a
                  href="/vote"
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white border border-primary-700 text-primary-700 hover:bg-primary-50 rounded-xl body-14-medium transition-all"
                >
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {t("dashboard.vote")}
                </a>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-primary-700 heading-6 mb-4">
                {t("dashboard.networkInfo")}
              </h2>
              <div className="h-px w-full bg-gray-30 mb-6" />
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-700 body-14">
                    {t("dashboard.network")}
                  </span>
                  <span className="body-14-medium text-neutral-1000">
                    GIWA Sepolia
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-700 body-14">
                    {t("dashboard.chainId")}
                  </span>
                  <span className="body-14-medium text-neutral-1000">91342</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-700 body-14">
                    {t("dashboard.explorer")}
                  </span>
                  <a
                    href="https://sepolia-explorer.giwa.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="body-14-medium text-primary-700 hover:text-primary-800 flex items-center gap-1"
                  >
                    GiwaScan
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-neutral-100 rounded-2xl p-6 border border-neutral-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary-700 rounded-full flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="body-14-medium text-primary-700 mb-1">
                    {t("dashboard.needTestTokens")}
                  </h3>
                  <p className="body-12 text-neutral-700 leading-relaxed">
                    {t("dashboard.testTokensDescription")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <PointsSection />
        </div>
      </PageContainer>
    </SitePageShell>
  );
}
