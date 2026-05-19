import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AllocateVotingPower } from "@/components/vote/AllocateVotingPower";

export default function AllocatePage() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-bg">
      <Header />

      <main className="flex-1">
        <Suspense>
          <AllocateVotingPower />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
