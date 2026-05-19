"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SitePageShell } from "@/components/pages/_lib/SitePageShell";
import { BasicPoolDepositMobileView } from "./BasicPoolDepositMobileView";
import { ConcentratedPoolDepositMobileView } from "./ConcentratedPoolDepositMobileView";

function DepositMobileLoading() {
  return (
    <SitePageShell className="bg-brand-bg" showFooter={false}>
      <main className="flex-1 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green" />
      </main>
    </SitePageShell>
  );
}

function DepositMobileContent() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  // Mirror the desktop dispatch: -1/0 mean basic (volatile/stable),
  // anything positive is a concentrated tickSpacing.
  const poolType = typeParam !== null ? parseInt(typeParam, 10) : 1;
  const isBasicPool = poolType <= 0;

  if (isBasicPool) {
    return <BasicPoolDepositMobileView />;
  }
  return <ConcentratedPoolDepositMobileView />;
}

export function DepositMobilePageView() {
  return (
    <Suspense fallback={<DepositMobileLoading />}>
      <DepositMobileContent />
    </Suspense>
  );
}
