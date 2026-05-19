"use client";

import { useParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { IncreaseTPointLockForm } from "@/components/vote/IncreaseTPointLockForm";
import { IS_PRE_TGE } from "@/lib/config";

export default function IncreaseLockPage() {
  const params = useParams<{ id: string }>();
  const lockId = parseInt(params?.id ?? "", 10);

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {IS_PRE_TGE ? (
          <IncreaseTPointLockForm lockId={lockId} />
        ) : (
          <div className="py-12 text-center text-neutral-700 body-14">
            Post-TGE increase-amount flow is not available yet.
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
