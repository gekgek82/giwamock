# Gateway vs `apps/api` (Nest indexer API)

This document maps **what the GiWater Gateway already exposes** (broker HTTP parity + edge health) versus **what still lives only in `apps/api`** (NestJS on port 3044, documented in `docs/API.md`). It ends with a **practical phase plan** if the goal is to retire `apps/api` for browser-facing traffic.

**Browser convention:** the web app calls the gateway through the Next.js same-origin proxy **`/api/gateway/*`**, which forwards to the configured gateway origin (e.g. `https://gateway.giwater.finance`). `apps/web/lib/gatewayBrokerApi.ts` uses base URL `/api/gateway` so paths below are **relative to the gateway app** (not prefixed with `/api/gateway` in the gateway service itself).

---

## 1. Gateway (`apps/gateway`) — broker parity surface

These routes are implemented on **`BrokerHttpParityController`** (`@Controller()` at the gateway root). They RPC to **`apps/broker`** via RabbitMQ (`apiInvoke`), not to `apps/api`.

| HTTP | Path (gateway) | Purpose |
|------|------------------|---------|
| GET | `/health` | Broker parity health (proxied to broker `/health`) |
| GET | `/contracts` | Protocol contract map (shared `CONTRACT_ADDRESSES`; not full Nest `/contracts` token list) |
| GET | `/swap-routes` | Swap path quote over indexed pools |
| GET | `/indexed-events` | Paginated indexed events |
| GET | `/swaps/by-transaction/:txHash` | Swap hops for a tx + account |
| GET | `/admin/pool/:address/time-buckets` | OHLCV-style pair buckets |
| GET | `/admin/exchange/:protocolId/time-buckets` | Exchange-wide buckets |
| POST | `/spot-token-groups` | Create token group |
| POST | `/spot-token-groups/:groupId/tokens` | Add token to group |
| GET | `/spot-token-groups/:groupId/tokens` | List group tokens |
| DELETE | `/spot-token-groups/:groupId/tokens/:tokenAddress` | Remove token |
| GET | `/spot-pair-groups/:groupId/pairs` | List group pairs |
| GET | `/spot-token-groups/:groupId/leaderboard/:metric/:sort` | Token leaderboard |
| GET | `/spot-pair-groups/:groupId/leaderboard/:metric/:sort` | Pair leaderboard |
| GET | `/spot-tokens/by-address/:address` | Token row |
| GET | `/spot-tokens/by-symbol/:symbol` | Token row by symbol |
| GET | `/spot-tokens/leaderboard/:metric/:sort` | Global token leaderboard |
| GET | `/spot-pairs/by-address/:address` | Pair (pool) row |
| GET | `/spot-pairs/by-symbol/:symbol` | Pair by symbol |
| GET | `/spot-pairs/leaderboard/:metric/:sort` | Global pair leaderboard |
| GET | `/spot-tokens/recently-created` | Curated token list |
| GET | `/spot-pairs/recently-created` | Curated pair list (**used by `usePools`**) |
| GET | `/spot-pairs/by-address/:address/cl-dynamic-fee` | CL dynamic fee readout |

**Other gateway controllers**

| Area | Path | Notes |
|------|------|--------|
| Gateway liveness | `GET /api/health` | `HealthController` — gateway only, not broker DB |
| Broker RPC | `GET/POST /api/v1/broker/*` | Ping + generic `invoke` for arbitrary broker paths |

---

## 2. `apps/web` → `indexerApi` (Nest `apps/api` base: `INDEXER_API_URL`)

Each method calls **`apps/api`** at the path shown (no global `/api` prefix on the Nest app). **Gateway parity does not replace these yet**, except where the UI was explicitly switched to `gatewayBrokerApi` / `usePools`.

| Client method | Nest path | On gateway parity today? | Notes |
|---------------|-----------|---------------------------|--------|
| `checkHealth` | `GET /health` | Partial | Gateway has **two** health concepts: `GET /api/health` (gateway) vs `GET /health` (broker parity). |
| `getGlobalStats` | `GET /stats` | No | Needs new parity route or different product source. |
| `getAllPoolsStats` | `GET /pools/stats` | No | Pool list UIs moved to **`GET /spot-pairs/recently-created`**; shape differs from `PoolStats`. |
| `getPoolStats` | `GET /pools/:addr/stats` | No | Deposit / headers still use this when indexer configured. |
| `getAllTokenPrices` | `GET /tokens/prices` | No | Broker has token rows with USD fields; no single “all prices” parity alias in the table above. |
| `getTokenPrice` | `GET /tokens/:addr/price` | No | Could map to `GET /spot-tokens/by-address/:address` with a DTO adapter. |
| `getContractAddresses` | `GET /contracts` | Partial | `gatewayBrokerApi` builds addresses from **`GET /contracts` + token pages**; not identical to Nest DTO. |
| `searchTokens` | `GET /tokens/search?q=` | No | Possible direction: broker token query / leaderboard / symbol lookup. |
| `registerToken` | `POST /tokens/register` | No | Still Nest-only for registration flow. |
| `getVoteEpoch` | `GET /vote/epoch/current` | No | On-chain / DB epoch logic in API. |
| `getVotePools` | `GET /vote/pools` | No | |
| `getActiveBanners` | `GET /banners/:page` | No | |
| `recordBannerImpression` | `POST /banners/...` | No | |
| `recordBannerClick` | `POST /banners/...` | No | |
| `getLiquidityDistribution` | `GET /pools/:addr/liquidity-distribution` | No | CL depth chart data. |

---

## 3. `apps/web` → `portfolioApi` (same Nest base)

All under **`/portfolio/...`**, **`/tpoint-lock/...`**, **`/lp-stake-intent/...`**, **`/vote-incentive/...`**. These hit **Postgres + TypeORM modules in `apps/api`** (pre-TGE off-chain voting, points, LP stake intent, etc.). **None of this is on the gateway parity controller today.**

Representative paths (see `apps/web/lib/portfolioApi.ts` for the full set):

| Area | Example path | Gateway / broker HTTP parity? |
|------|----------------|----------------------------------|
| Portfolio overview | `GET /portfolio/:wallet/overview` | No |
| Liquidity positions | `GET /portfolio/:wallet/positions/liquidity` | No |
| Locks / votes / points | `GET /portfolio/.../positions/locks|votes|points` | No |
| Claims / notify | `POST /portfolio/.../claim`, `POST /portfolio/notify-transaction` | No |
| tPOINT lock & vote | `/tpoint-lock/*` | No |
| LP stake intent | `/lp-stake-intent/*` | No |
| Vote incentive | `/vote-incentive/*` | No |

---

## 4. `apps/api` modules (what you are replacing if you delete the app)

High-level map (controllers under `apps/api/src`):

| Module group | Role |
|--------------|------|
| `api/v1` — `portfolio`, `pools`, `tokens`, `stats`, `contracts`, `vote`, `banner`, `tpoint-lock`, `lp-stake-intent`, `vote-incentive`, `point`, `season`, `referral` | Public HTTP API consumed by `apps/web` |
| `modules/admin/*` | Admin UI / ops (often still “real” on-chain admin in CLAUDE.md) |
| `modules/webhook` | Inbound webhooks (e.g. Nodit) |
| `modules/indexer/*` | Sync / processing services tied to the API process |
| `health` | Nest health with DB/Redis checks |

Until every **row** in sections 2–3 has a **supported replacement** (gateway parity, broker-native, or a new service), **`apps/api` cannot be removed**.

---

## 5. Migration roadmap (recommended order)

**Phase A — Already aligned (reference)**  
- Curated pool lists and broker-derived pool metrics for liquidity / launch / deposit pool picker via **`spot-pairs/recently-created`** and `gatewayBrokerApi` / `usePools`.

**Phase B — Read-only indexer reads without Nest**  
For each `indexerApi` caller, either:  
- add a **gateway parity** route that RPCs the broker or a read replica, or  
- **adapt** an existing broker route (e.g. pair by address for single-pool stats) and change the web client.

Priority candidates: `getPoolStats`, `getContractAddresses` parity with Nest response shape, `searchTokens` / token price for swap UI.

**Phase C — Aggregates**  
- `getGlobalStats`, `getAllPoolsStats`: define whether totals come from **broker rollups**, **exchange time buckets**, or a **new materialized view** exposed through gateway.

**Phase D — Stateful / wallet APIs (largest effort)**  
- Move **`portfolioApi`** surfaces (and related entities) behind gateway: either embed services in gateway, or run **`apps/api` as a library** invoked from gateway, or split a dedicated **“account API”** service.  
- Keep auth, idempotency, and DB migrations coherent.

**Phase E — Webhooks, jobs, admin**  
- Repoint deployments (`scripts/dev.sh`, Docker, `ecosystem.config.cjs`) to whatever replaces port 3044.  
- Update `docs/API.md` to describe the new edge only.

**Phase F — Remove `apps/api`**  
- Only after no workspace package and no script references `@giwater/api`, and production traffic no longer hits Nest routes.

---

## 6. Quick decision matrix

| If you need… | Use today |
|--------------|-----------|
| Listed pairs / tokens, swap routes, CL dynamic fee, OHLC buckets | **Gateway** (`/api/gateway/...` from web) |
| Portfolio, tPOINT, LP stake intent, vote incentives, banners, Nest pool stats | **`apps/api`** (`NEXT_PUBLIC_INDEXER_API_URL` / port 3044) |
| Raw broker tables not exposed on gateway | **`apps/broker`** (usually via gateway RPC `api/v1/broker/invoke` or new parity route) |

---

*Last updated to reflect gateway `BrokerHttpParityController` and web clients `indexerApi` / `portfolioApi` as of the repo state when this file was added.*
