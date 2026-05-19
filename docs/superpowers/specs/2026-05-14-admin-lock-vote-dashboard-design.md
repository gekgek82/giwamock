# Admin Lock/Vote Dashboard Design

## Overview

Two new admin pages — `/admin/lock` and `/admin/vote` — providing real-time dashboards for VotingEscrow lock activity and per-pair vote allocation. Both pages share the same Layout C structure: a pair sidebar with search on the left and a detail panel on the right.

Data comes from broker Postgres tables (`ve_lock_positions`, `ve_lock_events`, `voter_vote_positions`, `voter_vote_events`) via new broker admin endpoints, forwarded through gateway HTTP parity routes to the Next.js frontend. `apps/api` is not involved.

---

## Section 1: Architecture

```
apps/web                apps/gateway               apps/broker
  /admin/lock   -->  GET /admin/lock/*  -->  AdminLockController
  /admin/vote   -->  GET /admin/vote/*  -->  AdminVoteController
                     (parity proxy)
```

- **Broker** adds two new NestJS controllers under `apps/broker/src/api/`:
  - `admin-lock/admin-lock.controller.ts` + `admin-lock.service.ts`
  - `admin-vote/admin-vote.controller.ts` + `admin-vote.service.ts`
- **Gateway** adds 6 new GET routes in `broker-http-parity.controller.ts` that proxy to these broker endpoints.
- **Frontend** adds two Next.js page files and two shared components, plus adminApi methods.
- **Shared DTOs** live in `packages/shared/src/dto/` and are imported by both broker and web.

---

## Section 2: Backend Endpoints

### 2a. Lock endpoints (broker `AdminLockController` at prefix `/admin/lock`)

| Route | Query params | Description |
|---|---|---|
| `GET /admin/lock/stats` | `pool?` (address) | Aggregate stats for sidebar + stat cards |
| `GET /admin/lock/events` | `pool?`, `limit?`, `offset?` | Paginated ve_lock_events |
| `GET /admin/lock/by-epoch` | `pool?`, `epochs?` (default 8) | Total locked amount per epoch for bar chart |

**`GET /admin/lock/stats` response (`AdminLockStatsDto`):**
```ts
interface AdminLockStatsDto {
  pool: string | null;           // null = global
  totalLockedAmount: string;     // sum of ve_lock_positions.amount (wei string)
  activeLockCount: number;       // count of isActive = true
  avgRemainingDays: number;      // avg of (lockEnd - now) in days, 0 for permanent
  pairStats: PairLockStatDto[];  // always returned for sidebar population
}
interface PairLockStatDto {
  pool: string;
  totalLockedAmount: string;
}
```

**`GET /admin/lock/events` response (`AdminLockEventsDto`):**
```ts
interface AdminLockEventsDto {
  events: AdminLockEventDto[];
  total: number;
}
interface AdminLockEventDto {
  id: string;
  tokenId: string;
  owner: string;
  eventType: string;       // e.g. "Deposit", "Withdraw"
  depositType: string | null;
  value: string;
  lockEnd: string | null;
  transactionHash: string;
  blockTimestamp: string;
}
```

**`GET /admin/lock/by-epoch` response (`AdminLockByEpochDto`):**
```ts
interface AdminLockByEpochDto {
  epochs: EpochLockBucketDto[];
}
interface EpochLockBucketDto {
  epochNumber: number;
  epochTimestamp: string;
  totalLockedAmount: string;
}
```

Lock events do not have a `pool` foreign key (locks are per-veNFT, not per-pool). For per-pair filtering, stats are derived from `voter_vote_positions` to identify which tokenIds voted for the given pool, then joined with `ve_lock_positions`. When `pool` is omitted, global lock stats are returned.

### 2b. Vote endpoints (broker `AdminVoteController` at prefix `/admin/vote`)

| Route | Query params | Description |
|---|---|---|
| `GET /admin/vote/stats` | `pool?` | Aggregate vote stats |
| `GET /admin/vote/events` | `pool?`, `limit?`, `offset?` | Paginated voter_vote_events |
| `GET /admin/vote/distribution` | `epoch?` (default current) | Per-pool vote weight for pie chart |
| `GET /admin/vote/by-epoch` | `pool?`, `epochs?` (default 8) | Total vote weight per epoch for bar chart |

**`GET /admin/vote/stats` response (`AdminVoteStatsDto`):**
```ts
interface AdminVoteStatsDto {
  pool: string | null;
  voteWeightBps: number;      // this pool's weight / total weight * 10000
  uniqueVoterCount: number;   // distinct owners with isActive vote for pool
  currentEpoch: number;       // epoch number derived from latest epochTimestamp
  pairStats: PairVoteStatDto[];
}
interface PairVoteStatDto {
  pool: string;
  voteWeightBps: number;
  voterCount: number;
}
```

**`GET /admin/vote/events` response (`AdminVoteEventsDto`):**
```ts
interface AdminVoteEventsDto {
  events: AdminVoteEventDto[];
  total: number;
}
interface AdminVoteEventDto {
  id: string;
  tokenId: string;
  pool: string;
  owner: string;
  eventType: string;       // "Voted" | "Abstained"
  weight: string;
  totalWeight: string;
  epochTimestamp: string | null;
  transactionHash: string;
  blockTimestamp: string;
}
```

**`GET /admin/vote/distribution` response (`AdminVoteDistributionDto`):**
```ts
interface AdminVoteDistributionDto {
  epoch: number;
  buckets: VoteDistributionBucketDto[];
}
interface VoteDistributionBucketDto {
  pool: string;
  totalWeight: string;
  weightBps: number;
}
```

**`GET /admin/vote/by-epoch` response (`AdminVoteByEpochDto`):**
```ts
interface AdminVoteByEpochDto {
  epochs: EpochVoteBucketDto[];
}
interface EpochVoteBucketDto {
  epochNumber: number;
  epochTimestamp: string;
  totalWeight: string;
}
```

### 2c. Migration

No new columns are added to existing tables. These are read-only query endpoints. No migration change needed.

---

## Section 3: Gateway Parity Routes

Seven new `@Get` routes added to `apps/gateway/src/api/broker-http-parity.controller.ts`:

```
GET /admin/lock/stats        → proxy to broker GET /admin/lock/stats
GET /admin/lock/events       → proxy to broker GET /admin/lock/events
GET /admin/lock/by-epoch     → proxy to broker GET /admin/lock/by-epoch
GET /admin/vote/stats        → proxy to broker GET /admin/vote/stats
GET /admin/vote/events       → proxy to broker GET /admin/vote/events
GET /admin/vote/distribution → proxy to broker GET /admin/vote/distribution
GET /admin/vote/by-epoch     → proxy to broker GET /admin/vote/by-epoch
```

Each uses the existing `this.proxy('GET', path, query)` pattern from the parity controller.

---

## Section 4: Shared DTOs

New file: `packages/shared/src/dto/admin-lock-vote.dto.ts`

Exports all 14 interfaces defined in Section 2 (`AdminLockStatsDto`, `PairLockStatDto`, `AdminLockEventsDto`, `AdminLockEventDto`, `AdminLockByEpochDto`, `EpochLockBucketDto`, `AdminVoteStatsDto`, `PairVoteStatDto`, `AdminVoteEventsDto`, `AdminVoteEventDto`, `AdminVoteDistributionDto`, `VoteDistributionBucketDto`, `AdminVoteByEpochDto`, `EpochVoteBucketDto`).

Re-exported from `packages/shared/src/dto/index.ts`.

---

## Section 5: adminApi Client Methods

New methods added to `apps/web/lib/adminApi.ts` class `AdminApi`:

```ts
getLockStats(pool?: string): Promise<AdminLockStatsDto>
getLockEvents(pool?: string, limit?: number, offset?: number): Promise<AdminLockEventsDto>
getLockByEpoch(pool?: string, epochs?: number): Promise<AdminLockByEpochDto>
getVoteStats(pool?: string): Promise<AdminVoteStatsDto>
getVoteEvents(pool?: string, limit?: number, offset?: number): Promise<AdminVoteEventsDto>
getVoteDistribution(epoch?: number): Promise<AdminVoteDistributionDto>
getVoteByEpoch(pool?: string, epochs?: number): Promise<AdminVoteByEpochDto>
```

---

## Section 6: Frontend Pages

### Shared component: `PairSidebarPanel`

**File:** `apps/web/components/admin/PairSidebarPanel.tsx`

Props:
```ts
interface PairSidebarPanelProps {
  pairs: { pool: string; label: string; subLabel: string }[];
  selectedPool: string | null;  // null = "All Pairs"
  onSelect: (pool: string | null) => void;
}
```

Renders:
- Search input (client-side filter on `label`)
- "All Pairs (Global)" row
- Pair list rows with highlight on selection

### `/admin/lock` page

**File:** `apps/web/app/admin/lock/page.tsx`

Client component. On mount and on pair selection, fetches:
1. `adminApi.getLockStats(selectedPool)` → stat cards + sidebar pair list
2. `adminApi.getLockByEpoch(selectedPool)` → bar chart
3. `adminApi.getLockEvents(selectedPool)` → recent events table

Layout:
- Left: `PairSidebarPanel` (pairs populated from `stats.pairStats`, subLabel = formatted totalLockedAmount)
- Right:
  - Header: pair name + contract address
  - 3 stat cards: Total Locked / Active Locks / Avg Duration
  - Bar chart (Recharts `BarChart`): total locked per epoch (indigo `#6366f1`)
  - Events table: columns = Type / TokenId / Owner / Amount / Lock End / Tx / Time

Event type badge colors:
- `Deposit` → indigo
- `Extend` (depositType `INCREASE_UNLOCK_TIME`) → purple
- `Withdraw` → red

### `/admin/vote` page

**File:** `apps/web/app/admin/vote/page.tsx`

Client component. On mount and on pair selection, fetches:
1. `adminApi.getVoteStats(selectedPool)` → stat cards + sidebar pair list
2. `adminApi.getVoteDistribution()` → pie chart (always global epoch distribution)
3. `adminApi.getVoteByEpoch(selectedPool)` → vote weight per epoch bar chart
4. `adminApi.getVoteEvents(selectedPool)` → recent events table

Layout:
- Left: `PairSidebarPanel` (subLabel = vote weight % + voter count)
- Right:
  - Header: pair name + epoch info
  - 3 stat cards: Vote Weight % / Unique Voters / Current Epoch
  - Charts row (2 cols):
    - Bar chart: vote weight per epoch (green `#10b981`)
    - Pie chart: epoch vote distribution (conic-gradient or Recharts `PieChart`)
  - Events table: columns = Type / TokenId / Owner / Pool / Weight / Epoch / Tx / Time

Event type badge colors:
- `Voted` → green
- `Abstained` → amber

---

## Section 7: Admin Navigation

Add two new entries to `apps/web/app/admin/AdminLayoutClient.tsx` sidebar navigation:
- "Lock" → `/admin/lock`
- "Vote" → `/admin/vote`

---

## Out of Scope

- Pagination controls for events table (initial load = 20 most recent)
- Reward claims (`voter_reward_claims`) — separate feature
- apps/api removal — separate plan
