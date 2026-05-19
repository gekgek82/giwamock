# Config Service Split Design

**Date:** 2026-05-17
**Status:** Approved

## Problem

The broker is a single NestJS app managing two distinct categories of data:

1. **Indexer-derived data** — populated by amm-indexer events via RabbitMQ. Safe to wipe and re-derive from on-chain data (e.g. after aggregation logic changes).
2. **Admin/user-managed config data** — banners, referral codes, faucets, watched wallets. Must never be wiped.

Currently, pruning the broker DB to force re-indexing risks destroying admin data. There is no safe way to reset indexer-derived tables without manually excluding protected tables.

## Goal

Physically separate admin/user config data into a standalone `config-service` with its own database. The broker DB becomes safely pruneable. The gateway exposes a unified API endpoint and routes transparently to either service.

## Architecture

```
amm-indexer ──RabbitMQ──▶ broker (indexer DB — safely pruneable)

gateway /api/v1/broker/invoke
  └─ resolveBrokerTarget(path)  ← @giwater/shared BROKER_ROUTE_REGISTRY
       ├─ 'broker'  ──RabbitMQ RPC──▶ broker          (queue: amm-broker.rpc)
       └─ 'config'  ──RabbitMQ RPC──▶ config-service  (queue: config-service.rpc)
```

Both services share the same RabbitMQ instance. Only the RPC queue name differs.

## Table Split

### Stays in broker (indexer-derived + JOIN-heavy config)

Indexer-derived (safely pruneable):
- `indexed_events`, `spot_pairs`, `spot_tokens`, `spot_swaps`, `swap_hops`
- `swap_liquidity_edges`, `swap_bucket_state`, `spot_pair_time_buckets`
- `spot_token_time_buckets`, `spot_exchange_time_buckets`, `spot_exchanges`
- `spot_accounts`, `spot_account_liquidity_provisions`, `spot_account_stake_events`
- `account_balance_time_buckets`, `ticks`, `liquidity_histogram_buckets`
- `ve_lock_events`, `ve_lock_positions`, `voter_vote_events`, `voter_vote_positions`
- `voter_reward_claims`

JOIN-heavy config (stays in broker, excluded from prune):
- `spot_pair_admin_meta` — JOINed with `spot_pairs`
- `spot_group_pairs`, `spot_group_tokens` — JOINed with `spot_pairs`/`spot_tokens`
- `spot_groups` — paired with `spot_group_pairs`/`spot_group_tokens`
- `broker_dynamic_swap_fee_pools`, `broker_dynamic_swap_fee_discounts` — used in swap aggregation pipeline
- `broker_dynamic_swap_fee_globals` — used in aggregation pipeline
- `broker_pool_factory_fee_defaults` — used in PoolCreated aggregation
- `spot_account_follows`, `spot_account_notifications` — user data with account JOINs

### Moves to config-service (standalone, no JOINs)

- `banners`
- `referral_codes`, `referral_relationships`, `referral_tier_badges`
- `admin_watched_wallets`
- `token_faucets`

## Shared Route Registry (`@giwater/shared`)

New file: `packages/shared/src/broker-routing.ts`

```typescript
export type BrokerTarget = 'broker' | 'config';

export const BROKER_ROUTE_REGISTRY: Array<{ pattern: RegExp; target: BrokerTarget }> = [
  { pattern: /^\/banners/, target: 'config' },
  { pattern: /^\/referral/, target: 'config' },
  { pattern: /^\/admin-watched-wallets/, target: 'config' },
  { pattern: /^\/token-faucets/, target: 'config' },
];

export function resolveBrokerTarget(path: string): BrokerTarget {
  return BROKER_ROUTE_REGISTRY.find(({ pattern }) => pattern.test(path))?.target ?? 'broker';
}
```

Exported from `@giwater/shared` index. Both gateway and config-service reference this single source.

## New App: `apps/config-service`

NestJS app mirroring broker's RabbitMQ RPC handler pattern.

```
apps/config-service/src/
  app.module.ts
  main.ts
  config/             — CONFIG_DATABASE_URL, CONFIG_SERVICE_RPC_QUEUE
  rabbitmq/           — consumes 'config-service.rpc', replies via RPC
  gateway-rpc/        — handleRpcEnvelope() — same contract as broker
  api/
    banner/
    referral/
    admin-watched-wallets/
    token-faucets/
  models/
    banner/banner.entity.ts
    referral/*.entity.ts
    admin/admin-watched-wallet.entity.ts
    faucet/token-faucet.entity.ts
  migrations/         — extracted from broker initial migration
```

Environment variables:
- `CONFIG_DATABASE_URL` — new Postgres DB on Railway
- `RABBITMQ_URL` — shared with broker
- `RABBITMQ_RPC_QUEUE` — `config-service.rpc`

## Gateway Changes

### `GatewayRabbitmqService`

Add `rpcToConfigService(envelope)` mirroring `rpcToBroker()` but targeting `CONFIG_SERVICE_RPC_QUEUE`.

New env var: `CONFIG_SERVICE_RPC_QUEUE=config-service.rpc`

### `BrokerProxyController`

```typescript
import { resolveBrokerTarget } from '@giwater/shared';

const target = resolveBrokerTarget(body.path);
const raw = target === 'config'
  ? await this.rabbit.rpcToConfigService({ action: 'apiInvoke', request })
  : await this.rabbit.rpcToBroker({ action: 'apiInvoke', request });
```

## Broker Changes

Remove from broker:
- `BannerModule`, `ReferralModule`, `AdminWatchedWalletsModule`, `TokenFaucetModule`
- Corresponding entities, migrations, controllers, services

Update `prune-indexer-derived.sh` — already correct (does not touch JOIN-heavy config tables).

## Data Migration

One-time Node.js script (`apps/config-service/scripts/migrate-from-broker.ts`):
- Uses `pg` directly (no `pg_dump`/`pg_restore` — not available in Railway containers)
- Reads rows from broker DB tables, inserts into config DB in batches
- Verifies row counts match before proceeding to next table
- Tables to migrate: `banners`, `referral_codes`, `referral_relationships`, `referral_tier_badges`, `admin_watched_wallets`, `token_faucets`
- Drops migrated tables from broker DB only after config-service is confirmed healthy

Environment: requires both `BROKER_DATABASE_URL` and `CONFIG_DATABASE_URL` to be set.

## Railway Deployment

1. Create new Railway service `Giwater Config Service`
2. Add new Postgres database, set `CONFIG_DATABASE_URL`
3. Set `RABBITMQ_URL` (shared), `RABBITMQ_RPC_QUEUE=config-service.rpc`
4. Deploy config-service
5. Run data migration script
6. Update gateway env: add `CONFIG_SERVICE_RPC_QUEUE=config-service.rpc`
7. Deploy gateway with routing changes
8. Remove migrated modules from broker, redeploy broker

### Environment Variable Isolation

**`CONFIG_DATABASE_URL` must only be set on the config-service Railway service.**

Do NOT set it on gateway, broker, or amm-indexer. If `CONFIG_DATABASE_URL` is present in another service's environment, TypeORM will attempt to connect on startup and crash the service with `ECONNREFUSED` — even though that service has no DB module. The root cause in that scenario is always a misconfigured Railway environment, not a code bug.

Each service's required env vars:

| Service | DB env var |
|---------|-----------|
| `config-service` | `CONFIG_DATABASE_URL` ✅ |
| `broker` | `DATABASE_URL` ✅ |
| `gateway` | ❌ none — RabbitMQ only |
| `amm-indexer` | `DATABASE_URL` (Ponder) ✅ |

### `railway.toml` Ownership

Each Railway service must use its own `railway.toml`. The **root `railway.toml` belongs to the gateway service** (the service whose Railway root directory is the monorepo root). Config-service uses `apps/config-service/railway.toml`. If a service accidentally picks up the wrong `railway.toml`, it will run the wrong binary and fail with unrelated errors.

## Error Handling

- If config-service RPC times out, gateway returns 502 (same as broker timeout behavior)
- config-service uses same `RetryableAggregationError` pattern if needed
- During migration window, broker still serves config routes until gateway cutover

## Testing

- Unit: `resolveBrokerTarget()` with all known config and broker paths
- Integration: gateway `/invoke` with config path hits config-service queue
- Smoke: after migration, banner/referral/faucet APIs return same data
