import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CreateLockForm } from "@/components/vote/CreateLockForm";
import { CreateTPointLockForm } from "@/components/vote/CreateTPointLockForm";
import { IS_PRE_TGE } from "@/lib/config";
export default function LockPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {IS_PRE_TGE ? <CreateTPointLockForm /> : <CreateLockForm />}
      </main>

      <Footer />
    </div>
  );
}
