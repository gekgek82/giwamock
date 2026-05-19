"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { getConfig } from "@/lib/wagmi";
import { Toaster, ToastBar, toast } from "react-hot-toast";
import { useState } from "react";
import { LocaleProvider } from "@/context/LocaleContext";
import { PasswordProtection } from "@/components/PasswordProtection";
import { DataSourceProvider } from "@/lib/datasources/context";
import { GatewayProvider } from "@/context/GatewayContext";
import { GatewaySocketProvider } from "@/context/GatewaySocketProvider";

const config = getConfig();

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      })
  );

  return (
    <PasswordProtection>
      <LocaleProvider>
        <GatewayProvider>
          <GatewaySocketProvider>
          <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
              <RainbowKitProvider modalSize="compact">
                <DataSourceProvider>{children}</DataSourceProvider>
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 5000,
                    style: {
                      background: "#363636",
                      color: "#fff",
                    },
                    success: {
                      duration: 5000,
                      iconTheme: {
                        primary: "#10b981",
                        secondary: "#fff",
                      },
                    },
                    error: {
                      duration: 7000,
                      iconTheme: {
                        primary: "#ef4444",
                        secondary: "#fff",
                      },
                    },
                  }}
                >
                  {(t) => (
                    <ToastBar toast={t}>
                      {({ icon, message }) => (
                        <>
                          {icon}
                          {message}
                          {t.type !== "loading" && (
                            <button
                              onClick={() => toast.dismiss(t.id)}
                              className="ml-2 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                              aria-label="Close"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="currentColor">
                                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                              </svg>
                            </button>
                          )}
                        </>
                      )}
                    </ToastBar>
                  )}
                </Toaster>
              </RainbowKitProvider>
            </QueryClientProvider>
          </WagmiProvider>
          </GatewaySocketProvider>
        </GatewayProvider>
      </LocaleProvider>
    </PasswordProtection>
  );
}
