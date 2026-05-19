"use client";

import dynamic from "next/dynamic";

// Dynamically import Providers with SSR disabled to prevent
// WalletConnect from accessing indexedDB during server rendering
const Providers = dynamic(
  () => import("@/context/Providers").then((m) => m.Providers),
  { ssr: false }
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
