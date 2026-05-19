import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SelectLockForm } from "@/components/vote/SelectLockForm";

export default function SelectLockPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Suspense>
          <SelectLockForm />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
