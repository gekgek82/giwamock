# Broker ↔ Gateway: shared API + RabbitMQ (extension guide)

## Shared API interface (contract)

**The public contract is one logical API:** whatever you expose on the **broker HTTP server** (`apps/broker` Nest controllers under routes like `/spot-tokens/...`, `/spot-pairs/...`) must behave the **same** when invoked through the **gateway**, which does **not** reimplement business logic.

| Transport | How the client reaches the same behavior |
|-------------|--------------------------------------------|
| **Direct** | HTTP to broker (e.g. `GET /spot-tokens/by-address/0x…`). |
| **Via gateway (HTTP)** | `POST /api/v1/broker/invoke` with body `BrokerGatewayHttpLikeRequest`: `{ "method": "GET", "path": "/spot-tokens/by-address/0x…", "query": {}, "body": null }`. Gateway forwards to broker over **`broker.rpc`**; broker returns `BrokerGatewayRpcResponseDto`; gateway maps errors to HTTP and returns `body` on success. |
| **Via gateway (WebSocket)** | Socket.IO event **`broker.invoke`** with the same JSON shape as `request` above; listen for **`broker.invoke.result`** / **`broker.invoke.error`**. |

**Source of truth for “gateway API”** is still the broker: shared DTOs live in **`@giwater/shared`**; HTTP routes are implemented in **`apps/broker/src/api/**`**; the RabbitMQ mirror is **`GatewayRpcInvokeService`** (`apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts`). When those diverge, the gateway lies to clients—keep them aligned.

### Checklist: adding a new broker HTTP API

1. **Implement** the route in the broker (controller + service), DTOs in **`packages/shared`**, and **`docs/API.md`** if applicable.
2. **Mirror** the same `method`, `path`, `query`, and `body` semantics in **`GatewayRpcInvokeService.invokeHttpLike`** (parse `path` the same way as the HTTP path; return **`BrokerGatewayRpcResponseDto`** with the same `statusCode` and JSON `body` you would return from the controller).
3. **Smoke-test** via gateway: `POST /api/v1/broker/invoke` and, if relevant, **`broker.invoke`** on Socket.IO.
4. (Optional) **Document** the path in **`apps/gateway/README.md`** “Implemented stack” or OpenAPI description on `broker-proxy.controller.ts`.

Gateway maintainers: see also **`apps/gateway/prompts/broker-gateway-api-parity.md`**.

---

## Current RabbitMQ behavior

1. **Gateway → broker** — Messages are sent to the **`broker.rpc`** queue (see `RABBITMQ_BROKER_RPC_QUEUE`) with AMQP `replyTo` + `correlationId`. JSON body uses `BrokerGatewayRpcRequestDto` from `@giwater/shared` (`action: 'ping' | 'apiInvoke'`).
2. **Broker → gateway (reply)** — `RabbitmqService.handleRpcMessage` runs `GatewayRpcInvokeService.handleRpcEnvelope()` and publishes the JSON result to `replyTo`. For `apiInvoke`, the payload is **`BrokerGatewayRpcResponseDto`**: `{ ok, statusCode, body?, error? }`.
3. **Broker → gateway (push)** — Indexer pipeline still uses `publishToGateway(routingKey, payload)` on **`giwater.gateway`** exchange (`RabbitmqService.publishToGateway`). Gateway replicas bind their notification queue with `notificationBindingKey` (e.g. `#`) and fan out to WebSocket clients via `GatewayEventsService`.

### Ordering + race-condition handling (broker-side)

- Indexer queue consumption should preserve dependent event order for the same tx/pool (e.g. `PoolCreated` before `LiquidityAdded`) to avoid aggregator races (`no v2 edge` on liquidity processing).
- Broker consumer concurrency for indexer queue is intentionally constrained (`prefetch(1)` in `RabbitmqService`) so graph upserts happen before dependent liquidity/swap aggregation.
- If a prior deployment processed out-of-order:
  1. Ensure the ordered consumer is deployed.
  2. Re-run/backfill skipped events (especially `LiquidityAdded` rows that logged `no v2 edge`).
  3. Validate recovery with:
     - `GET /indexed-events` contains both `PoolCreated` and `LiquidityAdded` for the tx.
     - `GET /swap-routes` resolves the pair edge.
     - `GET /spot-pairs/by-address/:address?listed=false` shows non-zero TVL/price after replay.

- CL-specific note:
  - `CLLiquidityAdded` will also retry once when its CL edge is temporarily missing (race with `CLPoolCreated`).

## What to add when “gateway receives API from client”

When you want the broker to **push** data to all gateway instances (not only the RPC reply queue), extend the **`apiInvoke`** path in `GatewayRpcInvokeService` (or a dedicated façade) after a successful handler:

1. Choose a **routing key** convention (e.g. `gateway.api.result`, or include a `clientRequestId` from the RPC body for targeted fan-out).
2. Call `RabbitmqService.publishToGateway(routingKey, payload)` with a payload that includes:
   - `correlationId` / `clientRequestId` (echo from gateway),
   - `path` / `method` (echo),
   - `statusCode` and serialized `body` (or error),
   - `source: 'broker-api-fanout'`.
3. In **gateway**, bind a queue to that routing key (or reuse topic patterns) and emit on Socket.IO / SSE so clients waiting on async channels receive the same data as the HTTP `invoke` response.

**Dependency note:** `GatewayRpcInvokeService` does not inject `RabbitmqService` today (avoid circular Nest modules). To publish from inside invoke, either:

- Extract `publishToGateway` into a small **`GatewayPublishService`** in a neutral module imported by both `RabbitmqModule` and `GatewayRpcInvokeModule`, or
- Use `ModuleRef.get(RabbitmqService, { strict: false })` after bootstrap (discouraged), or
- Emit an internal Nest event that `RabbitmqService` subscribes to.

## Endpoint classification: gateway parity vs. broker-only

Every broker HTTP route falls into exactly one of two categories. Decide when you implement the route — it determines whether you need to touch `GatewayRpcInvokeService` and `BrokerHttpParityController`.

| Category | Rule | Who calls it | Files to touch |
|---|---|---|---|
| **Gateway parity** | Public-facing reads and user-initiated writes that the web client or mobile client reaches through the gateway URL. | `NEXT_PUBLIC_INDEXER_API_URL` (via `indexerApi.ts`) or `NEXT_PUBLIC_GATEWAY_URL` | Broker controller + `GatewayRpcInvokeService` + `BrokerHttpParityController` |
| **Broker-only (admin)** | Operator/admin mutations behind `ADMIN_API_URL`. Proxied by Next.js `/api/admin/*` directly to the broker. Never exposed via gateway RPC. | `ADMIN_API_URL` (via `adminApi.ts`) | Broker controller only |

### Gateway parity endpoints (keep `GatewayRpcInvokeService` in sync)

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | |
| GET | `/contracts` | |
| GET | `/swap-routes` | `from`, `to`, `amountIn` query |
| GET | `/indexed-events` | `offset`, `limit` |
| GET | `/spot-tokens/by-address/:address` | |
| GET | `/spot-tokens/by-symbol/:symbol` | |
| GET | `/spot-tokens/leaderboard/:metric/:sort` | |
| GET | `/spot-tokens/recently-created` | |
| GET | `/spot-pairs/by-address/:address` | |
| GET | `/spot-pairs/by-symbol/:symbol` | |
| GET | `/spot-pairs/leaderboard/:metric/:sort` | |
| GET | `/spot-pairs/recently-created` | |
| GET | `/spot-pairs/by-address/:address/cl-dynamic-fee` | optional `sender` query |
| GET | `/spot-token-groups/:groupId/tokens` | |
| GET | `/spot-token-groups/:groupId/leaderboard/:metric/:sort` | |
| GET | `/spot-pair-groups/:groupId/pairs` | |
| GET | `/spot-pair-groups/:groupId/leaderboard/:metric/:sort` | |
| GET | `/accounts/:wallet/lp-positions` | |
| GET | `/accounts/:wallet/stake-positions` | |
| GET | `/ve-locks` | `owner` query |
| GET | `/ve-locks/history` | `owner` query |
| GET | `/ve-locks/:tokenId` | |
| GET | `/ve-locks/:tokenId/history` | |
| GET | `/voting/positions` | `owner` query |
| GET | `/voting/events` | `owner` query |
| GET | `/voting/claimable/:tokenId` | |
| GET | `/voting/claims` | `owner` query |
| GET | `/swaps/by-transaction/:txHash` | `account` query |
| GET | `/udf/config` | |
| GET | `/udf/time` | plain integer response |
| GET | `/udf/symbols` | |
| GET | `/udf/search` | |
| GET | `/udf/history` | |
| GET | `/banners/:page` | active banners for a page |
| POST | `/banners/:id/impression` | record impression |
| POST | `/banners/:id/click` | record click |

### Broker-only (admin) endpoints — do NOT add to gateway

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/admin/banner` | banner CRUD |
| GET/PUT/DELETE | `/admin/banner/:id` | |
| POST/DELETE | `/admin/banner/:id/image/pc` | image upload/delete |
| POST/DELETE | `/admin/banner/:id/image/mobile` | |
| GET/POST | `/admin/faucet` | faucet registry |
| DELETE | `/admin/faucet/:address` | |
| GET | `/admin/lock/stats` | |
| GET | `/admin/lock/events` | |
| GET | `/admin/lock/by-epoch` | |
| GET | `/admin/vote/stats` | |
| GET | `/admin/vote/events` | |
| GET | `/admin/vote/distribution` | |
| GET | `/admin/vote/by-epoch` | |
| GET | `/admin/events` | |
| GET | `/admin/pool/:address/time-buckets` | |
| GET | `/admin/exchange/:protocolId/time-buckets` | |
| POST | `/spot-token-groups` | curation write |
| POST | `/spot-token-groups/:groupId/tokens` | |
| DELETE | `/spot-token-groups/:groupId/tokens/:address` | |

> **Rule of thumb:** if the path starts with `/admin/` or is a mutation that only operators trigger (curation writes), it's broker-only. If web users reach it at runtime, it needs gateway parity.

## RPC handler map (same as HTTP)

HTTP-shaped routing lives in **`apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts`**—this file is the **only** place that translates `BrokerGatewayHttpLikeRequest` into broker service calls. Adding a branch here is **mandatory** whenever you add a broker HTTP route that must be reachable through the gateway; keep responses aligned with **`BrokerGatewayRpcResponseDto`** so the gateway can map `statusCode` to HTTP or WebSocket errors consistently.

## Files to touch

| Area | Path |
|------|------|
| RPC dispatch | `apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts` |
| AMQP ingress / publish helper | `apps/broker/src/rabbitmq/rabbitmq.service.ts` |
| Shared contracts | `packages/shared/src/dto/broker-gateway-rpc.ts` |
| Gateway HTTP | `apps/gateway/src/api/broker-proxy.controller.ts` |
| Gateway RPC client | `apps/gateway/src/rabbitmq/gateway-rabbitmq.service.ts` |
| Gateway WS | `apps/gateway/src/ws/trading.gateway.ts` |
