"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { initGatewaySocket, subscribeChannel, unsubscribeChannel } from "@/lib/gatewaySocket";

export interface GatewaySocketContextValue {
  subscribePairChannel: (pool: string) => void;
  unsubscribePairChannel: (pool: string) => void;
}

const GatewaySocketContext = createContext<GatewaySocketContextValue | null>(
  null,
);

function pairChannelName(pool: string): string {
  return `pair:${pool}`;
}

export function GatewaySocketProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void initGatewaySocket();
  }, []);

  const subscribePairChannel = useCallback((pool: string) => {
    subscribeChannel(pairChannelName(pool));
  }, []);

  const unsubscribePairChannel = useCallback((pool: string) => {
    unsubscribeChannel(pairChannelName(pool));
  }, []);

  return (
    <GatewaySocketContext.Provider
      value={{ subscribePairChannel, unsubscribePairChannel }}
    >
      {children}
    </GatewaySocketContext.Provider>
  );
}

export function useGatewaySocket(): GatewaySocketContextValue {
  const ctx = useContext(GatewaySocketContext);
  if (!ctx) {
    throw new Error("useGatewaySocket must be used within GatewaySocketProvider");
  }
  return ctx;
}
