# Rebuild prompt: Broker → RabbitMQ → Gateway (Redis + Socket.IO)

Use this document to **re-implement or verify** the edge path where **`apps/broker`** publishes JSON to a **RabbitMQ topic exchange**, and **`apps/gateway`** consumes it, updates **Redis** (optional), and forwards to **Socket.IO** clients.

## Goals

1. **Durable fan-out** — Every gateway replica must receive broker notifications (per-replica queue bound to the same exchange with a broad binding key, e.g. `#`).
2. **Structured vs legacy** — Prefer typed payloads (`schema` discriminator) over a single undifferentiated broadcast.
3. **HTTP GET cache** — Redis keys `METHOD:originalUrl`; broker may **invalidate** by prefix or **upsert** exact keys + optional room emit.
4. **In-process bridge** — Rabbit consumer must not own Socket.IO `Server`; use a small **app-scoped bus** (RxJS `Subject` + `subscribe`) to forward to `WebSocketGateway`.

## Non-goals / mental model

- **RxJS is not the message queue.** RabbitMQ provides persistence, routing, and at-least-once delivery to consumers.
- **RxJS `Subject` here is not Redux-style state management.** It is an **in-process, singleton-scoped event emitter** (`next` → `subscribe` → `server.emit`). `EventEmitter2` would be equivalent for this usage.
- **Default `Subject` does not replay** missed values to late subscribers; ensure the Socket bridge subscribes **before** notifications are expected (e.g. `afterInit`).

---

## Shared contracts (`@giwater/shared`)

Define and export:

| Type | `schema` / role |
|------|-----------------|
| `BrokerGatewayWsEmitV1` | `broker.gateway.ws.emit/v1` — `{ channel, event, data }` for `server.to(channel).emit(event, data)`. |
| `BrokerGatewayHttpCacheInvalidateV1` | `broker.gateway.http-cache-invalidate/v1` — `{ keyPrefixes: string[] }` matching internal cache keys prefix `GET:/path…`. |
| `BrokerGatewayHttpCacheUpsertV1` | `broker.gateway.http-cache-upsert/v1` — `{ entries: { key, body }[], wsEmit?: BrokerGatewayWsEmitV1 }`. |

Provide type guards: `isBrokerGatewayWsEmitV1`, `isBrokerGatewayHttpCacheInvalidateV1`, `isBrokerGatewayHttpCacheUpsertV1`.

---

## Broker (`apps/broker`)

### RabbitMQ publish helper

- `RabbitmqService.publishToGateway(routingKey, payload)` → `channel.publish(gatewayExchange, routingKey, Buffer.from(JSON.stringify(payload)), …)`.
- **Same routing key** may carry WS emits, cache invalidate, and cache upsert; the gateway discriminates by `schema`.

### Indexer pipeline order (critical)

After persistence + aggregation:

1. `BrokerGatewayWsFanoutService.fanOutFromIndexerPayload(parsed)`  
   - `routeIndexerPayloadToWsEmits` → publish each `BrokerGatewayWsEmitV1`.  
   - `routeIndexerPayloadToHttpCacheInvalidate` → publish invalidate DTO if any.
2. `BrokerGatewayHttpCachePublishService.publishAfterIndexerFanout(parsed)` (when applicable, e.g. `Swap`)  
   - Re-read read model, build **upsert** entries + optional `wsEmit`, publish.

### Aggregator-owned push shapes (optional but recommended)

- Place **broker-side** event/payload constants for gateway pushes under `apps/broker/src/aggregator/event/` (e.g. spot token leaderboards `kind`, Socket `event` name, room name builder).
- Emitter services import from `aggregator/event` when constructing `wsEmit.data`.

### Emitter README

- Document exchange name, routing key env vars, channel naming (`pair:`, `token:`, catalog rooms), and the three `schema` kinds above.

---

## Gateway (`apps/gateway`)

### Config

- **Redis:** `REDIS_URL`, `REDIS_KEY_PREFIX`, `REDIS_HTTP_CACHE_TTL_SEC` (fresh), `REDIS_HTTP_CACHE_STALE_EXTRA_TTL_SEC`, optional `REDIS_HTTP_CACHE_EXCLUDE_URL_PREFIXES`.
- **RabbitMQ:** `RABBITMQ_URL`, `RABBITMQ_GATEWAY_EXCHANGE`, `RABBITMQ_GATEWAY_BINDING_KEY` (e.g. `#`), `RABBITMQ_BROKER_RPC_QUEUE`, `RABBITMQ_RPC_TIMEOUT_MS`.

### Notify consumer (`GatewayRabbitmqService`)

1. Assert **topic** exchange; create an **exclusive/auto-delete queue per replica**; **bind** with `notificationBindingKey`.
2. `consume` → parse JSON → handle in order:
   - If `isBrokerGatewayHttpCacheUpsertV1` → `GatewayHttpCacheUpsertService`: for each entry, `SET` Redis value as **envelope** `{ body, storedAtMs }` with TTL = fresh + stale; if `wsEmit` present, call `GatewayEventsService.emitBrokerNotification(wsEmit)` (do **not** fall through to generic broadcast for the same message).
   - Else if `isBrokerGatewayHttpCacheInvalidateV1` → `GatewayHttpCacheInvalidationService`: `SCAN` + `UNLINK` keys by prefix; **no** Socket.IO for invalidate-only.
   - Else → `emitBrokerNotification(payload)` for legacy / structured WS.

3. **Always `ack`** after handling (success path).

### In-process bus (`GatewayEventsService`)

- Two `Subject`s (or one merged stream):  
  - **Channel path:** if `isBrokerGatewayWsEmitV1(payload)` → `channelWs$.next(payload)`.  
  - **Legacy path:** else → `notify$.next(payload)`.
- Expose `asObservable()` getters for subscribers.

### Socket bridge (`TradingGateway`)

- In `afterInit`, `merge(brokerNotifications, channelWsEmits)` (with `map` tags if desired) → `subscribe`:
  - Legacy → `server.emit('notify', payload)`.
  - Structured → `server.to(emit.channel).emit(emit.event, emit.data)`.
- On destroy, **unsubscribe** the subscription.

### Channel allowlist (`WsClientChannelsService`)

- `channels.subscribe` / `unsubscribe` must **validate** room names before `socket.join` (e.g. regex for `pair:0x…40`, `token:0x…`, plus any catalog rooms like `spot-tokens:leaderboards`).

### HTTP cache interceptor

- Global `APP_INTERCEPTOR` on **GET** only; key = `` `${method}:${originalUrl}` ``; skip paths from config + `@SkipHttpCache()` metadata.
- Store envelope; set `X-Gateway-Http-Cache` header (`HIT` / `STALE` / `MISS`).

---

## Client contract (verification)

1. Connect Socket.IO to gateway.
2. `emit('channels.subscribe', { channels: ['token:0x…'] })` (or allowed catalog room).
3. Trigger broker publish (indexer message or manual `publishToGateway` in dev).
4. Listen for the **exact `event` string** from `BrokerGatewayWsEmitV1` (e.g. `onchain.Swap`).

---

## Rebuild checklist

- [ ] Shared: four guards + three DTO `schema` constants aligned between broker and gateway.
- [ ] Broker + gateway: **same** `RABBITMQ_GATEWAY_EXCHANGE`; broker publish routing key matches gateway binding (topic rules).
- [ ] Gateway: notify queue **per replica**, binding `#` (or stricter pattern if desired).
- [ ] Gateway: `handleBrokerNotify` order — upsert → invalidate → generic emit.
- [ ] Gateway: Redis envelope identical between interceptor `SET` and upsert `SET`.
- [ ] Gateway: `TradingGateway` subscribes in `afterInit` before load-bearing traffic.
- [ ] Run `pnpm --filter @giwater/shared build` then gateway + broker builds.

---

## Related prompts

- [`broker-gateway-api-parity.md`](broker-gateway-api-parity.md) — HTTP-shaped RPC parity.
- [`nest-gateway-client-connection.md`](nest-gateway-client-connection.md) — Socket.IO client wiring.
- `apps/broker/src/emitter/README.md` — broker-side fan-out and cache messages.
