"use client";

import { usePathname } from "next/navigation";
import { AdminAuthGuard } from "@/components/admin/AdminAuthGuard";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Sidebar } from "@/components/admin/Sidebar";

/**
 * Per-page confirmation status.
 * Key: path prefix (matched via startsWith, except "/admin" which is exact).
 * Value: { confirmedBy } or null (draft).
 */
const PAGE_CONFIRMATIONS: Record<string, { confirmedBy: string } | null> = {
  "/admin/database": { confirmedBy: "Ross" },
  // Add more as pages get confirmed:
  // "/admin/tokens": { confirmedBy: "Matt" },
};

function getConfirmation(pathname: string): { confirmedBy: string } | null {
  // Try longest prefix match first
  const sorted = Object.keys(PAGE_CONFIRMATIONS).sort(
    (a, b) => b.length - a.length
  );
  for (const prefix of sorted) {
    if (prefix === "/admin") {
      if (pathname === "/admin") return PAGE_CONFIRMATIONS[prefix] ?? null;
    } else if (pathname.startsWith(prefix)) {
      return PAGE_CONFIRMATIONS[prefix] ?? null;
    }
  }
  return null; // not in the map = draft
}

export function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const confirmation = getConfirmation(pathname);

  return (
    <AdminAuthGuard requiredRole="ADMIN">
      <div className="flex flex-col h-screen bg-ds-background-100 text-ds-gray-900">
        {/* Top Header - full width */}
        <AdminHeader />

        {/* Body - sidebar + content */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto p-8">
            {confirmation ? (
              <div className="mb-6 bg-ds-green-700/10 border border-ds-green-700/20 rounded-lg px-4 py-3 flex items-center gap-3">
                <svg
                  className="w-4 h-4 text-ds-green-400 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-ds-green-400">
                  <span className="font-medium">Confirmed</span> — verified by{" "}
                  {confirmation.confirmedBy}
                </p>
              </div>
            ) : (
              <div className="mb-6 bg-ds-yellow-700/10 border border-ds-yellow-700/20 rounded-lg px-4 py-3 flex items-center gap-3">
                <svg
                  className="w-4 h-4 text-ds-yellow-400 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-ds-yellow-400">
                  <span className="font-medium">Draft</span> — this page has
                  not yet been confirmed.
                </p>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>
    </AdminAuthGuard>
  );
}
