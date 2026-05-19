# indexerApi → Broker/Gateway Migration Design

**Date:** 2026-05-15  
**Scope:** Migrate all `indexerApi` endpoints from the removed `apps/api` backend to `apps/broker` + `apps/gateway`, with no changes to `apps/web/lib/indexerApi.ts` call signatures.

---

## Problem

`apps/api` (NestJS indexer backend) has been removed. `apps/web/lib/indexerApi.ts` still calls 13 endpoints that no longer exist, breaking: pool stats display, token prices, vote epoch, vote pools, banners, and liquidity distribution.

---

## Architecture

```
Web App (indexerApi.ts)
  INDEXER_API_URL = "/api/gateway"
  → GET /api/gateway/stats
  → GET /api/gateway/pools/stats
  → ...
    → Next.js proxy (app/api/gateway/[...path]/route.ts)
      → Gateway (broker-http-parity.controller.ts)
        → Broker HTTP API (new/extended controllers)
          → PostgreSQL (spot_pairs, spot_tokens, voting, liquidity_histogram_buckets, banners)
```

---

## Broker Changes

### 1. New `stats.controller.ts` at `/stats`

**Endpoint:** `GET /stats`  
**Response:** `GlobalStats`  
**Data source:** Aggregate `spot_pairs` → sum `tvl_usd`, `volume_usd_24h`, `volume_usd_7d`, `fees_usd_24h`, `fees_usd_7d`; count rows.

```ts
{
  totalTVL: string;        // sum of spot_pairs.tvl_usd
  totalVolume24h: string;  // sum of spot_pairs.volume_usd_24h
  totalVolume7d: string;
  totalFees24h: string;
  totalFees7d: string;
  poolCount: number;
  updatedAt: string;       // MAX(spot_pairs.updated_at)
}
```

### 2. New `pools.controller.ts` at `/pools`

**Endpoints:**
- `GET /pools/stats` — paginated pool list. Query params: `limit`, `offset`, `sortBy` (tvl|volume24h|fees24h|apr), `sortOrder` (asc|desc).
- `GET /pools/:address/stats` — single pool stats.
- `GET /pools/:address/liquidity-distribution` — liquidity histogram.

**Data sources:**
- Pool stats → `spot_pairs` entity (tvlUsd, volume fields, apr fields, gauge fields, grade).
- Liquidity distribution → `liquidity_histogram_buckets` entity; join with `spot_pairs` for `currentTick`, `currentPrice`, `tickSpacing`.

**Response shapes:** `PoolsStatsResponse`, `PoolStats`, `LiquidityDistributionResponse` from `@giwater/shared`.

### 3. Extend `spot-tokens.controller.ts` at `/tokens`

Add to existing controller (currently under `/spot-tokens`):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tokens/prices` | All token prices → `TokenPricesResponse` |
| GET | `/tokens/:address/price` | Single token price → `TokenPrice` |
| GET | `/tokens/search?q=` | Search by symbol/name → `TokenSearchResponse` |
| POST | `/tokens/register` | Register new token by address → `RegisterTokenResponse` |

**Data source:** `spot_tokens` entity (`priceUsd`, `symbol`, `name`, `address`, `updatedAt`).

> Note: `spot-tokens.controller.ts` stays under its current module. The new `/tokens/*` routes are added as a separate `@Controller('tokens')` class in the same module file, or a sibling file `public-tokens.controller.ts`.

### 4. New `vote-public.controller.ts` at `/vote`

**Endpoints:**
- `GET /vote/epoch/current` → `EpochInfo`
- `GET /vote/pools` → `VotePoolsResponse` (query params: `sortBy`, `search`, `limit`, `offset`)

**Data source:**
- Epoch → `voting` model epoch data (startsAt, endsAt, epochNumber, totalVotingPower, totalFees, totalIncentives).
- Vote pools → join `spot_pairs` + `voter_vote_positions` aggregated by pool; include gauge address, voteWeight, voteShare, fees7d, incentives, APR.

### 5. Already in Broker — Gateway Proxy Only

These exist in `public-banner.controller.ts` (`@Controller('banners')`):
- `GET /banners/:page`
- `POST /banners/:id/impression`
- `POST /banners/:id/click`

---

## Gateway Changes

Add 13 proxy routes to `apps/gateway/src/api/broker-http-parity.controller.ts`:

```
GET  stats
GET  pools/stats
GET  pools/:address/stats
GET  pools/:address/liquidity-distribution
GET  tokens/prices
GET  tokens/:address/price
GET  tokens/search
POST tokens/register
GET  vote/epoch/current
GET  vote/pools
GET  banners/:page
POST banners/:page/impression   (note: broker path is /banners/:id/impression)
POST banners/:page/click
```

Each route calls `this.proxy(method, path, query)` — same pattern as existing routes.

---

## Web App Changes

### `apps/web/lib/config.ts`
```ts
// Before
export const INDEXER_API_URL = "/api/indexer";  // broken

// After
export const INDEXER_API_URL = "/api/gateway";
```

### `apps/web/lib/indexerApi.ts`
```ts
// Before
export function isIndexerConfigured(): boolean {
  return Boolean(INDEXER_API_URL?.trim());
}

// After
export function isIndexerConfigured(): boolean {
  return true; // gateway is always available
}
```

### Environment Variables
- Remove `NEXT_PUBLIC_INDEXER_API_URL` from `.env.example` (no longer needed).
- No new env vars required — broker is reached via `GATEWAY_HTTP_URL`.

---

## Response Type Mapping

All response types come from `@giwater/shared/dto/indexer.ts` — no new types needed. Broker services map entity fields to these shapes.

| Shared Type | Broker Entity | Key Field Mappings |
|-------------|---------------|--------------------|
| `GlobalStats` | `SpotPair` (aggregated) | `tvl_usd→totalTVL`, `volume_usd_24h→totalVolume24h` |
| `PoolStats` | `SpotPair` | `tvl_usd→tvl`, `fee_bps→feeBps`, `grade→grade` |
| `TokenPrice` | `SpotToken` | `price_usd→priceUSD`, `address→address` |
| `EpochInfo` | voting model | epoch timestamps, voting window, totals |
| `LiquidityBar` | `LiquidityHistogramBucket` | `tick_lower`, `tick_upper`, `liquidity` |

---

## Out of Scope

- `portfolioApi` migration (tpoint-lock, lp-stake-intent, vote-incentive) — separate spec.
- Changes to `indexerApi.ts` method signatures or `@giwater/shared` types.
- Admin API endpoints (`/admin/*`).

---

## Success Criteria

1. `pnpm --filter @giwater/gateway exec tsc --noEmit` passes.
2. `pnpm --filter @giwater/broker exec tsc --noEmit` passes.
3. `pnpm --filter @giwater/web exec tsc --noEmit` passes.
4. Pool stats, token prices, banners, and liquidity distribution load correctly in the browser.
5. `NEXT_PUBLIC_INDEXER_API_URL` is removed from `.env.example`.
