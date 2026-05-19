"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  GATEWAY_HTTP_URL,
  GATEWAY_PATHS,
  isGatewayConfigured,
} from "@/lib/config";

function normalizeOrigin(url: string): string {
  return url.replace(/\/+$/, "");
}

function joinGatewayPath(origin: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}

export interface GatewayResolvedUrls {
  health: string;
  swaggerDocs: string;
  brokerV1: string;
  brokerPing: string;
  brokerInvoke: string;
}

export interface GatewayContextValue {
  /** Base URL with no trailing slash (HTTP + default Socket.IO origin). */
  httpOrigin: string;
  /**
   * Default origin for `socket.io-client` (`io(socketOrigin, { path: "/socket.io" })` if you override path).
   * Same as `httpOrigin` unless you add a separate env later.
   */
  socketOrigin: string;
  /** Whether `NEXT_PUBLIC_GATEWAY_URL` was set in the build environment. */
  isExplicitEnv: boolean;
  /** Whether `httpOrigin` is non-empty and safe to call. */
  isReady: boolean;
  /** Re-exported path map — use with `joinUrl`. */
  paths: typeof GATEWAY_PATHS;
  /** Pre-built absolute URLs for common routes (empty string if `httpOrigin` is empty). */
  urls: GatewayResolvedUrls;
  /** Absolute URL: `joinUrl('/swap-routes')` → `httpOrigin + /swap-routes`. */
  joinUrl: (path: string) => string;
}

const GatewayContext = createContext<GatewayContextValue | null>(null);

function buildResolvedUrls(origin: string): GatewayResolvedUrls {
  if (!origin) {
    return {
      health: "",
      swaggerDocs: "",
      brokerV1: "",
      brokerPing: "",
      brokerInvoke: "",
    };
  }
  return {
    health: joinGatewayPath(origin, GATEWAY_PATHS.health),
    swaggerDocs: joinGatewayPath(origin, GATEWAY_PATHS.swaggerDocs),
    brokerV1: joinGatewayPath(origin, GATEWAY_PATHS.brokerV1),
    brokerPing: joinGatewayPath(origin, GATEWAY_PATHS.brokerPing),
    brokerInvoke: joinGatewayPath(origin, GATEWAY_PATHS.brokerInvoke),
  };
}

/**
 * Exposes the GiWater gateway base URL (HTTP + Socket.IO) to the client tree.
 * Children can use `useGateway()` for `joinUrl`, `urls`, and `paths`.
 */
export function GatewayProvider({ children }: { children: ReactNode }) {
  const value = useMemo<GatewayContextValue>(() => {
    const raw = GATEWAY_HTTP_URL.trim();
    const httpOrigin = normalizeOrigin(raw);
    return {
      httpOrigin,
      socketOrigin: httpOrigin,
      isExplicitEnv: true,
      isReady: isGatewayConfigured(),
      paths: GATEWAY_PATHS,
      urls: buildResolvedUrls(httpOrigin),
      joinUrl: (path: string) => joinGatewayPath(httpOrigin, path),
    };
  }, []);

  return (
    <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>
  );
}

export function useGateway(): GatewayContextValue {
  const ctx = useContext(GatewayContext);
  if (!ctx) {
    throw new Error("useGateway must be used within GatewayProvider");
  }
  return ctx;
}

/**
 * Like `useGateway` but returns `null` when there is no provider (e.g. tests / storybook).
 */
export function useGatewayOptional(): GatewayContextValue | null {
  return useContext(GatewayContext);
}
