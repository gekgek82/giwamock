# config-service

NestJS microservice that owns all user- and admin-managed configuration data.
It exists alongside the broker but connects to a **separate PostgreSQL database**,
which means broker pruning can never accidentally destroy configuration state.

---

## Why This Service Exists

### The Problem

Before the config-service split, the broker mixed two fundamentally different kinds of data in one database:

| Kind | Examples | Lifecycle |
|------|----------|-----------|
| **Indexer-derived** | `spot_pairs`, `spot_tokens`, swap records, OHLCV candles, LP ticks | Safe to wipe and re-index from the chain at any time |
| **User/admin config** | Banners, referral codes, referral relationships, faucet configs | **Must never be lost** — can only be explicitly edited or migrated |

When the broker database needed to be pruned (rolling deploys, schema conflicts, stale Ponder state), the only safe approach was to enumerate every config table and exclude it manually. That was fragile: any new config table added to the broker would silently become pruneable.

### The Solution

Physically separate the two kinds of data into two services with two databases:

```
Broker DB          — indexer-derived + JOIN-heavy pool config  →  safe to prune
Config DB (this)   — user/admin config                         →  never pruned, never reset
```

Config-service owns its own PostgreSQL database (`CONFIG_DATABASE_URL`), runs its own
TypeORM migrations, and exposes data via the same RabbitMQ RPC pattern as the broker.
The gateway routes requests to the correct service using `resolveBrokerTarget()` from
`@giwater/shared`.

### Plan Reference

The architectural decision and task checklist are in:
- `docs/superpowers/specs/2026-05-17-config-service-split-design.md` — design doc
- `docs/superpowers/plans/2026-05-17-config-service-split.md` — 11-task implementation plan

---

## Database: Config DB

**Connection:** `CONFIG_DATABASE_URL` (separate PostgreSQL instance from broker)  
**Migrations:** TypeORM native, run automatically on startup (`migrationsRun: true`, `synchronize: false`)  
**Initial migration:** `src/migrations/1748100000000-InitialConfigSchema.ts`

### Tables

| Table | Entity | Description |
|-------|--------|-------------|
| `banners` | `BannerEntity` | Admin-managed promotional banners with scheduling, impression/click analytics, and base64 images |
| `referral_codes` | `ReferralCodeEntity` | One referral code per wallet address (e.g. `GW-ABC12345`) |
| `referral_relationships` | `ReferralRelationshipEntity` | Tracks who referred whom (referrer → referee pairs) |
| `referral_tier_badges` | `ReferralTierBadgeEntity` | Special badge grants (KOL, AMBASSADOR, etc.) with grant/expiry timestamps |
| `admin_watched_wallets` | `AdminWatchedWalletEntity` | Admin-labelled wallet addresses for monitoring |
| `token_faucets` | `TokenFaucetEntity` | Testnet faucet registrations (faucet address → token metadata) |

### Migration CLI

```bash
cd apps/config-service

# Run pending migrations
pnpm migration:run

# Generate a new migration after editing an entity
pnpm migration:generate src/migrations/YourMigrationName

# Revert last migration
pnpm migration:revert
```

---

## Data Split: Broker vs Config-Service

### Config-Service owns

These tables live in the **Config DB** and are managed exclusively by config-service:

```
banners
referral_codes
referral_relationships
referral_tier_badges
admin_watched_wallets
token_faucets
```

### Broker owns

Everything else lives in the **Broker DB**. This includes two sub-categories:

**Indexer-derived (safe to prune and re-index):**
```
indexed_events
spot_pairs, spot_tokens
spot_pair_time_buckets, spot_token_time_buckets
swap_liquidity_edges, spot_swaps, broker_swap_hop
swap_bucket_state
ticks, liquidity_histogram_buckets
ve_lock_events, ve_lock_positions
voter_vote_events, voter_vote_positions, voter_reward_claims
spot_accounts, spot_account_liquidity_provisions, spot_account_stake_events
account_balance_time_buckets
spot_exchanges, spot_exchange_time_buckets
```

**JOIN-heavy config (stays in Broker DB, excluded from prune scripts):**
```
spot_pair_admin_meta       — pool admin notes, JOINed with spot_pairs
spot_groups, spot_group_pairs, spot_group_tokens  — pool grouping
broker_dynamic_swap_fee_*  — dynamic fee configuration
broker_pool_factory_fee_defaults
spot_account_follows, spot_account_notifications
```

The JOIN-heavy config stays in the broker because it references broker tables directly and
moving it would require cross-service foreign keys or denormalization.

---

## Request Routing

The gateway decides which RabbitMQ queue to target using `resolveBrokerTarget()` from
`@giwater/shared`. The routing registry is the single source of truth:

```typescript
// packages/shared/src/broker-routing.ts
export const BROKER_ROUTE_REGISTRY = [
  { pattern: /^\/banners(\/|$)/,              target: 'config' },
  { pattern: /^\/referral(\/|$)/,             target: 'config' },
  { pattern: /^\/admin\/watched-wallets(\/|$)/, target: 'config' },
  { pattern: /^\/token-faucets(\/|$)/,        target: 'config' },
  // Everything else → 'broker'
];
```

**Request flow:**

```
Client → Gateway (/api/v1/broker/invoke)
           ↓
   resolveBrokerTarget(path)
           ↓
  ┌────────┴────────┐
  │ 'broker'        │ 'config'
  ↓                 ↓
broker.rpc     config-service.rpc   (RabbitMQ queues)
  ↓                 ↓
Broker DB      Config DB
```

---

## HTTP Endpoints

Config-service exposes a small REST surface (port `3047`) for admin tooling.
Most traffic arrives via the RabbitMQ RPC path above.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/watched-wallets` | List all watched wallets |
| `POST` | `/admin/watched-wallets` | Add a watched wallet |
| `DELETE` | `/admin/watched-wallets/:address` | Remove a watched wallet |
| `GET` | `/token-faucets` | List registered faucets |
| `POST` | `/token-faucets` | Register a faucet |
| `DELETE` | `/token-faucets/:address` | Remove a faucet |

Banners and referrals are served through the gateway RPC path, not direct HTTP.

---

## Environment Variables

```env
PORT=3047
CONFIG_DATABASE_URL=postgres://user:pass@host:5432/giwater_config
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_RPC_QUEUE=config-service.rpc
```

---

## Development

```bash
# From monorepo root
pnpm --filter @giwater/config-service dev

# Or from this directory
pnpm dev
```
