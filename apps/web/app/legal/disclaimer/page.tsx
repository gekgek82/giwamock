import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata = {
  title: "Legal Disclaimer",
};

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <h1 className="text-2xl font-bold text-white mb-8">Legal Disclaimer</h1>

        <div className="bg-white/5 rounded-2xl p-6 sm:p-8 space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              No Investment Advice
            </h2>
            <p>
              The information provided on GiwaTer does not constitute investment
              advice, financial advice, trading advice, or any other sort of
              advice. You should not treat any of the content as such. GiwaTer
              does not recommend that any cryptocurrency should be bought, sold,
              or held by you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              Risk Warning
            </h2>
            <p>
              Trading and interacting with decentralized protocols involves
              significant risk. Digital assets are highly volatile and you may
              lose some or all of your funds. You are solely responsible for
              determining whether any investment, strategy, or related
              transaction is appropriate for you based on your personal
              objectives, financial circumstances, and risk tolerance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              Token Listings
            </h2>
            <p>
              GiwaTer operates in an open, permissionless environment where
              anyone can create and list tokens. The listing of a token on
              GiwaTer does not represent an endorsement or guarantee of the
              token&apos;s security, legitimacy, or value. Always do your own
              research (DYOR) before interacting with any token.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              No Warranties
            </h2>
            <p>
              GiwaTer is provided &quot;as is&quot; and &quot;as available&quot;
              without warranty of any kind. We do not guarantee that the
              platform will be uninterrupted, timely, secure, or error-free.
            </p>
          </section>

          <p className="text-gray-500 text-xs pt-4 border-t border-white/10">
            This disclaimer is subject to change. Please check back periodically
            for updates.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
