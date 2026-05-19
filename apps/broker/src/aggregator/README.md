# Broker Aggregator

This folder is for broker-side value aggregation that runs **after** raw indexed event
persistence in broker DB (`indexed_events`).

Planned outputs:

- OHLCV candles
- account trading records
- pair/token materialization
- derived analytics for gateway consumers

Current runtime entrypoint is `runPostPersistAggregationEntry(payload)` in
`src/rabbitmq/rabbitmq.service.ts`.

## `event/` — gateway push contracts (aggregator-owned)

Types and constants for **post-aggregation** payloads that the broker sends to **`apps/gateway`** (Redis HTTP cache upsert + optional Socket.IO), so wire shapes stay next to aggregation logic rather than only in the emitter package.

| File | Role |
|------|------|
| `event/spot-token-leaderboards-gateway-update.event.ts` | `AGGREGATOR_SPOT_TOKEN_LEADERBOARDS_GATEWAY_UPDATE_EVENT`, room/event names (`SPOT_TOKEN_LEADERBOARDS_GATEWAY_CHANNEL`, `SPOT_TOKEN_LEADERBOARDS_GATEWAY_SOCKET_EVENT`), `SpotTokenLeaderboardsGatewayUpdateEventV1`, and `buildSpotTokenLeaderboardsGatewayUpdateEvent`. |

**Consumers:** `BrokerGatewayHttpCachePublishService` (`apps/broker/src/emitter/`) imports from `aggregator/event` when building `BrokerGatewayHttpCacheUpsertV1.wsEmit.data`.

When you add another aggregator-driven edge update, add a sibling module under `event/`, export it from `event/index.ts`, and publish from the appropriate service after aggregation.

Event-type modules scaffolded:

- `setup/`
- `pool-created/`
- `cl-pool-created/`
- `liquidity-added/`
- `cl-liquidity-added/`
- `swap/`
