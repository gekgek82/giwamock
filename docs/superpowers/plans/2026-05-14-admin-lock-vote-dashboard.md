# Admin Lock/Vote Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/admin/lock` and `/admin/vote` pages to the admin dashboard showing lock/vote statistics, epoch charts, and recent events sourced from broker tables via gateway parity routes.

**Architecture:** New broker `AdminLockController` + `AdminVoteController` serve data from `ve_lock_*` and `voter_vote_*` tables. Gateway adds 7 parity proxy routes. Frontend uses a shared `PairSidebarPanel` component and two new Next.js pages with `adminApi` methods.

**Tech Stack:** NestJS (broker), TypeORM (raw queries for aggregations), Next.js 14 client components, Recharts `BarChart` + `PieChart`, Tailwind CSS with `ds-*` design tokens.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `packages/shared/src/dto/admin-lock-vote.dto.ts` | Create | 14 shared DTO interfaces |
| `packages/shared/src/dto/index.ts` | Modify | Re-export new DTOs |
| `apps/broker/src/api/admin-lock/admin-lock.service.ts` | Create | Lock stats/events/by-epoch queries |
| `apps/broker/src/api/admin-lock/admin-lock.controller.ts` | Create | 3 GET routes at `/admin/lock/*` |
| `apps/broker/src/api/admin-vote/admin-vote.service.ts` | Create | Vote stats/events/distribution/by-epoch queries |
| `apps/broker/src/api/admin-vote/admin-vote.controller.ts` | Create | 4 GET routes at `/admin/vote/*` |
| `apps/broker/src/api/api.module.ts` | Modify | Register new controllers, services, entities |
| `apps/gateway/src/api/broker-http-parity.controller.ts` | Modify | Add 7 proxy routes |
| `apps/web/lib/adminApi.ts` | Modify | Add 7 new methods |
| `apps/web/components/admin/PairSidebarPanel.tsx` | Create | Searchable pair sidebar |
| `apps/web/app/admin/lock/page.tsx` | Create | `/admin/lock` page |
| `apps/web/app/admin/vote/page.tsx` | Create | `/admin/vote` page |
| `apps/web/components/admin/Sidebar.tsx` | Modify | Add Lock + Vote nav items |

---

### Task 1: Shared DTOs

**Files:**
- Create: `packages/shared/src/dto/admin-lock-vote.dto.ts`
- Modify: `packages/shared/src/dto/index.ts`

- [ ] **Step 1: Create the DTO file**

```typescript
// packages/shared/src/dto/admin-lock-vote.dto.ts

export interface PairLockStatDto {
  pool: string;
  label: string;
  totalLockedAmount: string;
}

export interface AdminLockStatsDto {
  pool: string | null;
  totalLockedAmount: string;
  activeLockCount: number;
  avgRemainingDays: number;
  pairStats: PairLockStatDto[];
}

export interface AdminLockEventDto {
  id: string;
  tokenId: string;
  owner: string;
  eventType: string;
  depositType: string | null;
  value: string;
  lockEnd: string | null;
  transactionHash: string;
  blockTimestamp: string;
}

export interface AdminLockEventsDto {
  events: AdminLockEventDto[];
  total: number;
}

export interface EpochLockBucketDto {
  epochNumber: number;
  epochTimestamp: string;
  totalLockedAmount: string;
}

export interface AdminLockByEpochDto {
  epochs: EpochLockBucketDto[];
}

export interface PairVoteStatDto {
  pool: string;
  label: string;
  voteWeightBps: number;
  voterCount: number;
}

export interface AdminVoteStatsDto {
  pool: string | null;
  voteWeightBps: number;
  uniqueVoterCount: number;
  currentEpoch: number;
  pairStats: PairVoteStatDto[];
}

export interface AdminVoteEventDto {
  id: string;
  tokenId: string;
  pool: string;
  owner: string;
  eventType: string;
  weight: string;
  totalWeight: string;
  epochTimestamp: string | null;
  transactionHash: string;
  blockTimestamp: string;
}

export interface AdminVoteEventsDto {
  events: AdminVoteEventDto[];
  total: number;
}

export interface VoteDistributionBucketDto {
  pool: string;
  label: string;
  totalWeight: string;
  weightBps: number;
}

export interface AdminVoteDistributionDto {
  epoch: number;
  buckets: VoteDistributionBucketDto[];
}

export interface EpochVoteBucketDto {
  epochNumber: number;
  epochTimestamp: string;
  totalWeight: string;
}

export interface AdminVoteByEpochDto {
  epochs: EpochVoteBucketDto[];
}
```

- [ ] **Step 2: Add re-export to shared DTO index**

Open `packages/shared/src/dto/index.ts` and append at the end:

```typescript
export * from './admin-lock-vote.dto';
```

- [ ] **Step 3: Build shared package and verify**

```bash
pnpm --filter @giwater/shared build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/dto/admin-lock-vote.dto.ts packages/shared/src/dto/index.ts
git commit -m "feat(shared): add admin lock/vote dashboard DTOs"
```

---

### Task 2: Broker AdminLockService

**Files:**
- Create: `apps/broker/src/api/admin-lock/admin-lock.service.ts`

The `ve_lock_events` and `voter_vote_*` tables use **quoted camelCase** column names (e.g., `"eventType"`, `"blockTimestamp"`, `"epochTimestamp"`, `"tokenId"`, `"isActive"`). In TypeORM raw SQL expressions (inside `SELECT` strings with aggregates/CASE WHEN), always quote these. Plain `alias.property` in `.where()` is translated by TypeORM and uses entity property names.

- [ ] **Step 1: Create the service file**

```typescript
// apps/broker/src/api/admin-lock/admin-lock.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VeLockPositionEntity } from '../../models/ve-lock/ve-lock-position.entity';
import { VeLockEventEntity } from '../../models/ve-lock/ve-lock-event.entity';
import { VoterVotePositionEntity } from '../../models/voting/voter-vote-position.entity';
import type { AdminLockStatsDto, AdminLockEventsDto, AdminLockByEpochDto } from '@giwater/shared';

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

@Injectable()
export class AdminLockService {
  constructor(
    @InjectRepository(VeLockPositionEntity)
    private readonly lockPositions: Repository<VeLockPositionEntity>,
    @InjectRepository(VeLockEventEntity)
    private readonly lockEvents: Repository<VeLockEventEntity>,
    @InjectRepository(VoterVotePositionEntity)
    private readonly votePositions: Repository<VoterVotePositionEntity>,
  ) {}

  async getStats(pool?: string): Promise<AdminLockStatsDto> {
    const [activePositions, voteRows, pairSymbols] = await Promise.all([
      this.lockPositions.find({ where: { isActive: true } }),
      this.votePositions
        .createQueryBuilder('v')
        .select(['v.pool', 'v.tokenId'])
        .where('v.isActive = true')
        .getMany(),
      this.lockPositions.manager.query<{ id: string; symbol: string }[]>(
        'SELECT id, symbol FROM spot_pairs',
      ),
    ]);

    const symbolMap = new Map(pairSymbols.map((r) => [r.id.toLowerCase(), r.symbol]));

    const totalLockedAmount = activePositions
      .reduce((sum, p) => sum + BigInt(p.amount), BigInt(0))
      .toString();
    const activeLockCount = activePositions.length;

    const nowSec = Math.floor(Date.now() / 1000);
    const avgRemainingDays =
      activePositions.length === 0
        ? 0
        : Math.round(
            activePositions.reduce((sum, p) => {
              if (!p.lockEnd || p.isPermanent) return sum + 365;
              return sum + Math.max(0, (Number(p.lockEnd) - nowSec) / 86400);
            }, 0) / activePositions.length,
          );

    // Build pool → tokenIds map from active vote positions
    const poolToTokenIds = new Map<string, Set<string>>();
    for (const vp of voteRows) {
      if (!poolToTokenIds.has(vp.pool)) poolToTokenIds.set(vp.pool, new Set());
      poolToTokenIds.get(vp.pool)!.add(vp.tokenId);
    }

    const activeAmountByTokenId = new Map(activePositions.map((p) => [p.tokenId, p.amount]));

    const pairStats = Array.from(poolToTokenIds.entries()).map(([poolAddr, tokenIds]) => {
      const locked = Array.from(tokenIds).reduce(
        (sum, tid) => sum + BigInt(activeAmountByTokenId.get(tid) ?? '0'),
        BigInt(0),
      );
      return {
        pool: poolAddr,
        label: symbolMap.get(poolAddr.toLowerCase()) ?? truncateAddress(poolAddr),
        totalLockedAmount: locked.toString(),
      };
    });

    return { pool: pool ?? null, totalLockedAmount, activeLockCount, avgRemainingDays, pairStats };
  }

  async getEvents(pool?: string, limit = 20, offset = 0): Promise<AdminLockEventsDto> {
    const qb = this.lockEvents
      .createQueryBuilder('e')
      .orderBy('e.createdAt', 'DESC')
      .limit(limit)
      .offset(offset);

    if (pool) {
      const tokenIds = await this.votePositions
        .createQueryBuilder('v')
        .select('v.tokenId')
        .where('LOWER(v.pool) = LOWER(:pool)', { pool })
        .getMany()
        .then((rows) => rows.map((r) => r.tokenId));
      if (tokenIds.length === 0) return { events: [], total: 0 };
      qb.where('e.tokenId IN (:...tokenIds)', { tokenIds });
    }

    const [rows, total] = await qb.getManyAndCount();
    return {
      events: rows.map((e) => ({
        id: e.id,
        tokenId: e.tokenId,
        owner: e.owner,
        eventType: e.eventType,
        depositType: e.depositType,
        value: e.value,
        lockEnd: e.lockEnd,
        transactionHash: e.transactionHash,
        blockTimestamp: e.blockTimestamp,
      })),
      total,
    };
  }

  async getByEpoch(pool?: string, epochs = 8): Promise<AdminLockByEpochDto> {
    const poolFilter = pool
      ? `AND le."tokenId" IN (SELECT "tokenId" FROM voter_vote_positions WHERE LOWER(pool) = LOWER($2))`
      : '';
    const params: unknown[] = pool ? [epochs, pool] : [epochs];

    const rows = await this.lockPositions.manager.query<
      { epoch_num: string; epoch_ts: string; total_locked: string }[]
    >(
      `WITH epoch_boundaries AS (
        SELECT DISTINCT "epochTimestamp"::numeric AS epoch_ts,
               ROW_NUMBER() OVER (ORDER BY "epochTimestamp"::numeric) AS epoch_num
        FROM voter_vote_events
        WHERE "epochTimestamp" IS NOT NULL
        ORDER BY epoch_ts
        LIMIT $1
      )
      SELECT
        e.epoch_num,
        e.epoch_ts::text AS epoch_ts,
        COALESCE(SUM(
          CASE
            WHEN le."eventType" = 'Deposit' THEN le.value::numeric
            WHEN le."eventType" = 'Withdraw' THEN -le.value::numeric
            ELSE 0
          END
        ), 0) AS total_locked
      FROM epoch_boundaries e
      LEFT JOIN ve_lock_events le
        ON le."blockTimestamp"::numeric <= e.epoch_ts
        ${poolFilter}
      GROUP BY e.epoch_num, e.epoch_ts
      ORDER BY e.epoch_ts`,
      params,
    );

    return {
      epochs: rows.map((r) => ({
        epochNumber: Number(r.epoch_num),
        epochTimestamp: r.epoch_ts,
        totalLockedAmount: r.total_locked,
      })),
    };
  }
}
```

- [ ] **Step 2: Verify TypeScript in broker**

```bash
pnpm --filter @giwater/broker exec tsc --noEmit 2>&1 | grep "admin-lock" | head -10
```

Expected: no output (no errors in admin-lock files). If errors show, fix before continuing.

- [ ] **Step 3: Commit**

```bash
git add apps/broker/src/api/admin-lock/admin-lock.service.ts
git commit -m "feat(broker): add AdminLockService with stats/events/by-epoch queries"
```

---

### Task 3: Broker AdminLockController

**Files:**
- Create: `apps/broker/src/api/admin-lock/admin-lock.controller.ts`

- [ ] **Step 1: Create the controller**

```typescript
// apps/broker/src/api/admin-lock/admin-lock.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminLockService } from './admin-lock.service';
import type { AdminLockStatsDto, AdminLockEventsDto, AdminLockByEpochDto } from '@giwater/shared';

@ApiTags('admin-lock')
@Controller('admin/lock')
export class AdminLockController {
  constructor(private readonly lockService: AdminLockService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Admin: lock stats (total locked, active positions, avg duration)' })
  @ApiQuery({ name: 'pool', required: false, description: 'Filter by pool address' })
  async getStats(@Query('pool') pool?: string): Promise<AdminLockStatsDto> {
    return this.lockService.getStats(pool);
  }

  @Get('events')
  @ApiOperation({ summary: 'Admin: recent ve_lock_events' })
  @ApiQuery({ name: 'pool', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getEvents(
    @Query('pool') pool?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ): Promise<AdminLockEventsDto> {
    return this.lockService.getEvents(
      pool,
      limitRaw ? Number(limitRaw) : 20,
      offsetRaw ? Number(offsetRaw) : 0,
    );
  }

  @Get('by-epoch')
  @ApiOperation({ summary: 'Admin: total locked per epoch (bar chart data)' })
  @ApiQuery({ name: 'pool', required: false })
  @ApiQuery({ name: 'epochs', required: false, type: Number, description: 'Number of epochs to return (default 8)' })
  async getByEpoch(
    @Query('pool') pool?: string,
    @Query('epochs') epochsRaw?: string,
  ): Promise<AdminLockByEpochDto> {
    return this.lockService.getByEpoch(pool, epochsRaw ? Number(epochsRaw) : 8);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/broker/src/api/admin-lock/admin-lock.controller.ts
git commit -m "feat(broker): add AdminLockController with 3 admin/lock/* routes"
```

---

### Task 4: Broker AdminVoteService

**Files:**
- Create: `apps/broker/src/api/admin-vote/admin-vote.service.ts`

- [ ] **Step 1: Create the service**

```typescript
// apps/broker/src/api/admin-vote/admin-vote.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VoterVotePositionEntity } from '../../models/voting/voter-vote-position.entity';
import { VoterVoteEventEntity } from '../../models/voting/voter-vote-event.entity';
import type {
  AdminVoteStatsDto,
  AdminVoteEventsDto,
  AdminVoteDistributionDto,
  AdminVoteByEpochDto,
} from '@giwater/shared';

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

@Injectable()
export class AdminVoteService {
  constructor(
    @InjectRepository(VoterVotePositionEntity)
    private readonly votePositions: Repository<VoterVotePositionEntity>,
    @InjectRepository(VoterVoteEventEntity)
    private readonly voteEvents: Repository<VoterVoteEventEntity>,
  ) {}

  async getStats(pool?: string): Promise<AdminVoteStatsDto> {
    const [poolAggRows, pairSymbols, epochRows] = await Promise.all([
      this.votePositions.manager.query<
        { pool: string; pool_weight: string; voter_count: string }[]
      >(
        `SELECT pool,
                SUM(weight::numeric) AS pool_weight,
                COUNT(DISTINCT owner) AS voter_count
         FROM voter_vote_positions
         WHERE "isActive" = true
         GROUP BY pool`,
      ),
      this.votePositions.manager.query<{ id: string; symbol: string }[]>(
        'SELECT id, symbol FROM spot_pairs',
      ),
      this.votePositions.manager.query<{ "epochTimestamp": string }[]>(
        `SELECT DISTINCT "epochTimestamp" FROM voter_vote_events WHERE "epochTimestamp" IS NOT NULL ORDER BY "epochTimestamp" ASC`,
      ),
    ]);

    const symbolMap = new Map(pairSymbols.map((r) => [r.id.toLowerCase(), r.symbol]));
    const currentEpoch = epochRows.length;

    const totalGlobalWeight = poolAggRows.reduce(
      (sum, r) => sum + BigInt(r.pool_weight),
      BigInt(0),
    );

    const targetPool = pool?.toLowerCase();
    const poolRow = targetPool
      ? poolAggRows.find((r) => r.pool.toLowerCase() === targetPool)
      : null;

    const poolWeight = pool
      ? BigInt(poolRow?.pool_weight ?? '0')
      : totalGlobalWeight;

    const voteWeightBps =
      totalGlobalWeight === BigInt(0)
        ? 0
        : Number((poolWeight * BigInt(10000)) / totalGlobalWeight);

    const uniqueVoterCount = pool
      ? Number(poolRow?.voter_count ?? 0)
      : poolAggRows.reduce((sum, r) => sum + Number(r.voter_count), 0);

    const pairStats = poolAggRows.map((r) => ({
      pool: r.pool,
      label: symbolMap.get(r.pool.toLowerCase()) ?? truncateAddress(r.pool),
      voteWeightBps:
        totalGlobalWeight === BigInt(0)
          ? 0
          : Number((BigInt(r.pool_weight) * BigInt(10000)) / totalGlobalWeight),
      voterCount: Number(r.voter_count),
    }));

    return { pool: pool ?? null, voteWeightBps, uniqueVoterCount, currentEpoch, pairStats };
  }

  async getEvents(pool?: string, limit = 20, offset = 0): Promise<AdminVoteEventsDto> {
    const qb = this.voteEvents
      .createQueryBuilder('e')
      .orderBy('e.createdAt', 'DESC')
      .limit(limit)
      .offset(offset);

    if (pool) {
      qb.where('LOWER(e.pool) = LOWER(:pool)', { pool });
    }

    const [rows, total] = await qb.getManyAndCount();
    return {
      events: rows.map((e) => ({
        id: e.id,
        tokenId: e.tokenId,
        pool: e.pool,
        owner: e.owner,
        eventType: e.eventType,
        weight: e.weight,
        totalWeight: e.totalWeight,
        epochTimestamp: e.epochTimestamp,
        transactionHash: e.transactionHash,
        blockTimestamp: e.blockTimestamp,
      })),
      total,
    };
  }

  async getDistribution(epoch?: number): Promise<AdminVoteDistributionDto> {
    const [poolAggRows, pairSymbols, epochRows] = await Promise.all([
      this.votePositions.manager.query<{ pool: string; pool_weight: string }[]>(
        `SELECT pool, SUM(weight::numeric) AS pool_weight
         FROM voter_vote_positions
         WHERE "isActive" = true
         GROUP BY pool`,
      ),
      this.votePositions.manager.query<{ id: string; symbol: string }[]>(
        'SELECT id, symbol FROM spot_pairs',
      ),
      this.votePositions.manager.query<{ "epochTimestamp": string }[]>(
        `SELECT DISTINCT "epochTimestamp" FROM voter_vote_events WHERE "epochTimestamp" IS NOT NULL ORDER BY "epochTimestamp" ASC`,
      ),
    ]);

    const symbolMap = new Map(pairSymbols.map((r) => [r.id.toLowerCase(), r.symbol]));
    const currentEpoch = epochRows.length;

    const totalWeight = poolAggRows.reduce(
      (sum, r) => sum + BigInt(r.pool_weight),
      BigInt(0),
    );

    const buckets = poolAggRows.map((r) => ({
      pool: r.pool,
      label: symbolMap.get(r.pool.toLowerCase()) ?? truncateAddress(r.pool),
      totalWeight: r.pool_weight,
      weightBps:
        totalWeight === BigInt(0)
          ? 0
          : Number((BigInt(r.pool_weight) * BigInt(10000)) / totalWeight),
    }));

    return { epoch: epoch ?? currentEpoch, buckets };
  }

  async getByEpoch(pool?: string, epochs = 8): Promise<AdminVoteByEpochDto> {
    const poolFilter = pool ? 'AND LOWER(e.pool) = LOWER($2)' : '';
    const params: unknown[] = pool ? [epochs, pool] : [epochs];

    const rows = await this.voteEvents.manager.query<
      { epoch_num: string; epoch_ts: string; total_weight: string }[]
    >(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY "epochTimestamp"::numeric) AS epoch_num,
         "epochTimestamp" AS epoch_ts,
         SUM(weight::numeric) AS total_weight
       FROM voter_vote_events e
       WHERE "epochTimestamp" IS NOT NULL
         ${poolFilter}
       GROUP BY "epochTimestamp"
       ORDER BY "epochTimestamp"::numeric
       LIMIT $1`,
      params,
    );

    return {
      epochs: rows.map((r) => ({
        epochNumber: Number(r.epoch_num),
        epochTimestamp: r.epoch_ts,
        totalWeight: r.total_weight,
      })),
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/broker/src/api/admin-vote/admin-vote.service.ts
git commit -m "feat(broker): add AdminVoteService with stats/events/distribution/by-epoch queries"
```

---

### Task 5: Broker AdminVoteController

**Files:**
- Create: `apps/broker/src/api/admin-vote/admin-vote.controller.ts`

- [ ] **Step 1: Create the controller**

```typescript
// apps/broker/src/api/admin-vote/admin-vote.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminVoteService } from './admin-vote.service';
import type {
  AdminVoteStatsDto,
  AdminVoteEventsDto,
  AdminVoteDistributionDto,
  AdminVoteByEpochDto,
} from '@giwater/shared';

@ApiTags('admin-vote')
@Controller('admin/vote')
export class AdminVoteController {
  constructor(private readonly voteService: AdminVoteService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Admin: vote stats (weight %, unique voters, current epoch)' })
  @ApiQuery({ name: 'pool', required: false })
  async getStats(@Query('pool') pool?: string): Promise<AdminVoteStatsDto> {
    return this.voteService.getStats(pool);
  }

  @Get('events')
  @ApiOperation({ summary: 'Admin: recent voter_vote_events' })
  @ApiQuery({ name: 'pool', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getEvents(
    @Query('pool') pool?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ): Promise<AdminVoteEventsDto> {
    return this.voteService.getEvents(
      pool,
      limitRaw ? Number(limitRaw) : 20,
      offsetRaw ? Number(offsetRaw) : 0,
    );
  }

  @Get('distribution')
  @ApiOperation({ summary: 'Admin: epoch vote distribution (pie chart data)' })
  @ApiQuery({ name: 'epoch', required: false, type: Number })
  async getDistribution(@Query('epoch') epochRaw?: string): Promise<AdminVoteDistributionDto> {
    return this.voteService.getDistribution(epochRaw ? Number(epochRaw) : undefined);
  }

  @Get('by-epoch')
  @ApiOperation({ summary: 'Admin: total vote weight per epoch (bar chart data)' })
  @ApiQuery({ name: 'pool', required: false })
  @ApiQuery({ name: 'epochs', required: false, type: Number })
  async getByEpoch(
    @Query('pool') pool?: string,
    @Query('epochs') epochsRaw?: string,
  ): Promise<AdminVoteByEpochDto> {
    return this.voteService.getByEpoch(pool, epochsRaw ? Number(epochsRaw) : 8);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/broker/src/api/admin-vote/admin-vote.controller.ts
git commit -m "feat(broker): add AdminVoteController with 4 admin/vote/* routes"
```

---

### Task 6: Register in broker api.module.ts

**Files:**
- Modify: `apps/broker/src/api/api.module.ts`

- [ ] **Step 1: Add imports and registrations**

Open `apps/broker/src/api/api.module.ts`. Make these changes:

**Add imports at the top (after existing imports):**
```typescript
import { AdminLockController } from './admin-lock/admin-lock.controller';
import { AdminLockService } from './admin-lock/admin-lock.service';
import { AdminVoteController } from './admin-vote/admin-vote.controller';
import { AdminVoteService } from './admin-vote/admin-vote.service';
import { VeLockPositionEntity } from '../models/ve-lock/ve-lock-position.entity';
import { VeLockEventEntity } from '../models/ve-lock/ve-lock-event.entity';
import { VoterVotePositionEntity } from '../models/voting/voter-vote-position.entity';
import { VoterVoteEventEntity } from '../models/voting/voter-vote-event.entity';
```

**In the `TypeOrmModule.forFeature([...])` array**, add the 4 new entities:
```typescript
TypeOrmModule.forFeature([
  SpotTokenEntity,
  SpotAccountLiquidityProvisionEntity,
  SpotAccountStakeEventEntity,
  SpotPairEntity,
  VeLockPositionEntity,   // add
  VeLockEventEntity,      // add
  VoterVotePositionEntity, // add
  VoterVoteEventEntity,   // add
]),
```

**In the `controllers: [...]` array**, add:
```typescript
AdminLockController,
AdminVoteController,
```

**In the `providers: [...]` array**, add:
```typescript
AdminLockService,
AdminVoteService,
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
pnpm --filter @giwater/broker exec tsc --noEmit 2>&1 | head -20
```

Expected: exits 0 with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/broker/src/api/api.module.ts
git commit -m "feat(broker): register AdminLock and AdminVote controllers in ApiModule"
```

---

### Task 7: Gateway parity routes

**Files:**
- Modify: `apps/gateway/src/api/broker-http-parity.controller.ts`

Add 7 new routes. Find the section with existing `admin/pool` and `admin/exchange` routes (around line 172) and add the new routes after them. The exact decorator pattern to follow comes from the existing `adminPoolTimeBuckets` method.

- [ ] **Step 1: Add the 7 routes**

After the `adminExchangeTimeBuckets` method (around line 227), insert:

```typescript
  @Get('admin/lock/stats')
  @ApiOperation({ summary: 'Broker parity: GET /admin/lock/stats' })
  @ApiQuery({ name: 'pool', required: false })
  async adminLockStats(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/admin/lock/stats', query);
  }

  @Get('admin/lock/events')
  @ApiOperation({ summary: 'Broker parity: GET /admin/lock/events' })
  @ApiQuery({ name: 'pool', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async adminLockEvents(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/admin/lock/events', query);
  }

  @Get('admin/lock/by-epoch')
  @ApiOperation({ summary: 'Broker parity: GET /admin/lock/by-epoch' })
  @ApiQuery({ name: 'pool', required: false })
  @ApiQuery({ name: 'epochs', required: false })
  async adminLockByEpoch(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/admin/lock/by-epoch', query);
  }

  @Get('admin/vote/stats')
  @ApiOperation({ summary: 'Broker parity: GET /admin/vote/stats' })
  @ApiQuery({ name: 'pool', required: false })
  async adminVoteStats(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/admin/vote/stats', query);
  }

  @Get('admin/vote/events')
  @ApiOperation({ summary: 'Broker parity: GET /admin/vote/events' })
  @ApiQuery({ name: 'pool', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async adminVoteEvents(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/admin/vote/events', query);
  }

  @Get('admin/vote/distribution')
  @ApiOperation({ summary: 'Broker parity: GET /admin/vote/distribution' })
  @ApiQuery({ name: 'epoch', required: false })
  async adminVoteDistribution(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/admin/vote/distribution', query);
  }

  @Get('admin/vote/by-epoch')
  @ApiOperation({ summary: 'Broker parity: GET /admin/vote/by-epoch' })
  @ApiQuery({ name: 'pool', required: false })
  @ApiQuery({ name: 'epochs', required: false })
  async adminVoteByEpoch(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/admin/vote/by-epoch', query);
  }
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm --filter @giwater/gateway exec tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/gateway/src/api/broker-http-parity.controller.ts
git commit -m "feat(gateway): add admin lock/vote parity routes (7 new GET endpoints)"
```

---

### Task 8: adminApi client methods

**Files:**
- Modify: `apps/web/lib/adminApi.ts`

The `adminApi` methods call `this.fetch<T>('/admin/lock/stats')`. The `adminProxyPath` helper strips `/admin` and prepends `/api/admin`, so this becomes a call to `/api/admin/lock/stats` → gateway → broker.

- [ ] **Step 1: Add the import for new DTOs**

Find the import block in `apps/web/lib/adminApi.ts` (around line 80–92). Add a new import:

```typescript
import type {
  AdminLockStatsDto,
  AdminLockEventsDto,
  AdminLockByEpochDto,
  AdminVoteStatsDto,
  AdminVoteEventsDto,
  AdminVoteDistributionDto,
  AdminVoteByEpochDto,
} from '@giwater/shared';
```

- [ ] **Step 2: Add 7 new methods to the AdminApi class**

Find the end of the `AdminApi` class (just before the closing `}` of the class, near line 1210). Insert:

```typescript
  async getLockStats(pool?: string): Promise<AdminLockStatsDto> {
    return this.fetch<AdminLockStatsDto>(
      `/admin/lock/stats${buildQuery({ pool })}`,
    );
  }

  async getLockEvents(pool?: string, limit = 20, offset = 0): Promise<AdminLockEventsDto> {
    return this.fetch<AdminLockEventsDto>(
      `/admin/lock/events${buildQuery({ pool, limit, offset })}`,
    );
  }

  async getLockByEpoch(pool?: string, epochs = 8): Promise<AdminLockByEpochDto> {
    return this.fetch<AdminLockByEpochDto>(
      `/admin/lock/by-epoch${buildQuery({ pool, epochs })}`,
    );
  }

  async getVoteStats(pool?: string): Promise<AdminVoteStatsDto> {
    return this.fetch<AdminVoteStatsDto>(
      `/admin/vote/stats${buildQuery({ pool })}`,
    );
  }

  async getVoteEvents(pool?: string, limit = 20, offset = 0): Promise<AdminVoteEventsDto> {
    return this.fetch<AdminVoteEventsDto>(
      `/admin/vote/events${buildQuery({ pool, limit, offset })}`,
    );
  }

  async getVoteDistribution(epoch?: number): Promise<AdminVoteDistributionDto> {
    return this.fetch<AdminVoteDistributionDto>(
      `/admin/vote/distribution${buildQuery({ epoch })}`,
    );
  }

  async getVoteByEpoch(pool?: string, epochs = 8): Promise<AdminVoteByEpochDto> {
    return this.fetch<AdminVoteByEpochDto>(
      `/admin/vote/by-epoch${buildQuery({ pool, epochs })}`,
    );
  }
```

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm --filter @giwater/web exec tsc --noEmit 2>&1 | grep "adminApi" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/adminApi.ts
git commit -m "feat(web): add adminApi methods for lock/vote dashboard endpoints"
```

---

### Task 9: PairSidebarPanel component

**Files:**
- Create: `apps/web/components/admin/PairSidebarPanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/admin/PairSidebarPanel.tsx
'use client';

import { useState, useMemo } from 'react';

interface PairItem {
  pool: string;
  label: string;
  subLabel: string;
}

interface PairSidebarPanelProps {
  pairs: PairItem[];
  selectedPool: string | null;
  onSelect: (pool: string | null) => void;
  accentColor?: 'indigo' | 'green';
}

export function PairSidebarPanel({
  pairs,
  selectedPool,
  onSelect,
  accentColor = 'indigo',
}: PairSidebarPanelProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      search.trim() === ''
        ? pairs
        : pairs.filter((p) =>
            p.label.toLowerCase().includes(search.toLowerCase()),
          ),
    [pairs, search],
  );

  const activeClass =
    accentColor === 'green'
      ? 'bg-ds-green-900 text-white'
      : 'bg-ds-violet-900 text-white';

  const activeSubClass =
    accentColor === 'green' ? 'text-ds-green-400' : 'text-ds-violet-400';

  return (
    <aside className="w-48 flex-shrink-0 bg-ds-background-200 border-r border-ds-gray-400 flex flex-col">
      <div className="p-3 border-b border-ds-gray-400">
        <p className="text-[10px] text-ds-gray-600 uppercase tracking-widest mb-2">
          Pairs
        </p>
        <input
          className="w-full text-xs bg-ds-background-100 border border-ds-gray-400 rounded px-2 py-1.5 text-ds-gray-900 placeholder-ds-gray-600 focus:outline-none focus:border-ds-gray-600"
          placeholder="Search pairs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-auto p-2 flex flex-col gap-0.5">
        <button
          onClick={() => onSelect(null)}
          className={`text-left px-2 py-1.5 rounded text-xs transition-colors ${
            selectedPool === null
              ? activeClass
              : 'text-ds-gray-800 hover:bg-ds-gray-200'
          }`}
        >
          All Pairs (Global)
        </button>
        {filtered.map((pair) => (
          <button
            key={pair.pool}
            onClick={() => onSelect(pair.pool)}
            className={`text-left px-2 py-1.5 rounded text-xs transition-colors ${
              selectedPool === pair.pool
                ? activeClass
                : 'text-ds-gray-800 hover:bg-ds-gray-200'
            }`}
          >
            <div>{pair.label}</div>
            <div
              className={`text-[10px] ${
                selectedPool === pair.pool
                  ? activeSubClass
                  : 'text-ds-gray-600'
              }`}
            >
              {pair.subLabel}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/admin/PairSidebarPanel.tsx
git commit -m "feat(web): add PairSidebarPanel shared component for admin lock/vote pages"
```

---

### Task 10: /admin/lock page

**Files:**
- Create: `apps/web/app/admin/lock/page.tsx`

The page fetches lock stats, epoch data, and events. Recharts `BarChart` is already available via `recharts` (^3.8.1 in web package.json).

- [ ] **Step 1: Create the page**

```tsx
// apps/web/app/admin/lock/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { adminApi } from '@/lib/adminApi';
import { PairSidebarPanel } from '@/components/admin/PairSidebarPanel';
import type {
  AdminLockStatsDto,
  AdminLockEventsDto,
  AdminLockByEpochDto,
} from '@giwater/shared';

function formatAmount(wei: string): string {
  const n = Number(BigInt(wei) / BigInt(1e15)) / 1000;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function relativeTime(ts: string): string {
  const diffMs = Date.now() - Number(ts) * 1000;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function eventBadgeColor(eventType: string, depositType: string | null): string {
  if (eventType === 'Withdraw') return 'text-red-400';
  if (depositType === 'INCREASE_UNLOCK_TIME') return 'text-purple-400';
  return 'text-indigo-400';
}

function eventLabel(eventType: string, depositType: string | null): string {
  if (eventType === 'Withdraw') return 'WITHDRAW';
  if (depositType === 'INCREASE_UNLOCK_TIME') return 'EXTEND';
  return 'DEPOSIT';
}

export default function LockDashboardPage() {
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminLockStatsDto | null>(null);
  const [epochData, setEpochData] = useState<AdminLockByEpochDto | null>(null);
  const [events, setEvents] = useState<AdminLockEventsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (pool: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const [s, e, ev] = await Promise.all([
        adminApi.getLockStats(pool ?? undefined),
        adminApi.getLockByEpoch(pool ?? undefined),
        adminApi.getLockEvents(pool ?? undefined),
      ]);
      setStats(s);
      setEpochData(e);
      setEvents(ev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lock data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(selectedPool);
  }, [selectedPool, fetchAll]);

  const pairs =
    stats?.pairStats.map((p) => ({
      pool: p.pool,
      label: p.label,
      subLabel: formatAmount(p.totalLockedAmount) + ' locked',
    })) ?? [];

  const chartData =
    epochData?.epochs.map((ep) => ({
      name: `#${ep.epochNumber}`,
      locked: Number(BigInt(ep.totalLockedAmount) / BigInt(1e18)),
    })) ?? [];

  const selectedLabel =
    selectedPool === null
      ? 'All Pairs (Global)'
      : (stats?.pairStats.find((p) => p.pool === selectedPool)?.label ?? selectedPool);

  return (
    <div className="flex h-full -m-8">
      <PairSidebarPanel
        pairs={pairs}
        selectedPool={selectedPool}
        onSelect={setSelectedPool}
        accentColor="indigo"
      />

      <div className="flex-1 flex flex-col overflow-auto p-6 gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-ds-gray-1000">
              Lock Dashboard — {selectedLabel}
            </h1>
            <p className="text-xs text-ds-gray-600 mt-0.5">
              VotingEscrow lock positions and events
            </p>
          </div>
          <button
            onClick={() => fetchAll(selectedPool)}
            className="text-xs text-ds-gray-700 hover:text-ds-gray-900 border border-ds-gray-400 rounded px-3 py-1.5 transition-colors"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/20 border border-red-700/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-ds-background-200 rounded-lg p-4 border-l-4 border-indigo-500">
            <p className="text-[10px] text-ds-gray-600 uppercase tracking-wider">Total Locked</p>
            <p className="text-2xl font-bold text-indigo-400 mt-1">
              {stats ? formatAmount(stats.totalLockedAmount) : '—'}
            </p>
            <p className="text-[10px] text-ds-gray-600 mt-0.5">veNFT amount</p>
          </div>
          <div className="bg-ds-background-200 rounded-lg p-4 border-l-4 border-purple-500">
            <p className="text-[10px] text-ds-gray-600 uppercase tracking-wider">Active Locks</p>
            <p className="text-2xl font-bold text-purple-400 mt-1">
              {stats?.activeLockCount ?? '—'}
            </p>
            <p className="text-[10px] text-ds-gray-600 mt-0.5">positions</p>
          </div>
          <div className="bg-ds-background-200 rounded-lg p-4 border-l-4 border-emerald-500">
            <p className="text-[10px] text-ds-gray-600 uppercase tracking-wider">Avg Duration</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              {stats ? `${stats.avgRemainingDays}d` : '—'}
            </p>
            <p className="text-[10px] text-ds-gray-600 mt-0.5">remaining</p>
          </div>
        </div>

        {/* Bar chart */}
        <div className="bg-ds-background-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-indigo-400 mb-3">
            Total Locked Over Time (by epoch)
          </p>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-xs text-ds-gray-600">
              Loading…
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-ds-gray-600">
              No epoch data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: 'none', fontSize: 11 }}
                />
                <Bar dataKey="locked" fill="#6366f1" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Events table */}
        <div className="bg-ds-background-200 rounded-lg p-4 flex-1">
          <p className="text-xs font-semibold text-indigo-400 mb-3">Recent Lock Events</p>
          {loading ? (
            <p className="text-xs text-ds-gray-600">Loading…</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {(events?.events ?? []).length === 0 ? (
                <p className="text-xs text-ds-gray-600">No events</p>
              ) : (
                events?.events.map((ev) => (
                  <div
                    key={ev.id}
                    className="bg-ds-background-100 rounded px-3 py-2 text-xs"
                  >
                    <div className="flex justify-between mb-0.5">
                      <span className={`font-medium ${eventBadgeColor(ev.eventType, ev.depositType)}`}>
                        {eventLabel(ev.eventType, ev.depositType)}
                      </span>
                      <span className="text-ds-gray-600">{relativeTime(ev.blockTimestamp)}</span>
                    </div>
                    <div className="text-ds-gray-700">
                      {ev.owner.slice(0, 8)}…{ev.owner.slice(-4)} · lock #{ev.tokenId} ·{' '}
                      {formatAmount(ev.value)}
                      {ev.lockEnd && (
                        <> · ends {new Date(Number(ev.lockEnd) * 1000).toLocaleDateString()}</>
                      )}
                    </div>
                    <div className="text-ds-gray-600 text-[10px] mt-0.5">
                      {ev.transactionHash.slice(0, 10)}…
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm --filter @giwater/web exec tsc --noEmit 2>&1 | grep "admin/lock" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/admin/lock/page.tsx
git commit -m "feat(web): add /admin/lock dashboard page"
```

---

### Task 11: /admin/vote page

**Files:**
- Create: `apps/web/app/admin/vote/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// apps/web/app/admin/vote/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { adminApi } from '@/lib/adminApi';
import { PairSidebarPanel } from '@/components/admin/PairSidebarPanel';
import type {
  AdminVoteStatsDto,
  AdminVoteEventsDto,
  AdminVoteByEpochDto,
  AdminVoteDistributionDto,
} from '@giwater/shared';

const PIE_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function relativeTime(ts: string): string {
  const diffMs = Date.now() - Number(ts) * 1000;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export default function VoteDashboardPage() {
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminVoteStatsDto | null>(null);
  const [epochData, setEpochData] = useState<AdminVoteByEpochDto | null>(null);
  const [distribution, setDistribution] = useState<AdminVoteDistributionDto | null>(null);
  const [events, setEvents] = useState<AdminVoteEventsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (pool: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const [s, e, d, ev] = await Promise.all([
        adminApi.getVoteStats(pool ?? undefined),
        adminApi.getVoteByEpoch(pool ?? undefined),
        adminApi.getVoteDistribution(),
        adminApi.getVoteEvents(pool ?? undefined),
      ]);
      setStats(s);
      setEpochData(e);
      setDistribution(d);
      setEvents(ev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vote data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(selectedPool);
  }, [selectedPool, fetchAll]);

  const pairs =
    stats?.pairStats.map((p) => ({
      pool: p.pool,
      label: p.label,
      subLabel: `${(p.voteWeightBps / 100).toFixed(1)}% VP · ${p.voterCount} voters`,
    })) ?? [];

  const barChartData =
    epochData?.epochs.map((ep) => ({
      name: `#${ep.epochNumber}`,
      weight: Number(BigInt(ep.totalWeight) / BigInt(1e15)) / 1000,
    })) ?? [];

  const pieData =
    distribution?.buckets
      .filter((b) => b.weightBps > 0)
      .slice(0, 5)
      .map((b) => ({ name: b.label, value: b.weightBps / 100 })) ?? [];

  const selectedLabel =
    selectedPool === null
      ? 'All Pairs (Global)'
      : (stats?.pairStats.find((p) => p.pool === selectedPool)?.label ?? selectedPool);

  return (
    <div className="flex h-full -m-8">
      <PairSidebarPanel
        pairs={pairs}
        selectedPool={selectedPool}
        onSelect={setSelectedPool}
        accentColor="green"
      />

      <div className="flex-1 flex flex-col overflow-auto p-6 gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-ds-gray-1000">
              Vote Dashboard — {selectedLabel}
            </h1>
            <p className="text-xs text-ds-gray-600 mt-0.5">
              Voter allocations · Epoch #{stats?.currentEpoch ?? '—'}
            </p>
          </div>
          <button
            onClick={() => fetchAll(selectedPool)}
            className="text-xs text-ds-gray-700 hover:text-ds-gray-900 border border-ds-gray-400 rounded px-3 py-1.5 transition-colors"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/20 border border-red-700/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-ds-background-200 rounded-lg p-4 border-l-4 border-emerald-500">
            <p className="text-[10px] text-ds-gray-600 uppercase tracking-wider">Vote Weight</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              {stats ? `${(stats.voteWeightBps / 100).toFixed(1)}%` : '—'}
            </p>
            <p className="text-[10px] text-ds-gray-600 mt-0.5">of epoch VP</p>
          </div>
          <div className="bg-ds-background-200 rounded-lg p-4 border-l-4 border-amber-500">
            <p className="text-[10px] text-ds-gray-600 uppercase tracking-wider">Unique Voters</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              {stats?.uniqueVoterCount ?? '—'}
            </p>
            <p className="text-[10px] text-ds-gray-600 mt-0.5">this epoch</p>
          </div>
          <div className="bg-ds-background-200 rounded-lg p-4 border-l-4 border-indigo-500">
            <p className="text-[10px] text-ds-gray-600 uppercase tracking-wider">Epoch</p>
            <p className="text-2xl font-bold text-indigo-400 mt-1">
              #{stats?.currentEpoch ?? '—'}
            </p>
            <p className="text-[10px] text-ds-gray-600 mt-0.5">current</p>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Bar chart */}
          <div className="bg-ds-background-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-emerald-400 mb-3">
              Vote Weight by Epoch
            </p>
            {loading ? (
              <div className="h-40 flex items-center justify-center text-xs text-ds-gray-600">Loading…</div>
            ) : barChartData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-ds-gray-600">No epoch data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barChartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: 'none', fontSize: 11 }} />
                  <Bar dataKey="weight" fill="#10b981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie chart */}
          <div className="bg-ds-background-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-amber-400 mb-3">
              Epoch #{distribution?.epoch ?? '—'} Distribution
            </p>
            {loading ? (
              <div className="h-40 flex items-center justify-center text-xs text-ds-gray-600">Loading…</div>
            ) : pieData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-ds-gray-600">No vote data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={60}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v: number) => [`${v.toFixed(1)}%`, 'Vote share']}
                    contentStyle={{ background: '#1e293b', border: 'none', fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Events table */}
        <div className="bg-ds-background-200 rounded-lg p-4 flex-1">
          <p className="text-xs font-semibold text-emerald-400 mb-3">Recent Vote Events</p>
          {loading ? (
            <p className="text-xs text-ds-gray-600">Loading…</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {(events?.events ?? []).length === 0 ? (
                <p className="text-xs text-ds-gray-600">No events</p>
              ) : (
                events?.events.map((ev) => (
                  <div key={ev.id} className="bg-ds-background-100 rounded px-3 py-2 text-xs">
                    <div className="flex justify-between mb-0.5">
                      <span
                        className={`font-medium ${
                          ev.eventType === 'Abstained' ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {ev.eventType.toUpperCase()}
                      </span>
                      <span className="text-ds-gray-600">{relativeTime(ev.blockTimestamp)}</span>
                    </div>
                    <div className="text-ds-gray-700">
                      {ev.owner.slice(0, 8)}…{ev.owner.slice(-4)} · lock #{ev.tokenId} ·{' '}
                      {(Number(ev.weight) / Number(ev.totalWeight) * 100).toFixed(1)}% VP
                    </div>
                    <div className="text-ds-gray-600 text-[10px] mt-0.5">
                      {ev.transactionHash.slice(0, 10)}… · Epoch #{ev.epochTimestamp ?? '?'}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm --filter @giwater/web exec tsc --noEmit 2>&1 | grep "admin/vote" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/admin/vote/page.tsx
git commit -m "feat(web): add /admin/vote dashboard page"
```

---

### Task 12: Sidebar navigation

**Files:**
- Modify: `apps/web/components/admin/Sidebar.tsx`

Add "Lock" and "Vote" items to the Management section, after the "Pools" item (around line 162).

- [ ] **Step 1: Add Lock and Vote nav items**

Find the "Pools" nav item block (around line 143–162):
```typescript
      {
        id: "pools",
        label: "Pools",
        href: "/admin/pools",
        icon: ( ... )
      },
```

After the closing `},` of the Pools item, insert:

```typescript
      {
        id: "lock",
        label: "Lock",
        href: "/admin/lock",
        icon: (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        ),
      },
      {
        id: "vote",
        label: "Vote",
        href: "/admin/vote",
        icon: (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
            />
          </svg>
        ),
      },
```

- [ ] **Step 2: Verify TypeScript and HTTP health**

```bash
pnpm --filter @giwater/web exec tsc --noEmit 2>&1 | head -10
curl -s -o /dev/null -w "%{http_code}" http://localhost:3007
```

Expected: tsc exits 0, curl returns `200`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/admin/Sidebar.tsx
git commit -m "feat(web): add Lock and Vote entries to admin sidebar navigation"
```
