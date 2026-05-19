"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/layout/PageContainer";
import { PointsSection } from "@/components/layout/PointsSection";
import { TokenBalances } from "@/components/layout/TokenBalances";
import { SitePageShell } from "@/components/pages/_lib/SitePageShell";

type QuickAction = {
  key: string;
  href: string;
  label: string;
  variant: "primary" | "outline";
  icon: React.ReactNode;
};

export function HomeMobilePageView() {
  const t = useTranslations();

  const quickActions: QuickAction[] = [
    {
      key: "swap",
      href: "/swap",
      label: t("dashboard.tokenSwap"),
      variant: "primary",
      icon: (
        <svg
          className="w-6 h-6"
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
      ),
    },
    {
      key: "liquidity",
      href: "/liquidity",
      label: t("dashboard.manageLiquidity"),
      variant: "primary",
      icon: (
        <svg
          className="w-6 h-6"
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
      ),
    },
    {
      key: "vote",
      href: "/vote",
      label: t("dashboard.vote"),
      variant: "outline",
      icon: (
        <svg
          className="w-6 h-6"
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
      ),
    },
    {
      key: "portfolio",
      href: "/portfolio",
      label: t("navigation.myPortfolio"),
      variant: "outline",
      icon: (
        <svg
          className="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 7h18M3 12h18M3 17h12"
          />
        </svg>
      ),
    },
  ];

  return (
    <SitePageShell>
      <PageContainer as="main" maxWidth="content" className="flex-1 pt-4 pb-10">
        {/* Testnet banner */}
        <section className="relative overflow-hidden rounded-2xl bg-linear-to-br from-neutral-300 via-neutral-400 to-neutral-300 px-5 py-6">
          <div className="absolute -left-6 top-2 w-20 h-20 bg-white/20 rounded-2xl rotate-12 opacity-50" />
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/15 rounded-full opacity-50" />

          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500 text-white rounded-full body-12-medium">
              <svg
                className="w-3.5 h-3.5"
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
            </span>
            <h1 className="mt-3 heading-6 text-neutral-1000">
              GIWATER DEX 테스트넷
            </h1>
            <p className="mt-1 body-14 text-neutral-800">
              현재 이 프로젝트는{" "}
              <span className="font-bold text-primary-700">테스트 단계</span>
              입니다.
            </p>
          </div>
        </section>

        {/* Quick actions */}
        <section className="mt-5">
          <h2 className="px-1 mb-3 body-14-medium text-neutral-700">
            {t("dashboard.quickActions")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const base =
                "flex flex-col items-center justify-center gap-2 rounded-2xl px-3 py-5 body-14-medium transition-all active:scale-[0.98]";
              const variant =
                action.variant === "primary"
                  ? "bg-primary-100 hover:bg-primary-200 text-neutral-1000"
                  : "bg-white border border-primary-700 text-primary-700 hover:bg-primary-50";
              return (
                <Link
                  key={action.key}
                  href={action.href}
                  className={`${base} ${variant}`}
                >
                  {action.icon}
                  <span className="text-center leading-tight">
                    {action.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Token balances */}
        <section className="mt-6 bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-primary-700 heading-6 mb-3">
            {t("dashboard.tokenBalances")}
          </h2>
          <div className="h-px w-full bg-gray-30 mb-4" />
          <TokenBalances />
        </section>

        {/* Points */}
        <section className="mt-5">
          <PointsSection />
        </section>

        {/* Network info */}
        <section className="mt-5 bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-primary-700 heading-6 mb-3">
            {t("dashboard.networkInfo")}
          </h2>
          <div className="h-px w-full bg-gray-30 mb-4" />
          <dl className="space-y-3">
            <div className="flex justify-between items-center">
              <dt className="text-neutral-700 body-14">
                {t("dashboard.network")}
              </dt>
              <dd className="body-14-medium text-neutral-1000">GIWA Sepolia</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-neutral-700 body-14">
                {t("dashboard.chainId")}
              </dt>
              <dd className="body-14-medium text-neutral-1000">91342</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-neutral-700 body-14">
                {t("dashboard.explorer")}
              </dt>
              <dd>
                <a
                  href="https://sepolia-explorer.giwa.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 body-14-medium text-primary-700 hover:text-primary-800"
                >
                  GiwaScan
                  <svg
                    className="w-3.5 h-3.5"
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
              </dd>
            </div>
          </dl>
        </section>

        {/* Need test tokens */}
        <section className="mt-5 bg-neutral-100 rounded-2xl p-5 border border-neutral-200">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-primary-700 rounded-full flex items-center justify-center shrink-0">
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
            <div className="min-w-0">
              <h3 className="body-14-medium text-primary-700 mb-1">
                {t("dashboard.needTestTokens")}
              </h3>
              <p className="body-12 text-neutral-700 leading-relaxed">
                {t("dashboard.testTokensDescription")}
              </p>
            </div>
          </div>
        </section>
      </PageContainer>
    </SitePageShell>
  );
}
