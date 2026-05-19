"use client";

import { useParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ExtendTPointLockForm } from "@/components/vote/ExtendTPointLockForm";
import { IS_PRE_TGE } from "@/lib/config";

export default function ExtendLockPage() {
  const params = useParams<{ id: string }>();
  const lockId = parseInt(params?.id ?? "", 10);

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {IS_PRE_TGE ? (
          <ExtendTPointLockForm lockId={lockId} />
        ) : (
          <div className="py-12 text-center text-neutral-700 body-14">
            Post-TGE extend-lock flow is not available yet.
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
