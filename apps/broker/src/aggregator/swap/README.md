# Swap aggregation

Thin broker aggregator wrapper around OHLCV + profile materialization for swap
indexer payloads (`SwapIndexerBrokerPayload`).

## Entry point

- **`aggregateSwap`** (`index.ts`) runs **`SwapLiquidityGraphService.onSwap`** first (updates
  `spot_pairs` proxy reserves from the hop), then **`SwapOhlcvAggregationService.onSwap`** in
  `src/swap-ohlcv/swap-ohlcv-aggregation.service.ts`.
- Wired from **`aggregateIndexedEvent`** (`../index.ts`) when `payload.type === 'Swap'`, after
  the raw event is persisted (`indexed_events`).
- After `aggregateIndexedEvent` returns successfully, **`IndexerAggregationService`** appends one
  idempotent row to **`swap_hops`** (per hop) for HTTP `GET /swaps/by-transaction/…` —
  this must stay **after** `aggregateSwap` so pair/token volume, reserves, and OHLCV paths remain
  the single source of truth for trading metrics.

## High-level flow (`onSwap`)

1. **Parse time** — `blockTimestamp` from the payload is converted to unix seconds (UI-safe
   bigint parsing in `bigint-for-ui.ts`).
2. **Resolve pool** — `tokenIn` / `tokenOut` (lowercased) are matched against
   `swap_liquidity_edges` (`SwapLiquidityEdgeEntity`) as `(token0, token1)` in either order.
   The chosen pool address is the lexicographically smallest match when multiple edges exist.
3. **Branch**
   - **Pool found** — full path: pair OHLCV buckets → token OHLCV buckets → `spot_pairs` +
     `spot_tokens` profile refresh.
   - **No pool** — log a warning, run **token-only** bucket advancement (no pair stream), then
     **token-only** profile refresh (no `spot_pairs` row update for that swap).

## Time buckets (OHLCV)

Resolutions are fixed: **`1m` | `1h` | `1d` | `1w` | `1mo`** (`swap-bucket-resolution.ts`). The **`1m`**
stream’s step length defaults to **60s** and can be set to **300s** via **`SWAP_BUCKET_FINEST_PERIOD_SEC`**
(e.g. Railway 5‑minute cron).

- **`alignBucketStart(unixSeconds, resolution)`** — inclusive bucket start in UTC-aligned unix
  seconds. **`1m`** aligns to the finest grid width; **`1h`** to hour; **`1d`** UTC midnight; **`1w`**
  Monday UTC; **`1mo`** 1st of calendar month UTC (month step length for gap math uses `periodSeconds('1mo')`).
- **`bucketEndExclusive(start, resolution)`** — equals **`nextBucketStart(start, resolution)`** so
  each bucket is `[bucketStartTs, bucketEndTs)` half-open.

### Tables

| Table | Role |
| --- | --- |
| `swap_bucket_state` | Per **`kind`** (`pair` \| `token`), **`entityId`** (pool or token address), **`resolution`**: monotonic **`lastBucketIndex`** (starts at 1) and **`lastBucketStartTs`**. Swap path and cron share this so indices stay consistent. |
| `spot_pair_time_buckets` | OHLCV rows per pool + resolution + **`bucketIndex`**; includes `bucketStartTs` / `bucketEndTs`, OHLC, volumes, trade count. |
| `spot_token_time_buckets` | Same idea per **token** + resolution + `bucketIndex` (both `tokenIn` and `tokenOut` get updates per swap). |

### Advancement logic (swap path)

For each resolution, inside a **row-locked** transaction on `swap_bucket_state`:

- If the event time is ahead of the materialized window, **gap-fill** empty buckets (carry
  forward close → open) until the bucket that contains `eventTs`, then **apply** the swap to the
  current bucket (update OHLC / volume / trades).
- Pair buckets use pool address as `entityId` and stable pool metadata from the edge where
  relevant.
- Token buckets run twice per swap: once for **`tokenIn`** (leg `in`) and once for **`tokenOut`**
  (leg `out`).

Implementation: **`advancePairBuckets`** / **`advanceTokenBuckets`** in
`swap-ohlcv-aggregation.service.ts`.

### Cron (`ensureWallClockBuckets`)

`BrokerCronService` calls the same advancement helpers with **`swap === null`** so **current**
UTC windows exist even when there are zero swaps (flat candles). Pair streams use all pools from
distinct `swap_liquidity_edges`; token streams are advanced for tokens seen on those edges.

Higher-timeframe **rollup** from finer buckets (if added later) is separate from this file; the
swap aggregator only **materializes** the per-resolution bucket rows above.

## Profiles (not the candle tables)

After buckets succeed (pool path), **`refreshSpotPairAndTokenProfiles`** updates:

- **`spot_pairs`** — last `price` (base/quote from payload), UTC-day volume and day OHLC /
  day-vs-open delta fields, ATH/ATL, rolling day boundary via `metricsDayStartTs`.
  **`spot_pair_time_buckets`** inserts carry **`close`** (flat OHLC when no swap) **and**
  **`baseLiquidity` / `quoteLiquidity` / `baseLiquidityUSD` / `quoteLiquidityUSD`** from the previous bucket row when opening a new interval (until bucket liquidity is populated elsewhere).
- **`spot_tokens`** — last swap **implied ratio** stored in **`priceUSD`** until a real USD feed
  exists (field reuse), day high/low on that implied series, `dayVolume`, `tradesCount`, ATH/ATL,
  same UTC day roll. **`spot_token_time_buckets`** inserts carry **`tvl` / `tvlUSD`** from the prior
  bucket when opening a new interval (alongside flat **`close`** when there is no swap). Historical **`priceUSD1HourBF`** … **`priceUSD1MonthBF`** are updated by copying
  **`spot_token_time_buckets.close`** (latest **completed** bucket per resolution vs current window; see broker README)
  right after token buckets change (swaps + wall-clock cron), plus an optional periodic full scan.

If there is **no pool**, only **`refreshSpotTokenProfilesOnly`** runs (tokens only).

## Related files

| Area | Path |
| --- | --- |
| Aggregator shim | `apps/broker/src/aggregator/swap/index.ts` |
| Router | `apps/broker/src/aggregator/index.ts` |
| Implementation | `apps/broker/src/swap-ohlcv/swap-ohlcv-aggregation.service.ts` |
| Resolution + alignment | `apps/broker/src/swap-ohlcv/swap-bucket-resolution.ts` |
| BigInt → UI numbers | `apps/broker/src/swap-ohlcv/bigint-for-ui.ts` |
| Nest module | `apps/broker/src/swap-ohlcv/swap-ohlcv.module.ts` |
| Liquidity graph (pool resolution) | `apps/broker/src/swap-liquidity/` |
