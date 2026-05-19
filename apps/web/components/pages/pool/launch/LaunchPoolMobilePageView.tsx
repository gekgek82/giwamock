"use client";

import { SelectPoolModelSection } from "@/components/pool/launch/SelectPoolModelSection";
import { SelectRelatedPoolMobileSection } from "@/components/pool/launch/SelectRelatedPoolMobileSection";
import { SelectTokensSection } from "@/components/pool/launch/SelectTokensSection";
import { useLaunchPoolForm } from "@/components/pool/launch/useLaunchPoolForm";
import { SitePageShell } from "@/components/pages/_lib/SitePageShell";

export function LaunchPoolMobilePageView() {
  const form = useLaunchPoolForm();

  return (
    <SitePageShell className="bg-brand-bg">
      <main className="flex-1 w-full flex flex-col gap-6 px-4 py-4">
        <SelectTokensSection
          token0={form.token0}
          token1={form.token1}
          isToken0ModalOpen={form.isToken0ModalOpen}
          isToken1ModalOpen={form.isToken1ModalOpen}
          onOpenToken0={() => form.setIsToken0ModalOpen(true)}
          onOpenToken1={() => form.setIsToken1ModalOpen(true)}
          onCloseToken0={() => form.setIsToken0ModalOpen(false)}
          onCloseToken1={() => form.setIsToken1ModalOpen(false)}
          onSelectToken0={(token) => {
            form.setToken0(token);
            form.setIsToken0ModalOpen(false);
          }}
          onSelectToken1={(token) => {
            form.setToken1(token);
            form.setIsToken1ModalOpen(false);
          }}
        />

        {form.bothTokensSelected && (
          <SelectPoolModelSection
            poolCategory={form.poolCategory}
            onSelect={form.setPoolCategory}
          />
        )}

        {form.bothTokensSelected && form.poolCategory !== null && (
          <SelectRelatedPoolMobileSection
            sortedToken0={form.sortedToken0}
            sortedToken1={form.sortedToken1}
            configurationRows={form.configurationRows}
            poolCategory={form.poolCategory}
            isLoadingPools={form.isLoadingPools}
            onDeposit={form.handleDirectDeposit}
          />
        )}
      </main>
    </SitePageShell>
  );
}
