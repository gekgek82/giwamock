import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { VotingComplete } from "@/components/vote/VotingComplete";

export default function VoteCompletePage() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-bg">
      <Header />

      <main className="flex-1">
        <Suspense>
          <VotingComplete />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
