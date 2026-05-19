# TradingView UDF Datafeed — Design Spec

**Date:** 2026-05-13  
**Status:** Approved

---

## Overview

Implement a TradingView UDF (Universal Data Feed) datafeed backed by the broker's `spot_pair_time_buckets` and `spot_token_time_buckets` tables. The datafeed exposes OHLCV chart data for both pairs and tokens through a consistent `/udf/*` route namespace on both the broker and the gateway.

---

## Architecture

```
TradingView charting library
        │  GET /udf/*
        ▼
   Gateway HTTP parity routes (broker-http-parity.controller.ts)
        │  RabbitMQ RPC (apiInvoke)
        ▼
   Broker UDF controller  (apps/broker/src/api/udf/)
        │
        ├─ spot_pair_time_buckets  (PAIR:0x... tickers)
        └─ spot_token_time_buckets (TOKEN:0x... tickers)
```

Both broker and gateway expose the same 5 UDF endpoints. Gateway forwards each to broker via the existing `apiInvoke` RabbitMQ RPC path. No new RabbitMQ queue is needed.

---

## Endpoints

All routes live under the `/udf` prefix on both broker and gateway.

### `GET /udf/config`

Returns datafeed capabilities to the TradingView library.

```json
{
  "supported_resolutions": ["5", "60", "1D", "1W", "1M"],
  "exchanges": [{ "value": "GIWATER", "name": "GiWaTer DEX", "desc": "" }],
  "symbols_types": [
    { "name": "Pair",  "value": "pair"  },
    { "name": "Token", "value": "token" }
  ],
  "supports_search": true,
  "supports_group_request": false,
  "supports_marks": false,
  "supports_timescale_marks": false,
  "supports_time": true
}
```

### `GET /udf/time`

Returns current server unix timestamp as a plain integer (not JSON object).

```
1715600000
```

### `GET /udf/symbols?symbol=<ticker>`

Resolves a ticker string to a full TradingView `SymbolInfo` object.

**Ticker format:**
- `PAIR:0xabc...` → look up `spot_pairs` by address
- `TOKEN:0xabc...` → look up `spot_tokens` by address

**Response (pair example):**
```json
{
  "name": "WETH/USDC",
  "ticker": "PAIR:0xabc...",
  "description": "WETH / USDC",
  "type": "pair",
  "exchange": "GIWATER",
  "listed_exchange": "GIWATER",
  "timezone": "Etc/UTC",
  "session": "24x7",
  "minmov": 1,
  "pricescale": 100,
  "has_intraday": true,
  "has_daily": true,
  "has_weekly_and_monthly": true,
  "supported_resolutions": ["5", "60", "1D", "1W", "1M"],
  "volume_precision": 2,
  "data_status": "streaming"
}
```

`pricescale` is derived from the most recent `close` price: `10^ceil(log10(1/close))`, clamped to `[1, 1e8]`. Falls back to `100` when no data exists yet.

**Error (not found):**
```json
{ "s": "error", "errmsg": "Symbol not found" }
```

### `GET /udf/search?query=<q>&type=<type>&limit=<n>`

Searches for symbols. `type` is required to separate pair and token results.

| Param | Default | Notes |
|-------|---------|-------|
| `query` | `""` | ILIKE match on `symbol`, `baseName`, `quoteName` (pairs) or `symbol`, `name` (tokens) |
| `type` | — | `pair` or `token`; other values return empty array |
| `limit` | `30` | Max 100 |

Applies `listed = true` filter by default.

**Response:**
```json
[
  {
    "symbol": "WETH/USDC",
    "full_name": "GIWATER:WETH/USDC",
    "description": "WETH / USDC",
    "exchange": "GIWATER",
    "ticker": "PAIR:0xabc...",
    "type": "pair"
  }
]
```

### `GET /udf/history?symbol=<ticker>&resolution=<res>&from=<from>&to=<to>[&countback=<n>]`

Returns OHLCV bars for the given ticker and time range.

**Resolution mapping (TV → broker):**

| TV resolution | Broker resolution | Actual period |
|--------------|-------------------|---------------|
| `5` | `1m` | 5 min (cron minimum = 300s) |
| `60` | `1h` | 1 hour |
| `1D` | `1d` | 1 day |
| `1W` | `1w` | 1 week |
| `1M` | `1mo` | 1 month |

**Query logic:**
1. Parse ticker prefix → determine table (`spot_pair_time_buckets` or `spot_token_time_buckets`)
2. Map TV resolution string → broker resolution string
3. Query: `WHERE (pair|token) = address AND resolution = res AND bucketStartTs >= from AND bucketStartTs < to ORDER BY bucketStartTs ASC LIMIT countback`
4. `countback` takes precedence over `from` when both are present (TV standard behaviour): if `countback` is set, shift `from` to `to - countback * periodSeconds(res)`.

**Success response:**
```json
{
  "s": "ok",
  "t": [1700000000, 1700003600],
  "o": [1800.0, 1801.0],
  "h": [1810.0, 1815.0],
  "l": [1795.0, 1798.0],
  "c": [1805.0, 1812.0],
  "v": [50000.0, 62000.0]
}
```

`v` (volume) = `baseVolumeUSD + quoteVolumeUSD` for pairs; `volumeUSD` for tokens.

**No data response:**
```json
{ "s": "no_data" }
```

**Error response:**
```json
{ "s": "error", "errmsg": "<message>" }
```

---

## File Layout

```
apps/broker/src/api/udf/
  udf.controller.ts        # NestJS controller, @Controller('udf')
  udf.service.ts           # Business logic: resolve tickers, query buckets, format responses
  udf.module.ts            # NestJS module, imports SpotCatalogModule + TypeOrmModule for bucket entities

apps/gateway/src/api/broker-http-parity.controller.ts
  # 5 new @Get('udf/*') routes, each forwarding via this.proxy('GET', `/udf/...`, query)

apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts
  # 5 new branches in apiInvoke switch for udf/* paths

packages/shared/src/dto/udf.ts
  # UdfConfigDto, UdfSymbolInfoDto, UdfSearchResultDto, UdfHistoryResponseDto
```

---

## Data Contracts (shared DTOs)

New file: `packages/shared/src/dto/udf.ts`

- `UdfConfigResponseDto` — config endpoint shape
- `UdfSymbolInfoDto` — resolved symbol info
- `UdfSearchResultItemDto` — one search result row
- `UdfHistoryResponseDto` — OHLCV bars (`s`, `t`, `o`, `h`, `l`, `c`, `v`)

All DTOs are plain TypeScript interfaces (no class-validator decorators needed since this is read-only data).

---

## Error Handling

- Unknown ticker prefix → `{ s: "error", errmsg: "Invalid ticker format" }` (HTTP 200, UDF convention)
- Unknown resolution → `{ s: "error", errmsg: "Unsupported resolution" }` (HTTP 200)
- DB entity not found for `symbols` → HTTP 400 `{ s: "error", errmsg: "Symbol not found" }`
- All UDF errors return HTTP 200 with `s: "error"` per TradingView UDF spec (except symbol not found which may 400)

---

## Deployment Order

1. Deploy broker (new `/udf/*` routes live)
2. Deploy gateway (parity routes + updated shared DTOs)

---

## Out of Scope

- `GET /udf/marks` — not implemented
- `GET /udf/timescale_marks` — not implemented  
- Real-time streaming / WebSocket updates — TV polling via REST is sufficient
- Authentication on UDF routes — public read endpoints, same as other broker catalog routes
