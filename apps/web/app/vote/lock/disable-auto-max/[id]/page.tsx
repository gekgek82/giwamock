"use client";

import { useParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { DisableAutoMaxForm } from "@/components/vote/DisableAutoMaxForm";
import { IS_PRE_TGE } from "@/lib/config";

export default function DisableAutoMaxLockPage() {
  const params = useParams<{ id: string }>();
  const lockId = parseInt(params?.id ?? "", 10);

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {IS_PRE_TGE ? (
          <DisableAutoMaxForm lockId={lockId} />
        ) : (
          <div className="py-12 text-center text-neutral-700 body-14">
            Post-TGE disable Auto-Max flow is not available yet.
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
