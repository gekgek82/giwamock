import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AddIncentivePage } from "@/components/vote/AddIncentivePage";

export default async function AddIncentiveRoute({
  params,
}: {
  params: Promise<{ poolAddress: string }>;
}) {
  const { poolAddress } = await params;

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Suspense>
          <AddIncentivePage poolAddress={poolAddress} />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
