"use client";

import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MergeTPointLocksForm } from "@/components/vote/MergeTPointLocksForm";
import { IS_PRE_TGE } from "@/lib/config";

export default function MergeLocksPage() {
  const searchParams = useSearchParams();
  const baseParam = searchParams?.get("base");
  const initialBaseLockId = baseParam ? parseInt(baseParam, 10) : undefined;
  const safeInitialBase =
    initialBaseLockId !== undefined && !isNaN(initialBaseLockId)
      ? initialBaseLockId
      : undefined;

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {IS_PRE_TGE ? (
          <MergeTPointLocksForm initialBaseLockId={safeInitialBase} />
        ) : (
          <div className="py-12 text-center text-neutral-700 body-14">
            Post-TGE merge-locks flow is not available yet.
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
