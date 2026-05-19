# Broker emitter (on-chain → gateway WebSocket)

When the **indexer RabbitMQ queue** delivers a JSON body, `RabbitmqService` persists it and then runs this **emitter** path in parallel with the legacy `indexer.event` fan-out.

## Flow

1. **RabbitMQ** (`handleIndexerMessage`) parses JSON and calls `IndexerEventsService.onIndexerEvent`, aggregation, then `BrokerGatewayWsFanoutService.fanOutFromIndexerPayload(parsed)`.
2. **Router** (`onchain-ws-emits.router.ts`) switches on `payload.type` and delegates to a handler under `contracts/`.
3. Each handler returns one or more **`BrokerGatewayWsEmitV1`** objects (`@giwater/shared`): `{ schema, channel, event, data }`.
4. **`RabbitmqService.publishToGateway`** publishes each emit to the configured routing key (`gatewayWsEmitRoutingKey`, default `broker.ws.emit`) on the gateway topic exchange.
5. **Gateway** consumes all broker notifications (binding `#` by default), detects `schema === broker.gateway.ws.emit/v1`, and emits `event` with `data` to Socket.IO room `channel`.
6. Still in `handleIndexerMessage`, after step 1–5 path above, **`BrokerGatewayHttpCachePublishService.publishAfterIndexerFanout(parsed)`** may publish an additional message (today: after **`Swap`** aggregation only) — see [HTTP cache messages](#http-cache-messages-rabbitmq--gateway-redis).

## HTTP cache messages (RabbitMQ → gateway Redis)

The same **gateway topic exchange** and **`gatewayWsEmitRoutingKey`** carry structured messages that are **not** Socket.IO emits by themselves. The gateway inspects `schema` and handles each shape before falling back to legacy `notify`.

| Schema (`@giwater/shared`) | Producer | Purpose |
|----------------------------|----------|---------|
| `broker.gateway.http-cache-invalidate/v1` | `onchain-http-cache-invalidate.router.ts` via `BrokerGatewayWsFanoutService` | `SCAN` + `UNLINK` Redis keys whose internal cache key matches each `keyPrefix` (e.g. `GET:/indexed-events`). Does **not** broadcast to clients. |
| `broker.gateway.http-cache-upsert/v1` | `BrokerGatewayHttpCachePublishService` | **SET** precomputed GET response bodies under exact keys `GET:${originalUrl}` (envelope matches gateway `HttpCacheInterceptor`). Optional **`wsEmit`** (`BrokerGatewayWsEmitV1`) is applied **after** Redis writes so room subscribers get a push without a follow-up broker RPC. |

**Swap leaderboard warm path:** after indexer fan-out (including invalidation), `publishAfterIndexerFanout` reloads default spot-token leaderboard pages from `SpotCatalogService`, builds the upsert DTO, and sets Socket payload from **`aggregator/event/`** (`SpotTokenLeaderboardsGatewayUpdateEventV1` and `buildSpotTokenLeaderboardsGatewayUpdateEvent`).

## Channel naming

Clients **join** these room names via the gateway `channels.subscribe` message (see gateway `WsClientChannelsService`):

| Prefix   | Example                      | Used for                                      |
|----------|------------------------------|-----------------------------------------------|
| `pair:`  | `pair:0xabc…`                | Pool / pair address (`PoolCreated`, `CLPoolCreated`) |
| `token:` | `token:0xabc…`             | Token address (all on-chain event types)      |
| `spot-tokens:` | `spot-tokens:leaderboards` | Aggregator-driven catalog snapshot (HTTP cache upsert `wsEmit`; see `aggregator/event/`) |

Liquidity and swap payloads without a pool address are emitted on **`token:`** channels only.

## Socket.IO event names

Handlers use namespaced names such as:

- `onchain.PoolCreated`
- `onchain.CLPoolCreated`
- `onchain.LiquidityAdded`
- `onchain.CLLiquidityAdded`
- `onchain.Swap`

Catalog / read-model (aggregator warm path, not raw indexer log type):

- `catalog.spotTokenLeaderboards` — room `spot-tokens:leaderboards`; payload `kind` is `aggregator.spotTokenLeaderboardsGatewayUpdate/v1` (see `aggregator/event/`).

## Adding a new on-chain type

1. Extend `IndexerBrokerQueuePayload` in `@giwater/shared` if the indexer adds a new `type`.
2. Add `contracts/<name>.emitter.ts` exporting `build…Emits(payload): BrokerGatewayWsEmitV1[]`.
3. Register the `type` branch in `onchain-ws-emits.router.ts`.

## Legacy broadcast

The broker still publishes the wrapped `{ source: 'indexer', receivedAt, payload }` message on `gatewayIndexerRoutingKey`. The gateway continues to broadcast that shape as the Socket.IO event **`notify`** to all connected clients. Prefer **room subscriptions** for new UI.
