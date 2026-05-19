/**
 * Application configuration from environment variables
 *
 * This file exports all environment-based configuration values.
 * Use these instead of hardcoded constants.
 */

// Chain Configuration
export const GIWA_SEPOLIA_CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_GIWA_SEPOLIA_CHAIN_ID || "91342",
  10
);

// Block Explorer URL
export const GIWASCAN_URL =
  process.env.NEXT_PUBLIC_GIWASCAN_URL || "https://sepolia-explorer.giwa.io";

export const INDEXER_API_URL = "/api/gateway";

/**
 * Gateway parity base.
 *
 * Client-side calls should go through the same-origin proxy (`/api/gateway/*`)
 * so the upstream gateway URL is server-only.
 */
export const GATEWAY_HTTP_URL = "/api/gateway";

/**
 * Broker admin API is server-only for local development.
 *
 * Browser must call `/api/broker-admin/*` (same-origin) to avoid CORS.
 * Next.js proxies to the upstream broker admin origin via `BROKER_ADMIN_URL`.
 */
export const BROKER_ADMIN_PROXY_BASE = "/api/broker-admin";

/**
 * Config-service admin API proxy base.
 * Routes banner/referral-admin/faucets/watched-wallets config writes.
 */
export const CONFIG_ADMIN_PROXY_BASE = "/api/config-admin";

/**
 * Pathnames on the gateway origin (no host). Use with `joinUrl` from `useGateway()`.
 * Parity routes (`/swap-routes`, `/contracts`, …) sit at the root; health/docs/broker RPC are under `/api/*`.
 */
export const GATEWAY_PATHS = {
  health: "/api/health",
  swaggerDocs: "/api/docs",
  brokerV1: "/api/v1/broker",
  brokerPing: "/api/v1/broker/ping",
  brokerInvoke: "/api/v1/broker/invoke",
} as const;

/** True when the gateway base URL is non-empty (set env in production). */
export function isGatewayConfigured(): boolean {
  return true;
}

// Pre-TGE mode: use offchain tPOINT locking instead of onchain TER locking
export const IS_PRE_TGE = process.env.NEXT_PUBLIC_PRE_TGE === "true";

/**
 * When true, `apiFetch` (in `@/lib/apiClient`) short-circuits API calls and
 * returns canned responses from `@/lib/mocks` instead of hitting gateway /
 * broker / indexer. Used for design preview without a running backend.
 *
 * The flag is `NEXT_PUBLIC_*` so it ships into the client bundle. The mock
 * data file is tree-shakeable behind this flag.
 */
export const MOCK_DATA_ENABLED = process.env.NEXT_PUBLIC_MOCK_DATA === "true";

// Contract addresses — re-export from shared for convenience
export {
  PERMIT2_ADDRESS,
  UNIVERSAL_ROUTER_ADDRESS,
  WGIWA_ADDRESS,
} from "@giwater/shared/constants";
