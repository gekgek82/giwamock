# Broker server

The **broker** is the service between **`apps/amm-indexer`** and **`apps/gateway`**. It turns raw indexed AMM activity into **trading analytics**—chiefly **OHLCV** (open, high, low, close, volume) candles at many time resolutions—and **persists** that material in a **dedicated trading database** (separate from the indexer’s Postgres). It then **streams** trading data and updates to **gateway** instances so clients get charts and live trading context without querying the indexer directly.

## Role in the platform

| Responsibility | Description |
|----------------|-------------|
| **Read indexed on-chain data** | Consumes or queries **amm-indexer** output (e.g. swaps and liquidity events materialized by Ponder) as the source for aggregation. |
| **OHLCV aggregation** | Scheduled jobs roll raw trades into candles per pool/pair (or other market keys) for each supported interval. |
| **Trading database** | Writes aggregated and derived trading series to a **second database** optimized for charting and API-style reads. |
| **Stream to gateway** | Publishes trading updates (and optionally passes through real-time indexer events) so **gateway** can push WebSockets or similar to connected clients. |

## Railway (monorepo root)

Use these when the Railway service is attached to this **monorepo** (root = repo root), same pattern as `apps/gateway/README.md`.

| Setting | Value |
|--------|-------|
| **Root directory** | Repository root (`.`) |
| **Build command** | `pnpm railway:broker:build` |
| **Start command** | `pnpm railway:broker:start` |

The build runs **`pnpm --filter @giwater/broker build`**, which compiles Nest **and** copies `migrations/*.sql` into **`dist/migrations/`** (required for boot-time SQL). Do not replace it with plain `nest build` alone.

Set **`BROKER_DATABASE_URL`**, RabbitMQ vars from **`apps/broker/.env.example`**, and any **`PORT`** if you expose HTTP. Only set **`SKIP_BROKER_SQL_MIGRATIONS_ON_BOOT=true`** if a separate release step already ran **`pnpm broker:db:migrate`** against the same database.

## OHLCV cron schedule (chart buckets)

Wall-clock OHLCV buckets are advanced by **`SwapOhlcvAggregationService.ensureWallClockBuckets()`**, which iterates **`SWAP_BUCKET_RESOLUTIONS`** in `src/swap-ohlcv/swap-bucket-resolution.ts`:

| Resolution | Meaning |
|------------|---------|
| `1m` | Finest intrabar grid (default **60s** true minute candles); override with env below |
| `1h` | Hour |
| `1d` | Day (UTC calendar) |
| `1w` | Week (Monday UTC) |
| `1mo` | Month (1st UTC) |

**One cron schedule is enough:** each run advances **all five** resolutions for every known pool/token (gap-fill steps catch up if the job was late). **`1h` / `1d` / `1w` / `1mo`** stay calendar-aligned (hour/day/week/month boundaries); only the **`1m`** stream’s **wall-clock step width** is configurable.

| Env | Default | Meaning |
|-----|---------|---------|
| **`SWAP_BUCKET_FINEST_PERIOD_SEC`** | `60` | Seconds per **`1m`** bucket boundary. Use **`300`** when your platform minimum cron is **5 minutes** (e.g. Railway), so finest candles match **5‑minute** periods instead of implying 60 one‑minute buckets between runs. **Do not change** after production data exists without a migration plan — alignment shifts. |

Locally you can run **every minute** plus default `60`. On Railway with **5‑minute** jobs: set **`SWAP_BUCKET_FINEST_PERIOD_SEC=300`** and schedule **`*/5 * * * *`** (UTC).

### In-process cron (default broker)

`BrokerCronService` runs **`@Cron('* * * * *')`** and calls `ensureWallClockBuckets()` unless **`DISABLE_BROKER_OHLCV_CRON=true`**.

### Railway Cron (recommended when broker is always-on)

1. **Cron service** — Railway’s shortest repeat is often **5 minutes**. Schedule **`*/5 * * * *`** (UTC) and set **`SWAP_BUCKET_FINEST_PERIOD_SEC=300`** so the **`1m`** stream matches **5‑minute** buckets (see table above). Start command after build outputs `dist/`:

   ```bash
   node dist/cli/ohlcv-pipeline.main.js
   ```

   Working directory: **`apps/broker`** (same as where `nest build` outputs `dist/`). Set **`BROKER_DATABASE_URL`** (and other broker env) on the cron service.

2. **Main broker service** — Set **`DISABLE_BROKER_OHLCV_CRON=true`** so only Railway Cron advances buckets (avoids duplicate work).

**Monorepo smoke / one-off** (from repo root, after deps + broker build):

```bash
pnpm install --frozen-lockfile && pnpm --filter @giwater/broker build && pnpm ohlcv:broker:pipeline
```

**Cron / repeat runs** (image or `apps/broker` already has `dist/`): `pnpm ohlcv:broker:pipeline` from the monorepo root, or **`node dist/cli/ohlcv-pipeline.main.js`** from **`apps/broker`** with correct env.

### Token `priceUSD*BF` columns (`spot_tokens`)

Live swaps update **`spot_tokens.priceUSD`** (and day metrics) in `SwapOhlcvAggregationService`. The **look-back** fields **`priceUSD1HourBF` / `priceUSD1DayBF` / `priceUSD1WeekBF` / `priceUSD1MonthBF`** are copied from **`spot_token_time_buckets.close`**: for each resolution (**`1h` / `1d` / `1w` / `1mo`**) we take the **latest bucket row whose `bucketStartTs` is strictly before the current UTC-aligned window** — i.e. the most recent **completed** candle the cron graph already wrote — **immediately after** token buckets are updated:

- On each **swap**: **`tokenIn`** / **`tokenOut`** after their OHLCV buckets are merged.
- On **`ensureWallClockBuckets`** (minute cron): every token seen on **`swap_liquidity_edges`**, after that token’s buckets are advanced.

A separate **full-table scan** (same column copy) runs on an interval so **`spot_tokens`** rows that **never** appear on edges still get BF fields when they have bucket history — defaults to once per hour.

| Env | Default | Meaning |
|-----|---------|---------|
| **`DISABLE_SPOT_TOKEN_BF_SYNC`** | unset | Set to `true` to skip all BF copying (incremental + full scan + CLI body). |
| **`SPOT_TOKEN_BF_FULL_SCAN_INTERVAL_SEC`** | `3600` | Seconds between **full** `spot_tokens` BF scans; set **`0`** to disable periodic full scans (incremental + CLI still behave per below). |
| **`SPOT_TOKEN_BF_SYNC_BATCH`** | `400` | Token IDs per chunk when querying buckets / saving (50–2000 clamped). |

**Standalone job (Railway):** from `apps/broker` after build:

```bash
node dist/cli/spot-token-bf-sync.main.js
# or: pnpm spot-token-bf-sync
```

**Semantics:** bucket **`close`** values are **swap-implied ratio** from the OHLCV path; when **`DexUsdQuoteService`** sets **`priceUSD`** to a routed USD value, BF numbers may **not** match the same unit — treat BF as historical candle closes unless you later enrich buckets with USD.

**`spot_pairs`:** there are **no** `priceUSD*BF` columns on pools; ratio history is in **`spot_pair_time_buckets`**.

## Data flow

```mermaid
flowchart TB
  subgraph source [On-chain truth path]
    Chain[Chain]
    Indexer[AMM indexer]
    IdxDB[(Indexer database)]
    Chain --> Indexer --> IdxDB
  end

  subgraph broker [Broker]
    Cron[OHLCV cron jobs]
    TradeDB[(Trading database)]
    IdxDB -->|read swaps / trades| Cron
    Cron -->|write candles + metadata| TradeDB
  end

  subgraph delivery [Clients]
    GW[Gateway]
    Clients[Connected clients]
    TradeDB -->|stream trading updates| GW
    GW --> Clients
```

1. **AMM indexer** ingests router events and stores raw structured rows in its **indexer database**.
2. **Broker** cron workers **pull** (or are triggered after) incremental data from that indexer store—never replacing the indexer as source of truth for raw events.
3. **Broker** writes **OHLCV and related trading aggregates** to the **trading database** only.
4. **Gateway** subscribes to the broker’s outbound channel (e.g. message bus or internal API) and **streams** trading data to end users.

## Real-time path (optional, with RabbitMQ)

If you use **RabbitMQ** for live indexer events (**amm-indexer** → queue → **broker** → **gateway**), the broker can **both** run scheduled OHLCV jobs **and** relay or enrich real-time messages. Gateway then combines **live ticks** with **pre-aggregated candles** from the trading DB. See **`apps/amm-indexer/README.md`** for the indexer → RabbitMQ overview.

### Post-store aggregation entrypoint

Broker ingestion now follows this order for each indexer RabbitMQ message:

1. Parse incoming payload.
2. Persist raw event into broker DB table `indexed_events` (dedup by `id`).
3. Invoke aggregation entrypoint in `RabbitmqService` via `runPostPersistAggregationEntry(payload)`.
4. Forward event to gateway exchange.

The aggregation entrypoint is intentionally called **after** persistence so all downstream
aggregation modules can re-read canonical raw events from broker DB:

- OHLCV candle updates
- account-level trading records
- pair/token materialization
- additional derived analytics

Current status: entrypoint is wired and logs each invocation; per-domain aggregators are TODO.

## Broker database schema (SQL migrations only)

The broker **does not** use TypeORM `synchronize`. Before TypeORM opens, it applies the same
`migrations/*.sql` files as `pnpm db:migrate` (unless `SKIP_BROKER_SQL_MIGRATIONS_ON_BOOT=true`).
Ship a built image that includes `dist/migrations/*.sql` (the default `pnpm --filter @giwater/broker build` copies them).

Postgres DDL is also applied manually via:

```bash
export BROKER_DATABASE_URL='postgresql://USER:PASS@HOST:PORT/DBNAME'
pnpm --filter @giwater/broker db:migrate
# or from repo root:
pnpm broker:db:migrate
```

TypeORM is configured with **`synchronize: false`** (`broker-db.module.ts`). Entities under
`src/models/**` are the logical model. **Any** Postgres shape change — new columns **or** dropped
columns/tables — requires a **new** `migrations/*.sql` file; DDL is applied only from those files
(at broker boot and/or via `pnpm db:migrate`), never from services or RabbitMQ handlers. See
`apps/broker/prompts/broker-db-schema-and-migrations.md`.

**New empty database:** restore from your team’s Postgres baseline (dump / managed snapshot), then
run `db:migrate` for all `migrations/*.sql` in order. Runtime schema is defined only by
`src/models/**` (what the app expects) and `migrations/*.sql` (what Postgres gets); any SQL you
export for ER diagrams must be **generated from** those entities, never fed back as migrations.

### Replay `indexed_events` (backfill `spot_pairs` fee counters)

Re-run persisted rows through `IndexerAggregationService` (same path as live RabbitMQ) after schema
and migrations are applied:

```bash
pnpm --filter @giwater/broker build
pnpm --filter @giwater/broker replay:indexed-events -- --continue-on-error
```

Options: `pnpm --filter @giwater/broker replay:indexed-events -- --help` (`--dry-run`, `--limit`, `--after-created-at`, …).

**Additive replay:** swap aggregation does `totalSwapFeesUsd += feeUsd`. If the broker already incremented those columns and you replay the same swaps again, totals **double**. In that case either use time/id filters on replay, or reset before a full replay:

```sql
UPDATE spot_pairs SET "totalSwapFeesUsd" = 0, "daySwapFeesUsd" = 0;
```

(Only when you accept recomputing from `indexed_events`; coordinate with any UTC-day roll semantics.)

**Troubleshooting: `column … totalSwapFeesUsd does not exist`**

- `synchronize` is **off**; those columns come only from `migrations/*.sql` (boot apply and/or `pnpm broker:db:migrate`).
- If no `*.sql` could be loaded at boot, the broker **throws immediately** with a fix hint (instead of failing on first `find()`).
- Typical causes: Docker/Railway built with **`nest build` only** (skips the `cp` in `pnpm --filter @giwater/broker build`), wrong `WORKDIR` so neither `dist/migrations` nor repo `migrations/` is found, or `SKIP_BROKER_SQL_MIGRATIONS_ON_BOOT=true` while the DB was never migrated.

## Why two databases?

- **Indexer DB** — Optimized for **event-sourced** rows, replay, and Ponder/GraphQL; high write rate from the chain.
- **Trading DB** — Optimized for **time-series** and **chart** queries (indexed by pair, interval, bucket start), bulk reads, and possibly different retention or replicas for analytics.

Keeping them separate avoids heavy aggregation load on the indexer database and lets you scale or tune trading workloads independently.

## Environment variables (illustrative)

Define concrete names in code when the broker is implemented. You will typically need:

| Variable | Purpose |
|----------|---------|
| Indexer DB or API | Connection or base URL to read amm-indexer data (Postgres URL, or Ponder GraphQL/SQL endpoint). |
| Trading DB URL | Postgres (or other) for OHLCV and trading aggregates. |
| RabbitMQ / AMQP | If used: consume indexer events and/or publish to gateway-facing queues. |
| Gateway / bus | Credentials or URLs for pushing streams to gateway workers. |
| `TZ` or explicit UTC | Consistent bucket boundaries for OHLCV. |

## Related apps

- **`apps/amm-indexer`** — Produces raw on-chain AMM records consumed by the broker.
- **`apps/gateway`** — Serves connected clients; receives trading streams from the broker.

## Project layout (when implemented)

```
apps/broker/
├── src/
│   ├── jobs/           # Cron-scheduled OHLCV builders per interval
│   ├── ingest/         # Reads from indexer DB or API
│   ├── trading-db/     # Repositories for trading database writes
│   └── stream/         # Publishes to gateway / message bus
└── README.md
```

This repository directory is a **placeholder** until the broker service is scaffolded; behavior above describes the **intended** architecture.
