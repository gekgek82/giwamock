"use client";

import { PageContainer } from "@/components/layout/PageContainer";
import { SitePageShell } from "@/components/pages/_lib/SitePageShell";

type MobileNotSupportedPlaceholderProps = {
  /** Short label for the route, e.g. "Swap". */
  pageLabel: string;
};

/**
 * Temporary full-route placeholder until a dedicated small-screen layout exists.
 */
export function MobileNotSupportedPlaceholder({
  pageLabel,
}: MobileNotSupportedPlaceholderProps) {
  return (
    <SitePageShell>
      <PageContainer
        as="main"
        maxWidth="content"
        className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-20 text-center"
      >
        <p className="heading-6 text-gray-10">
          {pageLabel} is not available on small screens yet.
        </p>
        <p className="body-14 text-gray-60 max-w-md">
          Please use a larger viewport or resize the window (lg breakpoint and
          up).
        </p>
      </PageContainer>
    </SitePageShell>
  );
}
