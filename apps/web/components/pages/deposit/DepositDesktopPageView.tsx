"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BasicPoolDepositDesktopView } from "./BasicPoolDepositDesktopView";
import { ConcentratedPoolDepositDesktopView } from "./ConcentratedPoolDepositDesktopView";

function DepositLoading() {
  const t = useTranslations();
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="flex items-center justify-center py-20">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700"></div>
          <span className="ml-4 text-neutral-700">{t("common.loading")}</span>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/** `/deposit` — current full layout (desktop / wide-viewport source of truth). */
export function DepositDesktopPageView() {
  return (
    <Suspense fallback={<DepositLoading />}>
      <DepositPageContent />
    </Suspense>
  );
}

function DepositPageContent() {
  const searchParams = useSearchParams();

  // Get pool type from query params (-1 or 0 = basic pool, 1+ = concentrated pool)
  const typeParam = searchParams.get("type");
  const poolType = typeParam !== null ? parseInt(typeParam, 10) : 1;
  const isBasicPool = poolType <= 0;

  if (isBasicPool) {
    return <BasicPoolDepositDesktopView />;
  }

  return <ConcentratedPoolDepositDesktopView />;
}
