# TradingView UDF Datafeed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose 5 TradingView UDF endpoints (`/udf/config`, `/udf/time`, `/udf/symbols`, `/udf/search`, `/udf/history`) on both the broker HTTP server and the gateway (via RabbitMQ RPC).

**Architecture:** UdfService queries `spot_pair_time_buckets` / `spot_token_time_buckets` directly and resolves symbols from `spot_pairs` / `spot_tokens`. The broker exposes routes under `@Controller('udf')`. The gateway parity controller proxies all 5 routes through the existing `apiInvoke` RPC path. GatewayRpcInvokeService gains a new `udf` branch that delegates to UdfService.

**Tech Stack:** NestJS, TypeORM, `@giwater/shared` DTOs, RabbitMQ RPC (existing `GatewayRabbitmqService.rpcToBroker`).

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `packages/shared/src/dto/udf.ts` | 4 DTO interfaces |
| Modify | `packages/shared/src/dto/index.ts` | Re-export udf.ts |
| Create | `apps/broker/src/api/udf/udf.service.ts` | Business logic: config, time, symbols, search, history |
| Create | `apps/broker/src/api/udf/udf.controller.ts` | NestJS @Controller('udf'), 5 routes |
| Create | `apps/broker/src/api/udf/udf.module.ts` | NestJS module, registers 4 TypeORM repos |
| Modify | `apps/broker/src/api/api.module.ts` | Import UdfModule |
| Modify | `apps/broker/src/gateway-rpc/gateway-rpc-invoke.module.ts` | Import UdfModule |
| Modify | `apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts` | Inject UdfService, add `udf` RPC branch |
| Modify | `apps/gateway/src/api/broker-http-parity.controller.ts` | 5 new @Get('udf/*') routes |

---

## Task 1: Shared DTOs

**Files:**
- Create: `packages/shared/src/dto/udf.ts`
- Modify: `packages/shared/src/dto/index.ts`

- [ ] **Step 1: Write udf.ts**

```typescript
// packages/shared/src/dto/udf.ts

export interface UdfConfigResponseDto {
  supported_resolutions: string[];
  exchanges: { value: string; name: string; desc: string }[];
  symbols_types: { name: string; value: string }[];
  supports_search: boolean;
  supports_group_request: boolean;
  supports_marks: boolean;
  supports_timescale_marks: boolean;
  supports_time: boolean;
}

export interface UdfSymbolInfoDto {
  name: string;
  ticker: string;
  description: string;
  type: 'pair' | 'token';
  exchange: string;
  listed_exchange: string;
  timezone: string;
  session: string;
  minmov: number;
  pricescale: number;
  has_intraday: boolean;
  has_daily: boolean;
  has_weekly_and_monthly: boolean;
  supported_resolutions: string[];
  volume_precision: number;
  data_status: string;
}

export interface UdfSearchResultItemDto {
  symbol: string;
  full_name: string;
  description: string;
  exchange: string;
  ticker: string;
  type: 'pair' | 'token';
}

export interface UdfHistoryResponseDto {
  s: 'ok' | 'no_data' | 'error';
  t?: number[];
  o?: number[];
  h?: number[];
  l?: number[];
  c?: number[];
  v?: number[];
  errmsg?: string;
}
```

- [ ] **Step 2: Add export to index.ts**

In `packages/shared/src/dto/index.ts`, add at the end:

```typescript
export * from './udf';
```

- [ ] **Step 3: Verify shared package builds**

```bash
pnpm --filter @giwater/shared build
```

Expected: no TypeScript errors, `dist/` updated.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/dto/udf.ts packages/shared/src/dto/index.ts
git commit -m "feat(shared): add UDF datafeed DTO interfaces"
```

---

## Task 2: UdfService

**Files:**
- Create: `apps/broker/src/api/udf/udf.service.ts`

- [ ] **Step 1: Create udf.service.ts**

```typescript
// apps/broker/src/api/udf/udf.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  UdfConfigResponseDto,
  UdfHistoryResponseDto,
  UdfSearchResultItemDto,
  UdfSymbolInfoDto,
} from '@giwater/shared';
import { SpotPairEntity } from '../../models/pair/spot-pair.entity';
import { SpotPairTimeBucketEntity } from '../../models/pair/spot-pair-time-bucket.entity';
import { SpotTokenEntity } from '../../models/token/spot-token.entity';
import { SpotTokenTimeBucketEntity } from '../../models/token/spot-token-time-bucket.entity';

const SUPPORTED_RESOLUTIONS = ['5', '60', '1D', '1W', '1M'];

const TV_TO_BROKER_RES: Record<string, string> = {
  '5': '1m',
  '60': '1h',
  '1D': '1d',
  '1W': '1w',
  '1M': '1mo',
};

const PERIOD_SECONDS: Record<string, number> = {
  '5': 300,
  '60': 3600,
  '1D': 86400,
  '1W': 604800,
  '1M': 2592000,
};

function computePricescale(close: number): number {
  if (!close || close <= 0 || !Number.isFinite(close)) return 100;
  const raw = Math.pow(10, Math.ceil(Math.log10(1 / close)));
  return Math.min(1e8, Math.max(1, raw));
}

@Injectable()
export class UdfService {
  constructor(
    @InjectRepository(SpotPairEntity)
    private readonly pairs: Repository<SpotPairEntity>,
    @InjectRepository(SpotPairTimeBucketEntity)
    private readonly pairBuckets: Repository<SpotPairTimeBucketEntity>,
    @InjectRepository(SpotTokenEntity)
    private readonly tokens: Repository<SpotTokenEntity>,
    @InjectRepository(SpotTokenTimeBucketEntity)
    private readonly tokenBuckets: Repository<SpotTokenTimeBucketEntity>,
  ) {}

  getConfig(): UdfConfigResponseDto {
    return {
      supported_resolutions: SUPPORTED_RESOLUTIONS,
      exchanges: [{ value: 'GIWATER', name: 'GiWaTer DEX', desc: '' }],
      symbols_types: [
        { name: 'Pair', value: 'pair' },
        { name: 'Token', value: 'token' },
      ],
      supports_search: true,
      supports_group_request: false,
      supports_marks: false,
      supports_timescale_marks: false,
      supports_time: true,
    };
  }

  getTime(): number {
    return Math.floor(Date.now() / 1000);
  }

  async resolveSymbol(
    ticker: string,
  ): Promise<UdfSymbolInfoDto | { s: 'error'; errmsg: string }> {
    const colonIdx = ticker.indexOf(':');
    if (colonIdx === -1) return { s: 'error', errmsg: 'Invalid ticker format' };

    const prefix = ticker.slice(0, colonIdx).toUpperCase();
    const address = ticker.slice(colonIdx + 1).toLowerCase();

    if (prefix === 'PAIR') {
      const pair = await this.pairs.findOne({ where: { address } });
      if (!pair) return { s: 'error', errmsg: 'Symbol not found' };

      const lastBucket = await this.pairBuckets.findOne({
        where: { pair: address, resolution: '1d' },
        order: { bucketStartTs: 'DESC' },
      });
      return {
        name: pair.symbol,
        ticker,
        description: `${pair.baseName} / ${pair.quoteName}`,
        type: 'pair',
        exchange: 'GIWATER',
        listed_exchange: 'GIWATER',
        timezone: 'Etc/UTC',
        session: '24x7',
        minmov: 1,
        pricescale: computePricescale(lastBucket?.close ?? 0),
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: true,
        supported_resolutions: SUPPORTED_RESOLUTIONS,
        volume_precision: 2,
        data_status: 'streaming',
      };
    }

    if (prefix === 'TOKEN') {
      const token = await this.tokens.findOne({ where: { address } });
      if (!token) return { s: 'error', errmsg: 'Symbol not found' };

      const lastBucket = await this.tokenBuckets.findOne({
        where: { token: address, resolution: '1d' },
        order: { bucketStartTs: 'DESC' },
      });
      return {
        name: token.symbol,
        ticker,
        description: token.name ?? token.symbol,
        type: 'token',
        exchange: 'GIWATER',
        listed_exchange: 'GIWATER',
        timezone: 'Etc/UTC',
        session: '24x7',
        minmov: 1,
        pricescale: computePricescale(lastBucket?.close ?? 0),
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: true,
        supported_resolutions: SUPPORTED_RESOLUTIONS,
        volume_precision: 2,
        data_status: 'streaming',
      };
    }

    return { s: 'error', errmsg: 'Invalid ticker format' };
  }

  async search(
    query: string,
    type: string,
    limit: number,
  ): Promise<UdfSearchResultItemDto[]> {
    const q = query.trim();
    const safeLimit = Math.min(100, Math.max(1, limit || 30));

    if (type === 'pair') {
      const qb = this.pairs.createQueryBuilder('p').where('p.listed = true');
      if (q) {
        qb.andWhere(
          '(p.symbol ILIKE :q OR p."baseName" ILIKE :q OR p."quoteName" ILIKE :q)',
          { q: `%${q}%` },
        );
      }
      const rows = await qb.take(safeLimit).getMany();
      return rows.map((p) => ({
        symbol: p.symbol,
        full_name: `GIWATER:${p.symbol}`,
        description: `${p.baseName} / ${p.quoteName}`,
        exchange: 'GIWATER',
        ticker: `PAIR:${p.address}`,
        type: 'pair' as const,
      }));
    }

    if (type === 'token') {
      const qb = this.tokens.createQueryBuilder('t').where('t.listed = true');
      if (q) {
        qb.andWhere('(t.symbol ILIKE :q OR t.name ILIKE :q)', {
          q: `%${q}%`,
        });
      }
      const rows = await qb.take(safeLimit).getMany();
      return rows.map((t) => ({
        symbol: t.symbol,
        full_name: `GIWATER:${t.symbol}`,
        description: t.name ?? t.symbol,
        exchange: 'GIWATER',
        ticker: `TOKEN:${t.address}`,
        type: 'token' as const,
      }));
    }

    return [];
  }

  async getHistory(
    ticker: string,
    resolution: string,
    from: number,
    to: number,
    countback?: number,
  ): Promise<UdfHistoryResponseDto> {
    const brokerRes = TV_TO_BROKER_RES[resolution];
    if (!brokerRes) return { s: 'error', errmsg: 'Unsupported resolution' };

    const colonIdx = ticker.indexOf(':');
    if (colonIdx === -1) return { s: 'error', errmsg: 'Invalid ticker format' };

    const prefix = ticker.slice(0, colonIdx).toUpperCase();
    const address = ticker.slice(colonIdx + 1).toLowerCase();

    let effectiveFrom = from;
    if (countback != null && countback > 0) {
      effectiveFrom = to - countback * (PERIOD_SECONDS[resolution] ?? 300);
    }

    if (prefix === 'PAIR') {
      const qb = this.pairBuckets
        .createQueryBuilder('b')
        .where('b.pair = :addr', { addr: address })
        .andWhere('b.resolution = :res', { res: brokerRes })
        .andWhere('b.bucketStartTs >= :from', { from: effectiveFrom })
        .andWhere('b.bucketStartTs < :to', { to })
        .orderBy('b.bucketStartTs', 'ASC');

      if (countback != null && countback > 0) {
        qb.take(countback);
      }

      const rows = await qb.getMany();
      if (rows.length === 0) return { s: 'no_data' };
      return {
        s: 'ok',
        t: rows.map((r) => r.bucketStartTs),
        o: rows.map((r) => r.open),
        h: rows.map((r) => r.high),
        l: rows.map((r) => r.low),
        c: rows.map((r) => r.close),
        v: rows.map((r) => r.baseVolumeUSD + r.quoteVolumeUSD),
      };
    }

    if (prefix === 'TOKEN') {
      const qb = this.tokenBuckets
        .createQueryBuilder('b')
        .where('b.token = :addr', { addr: address })
        .andWhere('b.resolution = :res', { res: brokerRes })
        .andWhere('b.bucketStartTs >= :from', { from: effectiveFrom })
        .andWhere('b.bucketStartTs < :to', { to })
        .orderBy('b.bucketStartTs', 'ASC');

      if (countback != null && countback > 0) {
        qb.take(countback);
      }

      const rows = await qb.getMany();
      if (rows.length === 0) return { s: 'no_data' };
      return {
        s: 'ok',
        t: rows.map((r) => r.bucketStartTs),
        o: rows.map((r) => r.open),
        h: rows.map((r) => r.high),
        l: rows.map((r) => r.low),
        c: rows.map((r) => r.close),
        v: rows.map((r) => r.volumeUSD),
      };
    }

    return { s: 'error', errmsg: 'Invalid ticker format' };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/broker/src/api/udf/udf.service.ts
git commit -m "feat(broker): add UdfService with config/time/symbols/search/history"
```

---

## Task 3: UdfController

**Files:**
- Create: `apps/broker/src/api/udf/udf.controller.ts`

- [ ] **Step 1: Create udf.controller.ts**

```typescript
// apps/broker/src/api/udf/udf.controller.ts
import {
  Controller,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type {
  UdfConfigResponseDto,
  UdfHistoryResponseDto,
  UdfSearchResultItemDto,
  UdfSymbolInfoDto,
} from '@giwater/shared';
import { UdfService } from './udf.service';

@ApiTags('udf')
@Controller('udf')
export class UdfController {
  constructor(private readonly udf: UdfService) {}

  @Get('config')
  @ApiOperation({ summary: 'TradingView UDF: datafeed capabilities' })
  config(): UdfConfigResponseDto {
    return this.udf.getConfig();
  }

  @Get('time')
  @ApiOperation({ summary: 'TradingView UDF: current server unix timestamp (plain integer)' })
  time(@Res() res: Response): void {
    res.send(String(this.udf.getTime()));
  }

  @Get('symbols')
  @ApiOperation({ summary: 'TradingView UDF: resolve ticker to SymbolInfo' })
  @ApiQuery({ name: 'symbol', required: true, description: 'Ticker: PAIR:0x... or TOKEN:0x...' })
  async symbols(
    @Query('symbol') symbol: string,
  ): Promise<UdfSymbolInfoDto | { s: 'error'; errmsg: string }> {
    if (!symbol?.trim()) {
      return { s: 'error', errmsg: 'symbol parameter is required' };
    }
    return this.udf.resolveSymbol(symbol.trim());
  }

  @Get('search')
  @ApiOperation({ summary: 'TradingView UDF: symbol search' })
  @ApiQuery({ name: 'query', required: false, description: 'Search string' })
  @ApiQuery({ name: 'type', required: true, enum: ['pair', 'token'] })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results (default 30, max 100)' })
  async search(
    @Query('query') query: string = '',
    @Query('type') type: string = '',
    @Query('limit') limit: string = '30',
  ): Promise<UdfSearchResultItemDto[]> {
    return this.udf.search(query ?? '', type ?? '', parseInt(limit, 10) || 30);
  }

  @Get('history')
  @ApiOperation({ summary: 'TradingView UDF: OHLCV bars' })
  @ApiQuery({ name: 'symbol', required: true })
  @ApiQuery({ name: 'resolution', required: true, enum: ['5', '60', '1D', '1W', '1M'] })
  @ApiQuery({ name: 'from', required: true, type: Number, description: 'Unix timestamp (seconds)' })
  @ApiQuery({ name: 'to', required: true, type: Number, description: 'Unix timestamp (seconds)' })
  @ApiQuery({ name: 'countback', required: false, type: Number })
  async history(
    @Query('symbol') symbol: string,
    @Query('resolution') resolution: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('countback') countback?: string,
  ): Promise<UdfHistoryResponseDto> {
    if (!symbol?.trim() || !resolution?.trim() || !from || !to) {
      return { s: 'error', errmsg: 'symbol, resolution, from, to are required' };
    }
    return this.udf.getHistory(
      symbol.trim(),
      resolution.trim(),
      Number(from),
      Number(to),
      countback ? Number(countback) : undefined,
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/broker/src/api/udf/udf.controller.ts
git commit -m "feat(broker): add UdfController with 5 UDF HTTP routes"
```

---

## Task 4: UdfModule

**Files:**
- Create: `apps/broker/src/api/udf/udf.module.ts`

- [ ] **Step 1: Create udf.module.ts**

```typescript
// apps/broker/src/api/udf/udf.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpotPairEntity } from '../../models/pair/spot-pair.entity';
import { SpotPairTimeBucketEntity } from '../../models/pair/spot-pair-time-bucket.entity';
import { SpotTokenEntity } from '../../models/token/spot-token.entity';
import { SpotTokenTimeBucketEntity } from '../../models/token/spot-token-time-bucket.entity';
import { UdfController } from './udf.controller';
import { UdfService } from './udf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SpotPairEntity,
      SpotPairTimeBucketEntity,
      SpotTokenEntity,
      SpotTokenTimeBucketEntity,
    ]),
  ],
  controllers: [UdfController],
  providers: [UdfService],
  exports: [UdfService],
})
export class UdfModule {}
```

- [ ] **Step 2: Commit**

```bash
git add apps/broker/src/api/udf/udf.module.ts
git commit -m "feat(broker): add UdfModule"
```

---

## Task 5: Wire UdfModule into ApiModule

**Files:**
- Modify: `apps/broker/src/api/api.module.ts`

- [ ] **Step 1: Import UdfModule**

In `apps/broker/src/api/api.module.ts`, add the import and add `UdfModule` to the `imports` array:

```typescript
// Add to existing imports at top of file:
import { UdfModule } from './udf/udf.module';

// Inside @Module({ imports: [...] }), add:
UdfModule,
```

Full updated imports section of `api.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm/dist/typeorm.module';
import { HealthController } from './health.controller';
import { IndexedEventsController } from './indexed-events.controller';
import { SpotPairGroupsController } from './pair/spot-pair-groups.controller';
import { SpotPairsController } from './pair/spot-pairs.controller';
import { AdminPoolsController } from './pair/admin-pools.controller';
import { SpotTokenGroupsController } from './token/spot-token-groups.controller';
import { SpotTokensController } from './token/spot-tokens.controller';
import { ContractsController } from './contracts.controller';
import { SwapRoutesController } from './swap-routes.controller';
import { SwapsController } from './swaps.controller';
import { AdminExchangeController } from './exchange/admin-exchange.controller';
import { SpotAccountController } from './account/spot-account.controller';
import { SpotAccountLpService } from './account/spot-account-lp.service';
import { SpotAccountStakeService } from './account/spot-account-stake.service';
import { IndexerEventsModule } from '../indexer-events/indexer-events.module';
import { BrokerSwapHopModule } from '../swap-hop/broker-swap-hop.module';
import { SpotCatalogModule } from '../spot-catalog/spot-catalog.module';
import { DynamicSwapFeeModule } from '../dynamic-fee/dynamic-swap-fee.module';
import { SwapLiquidityModule } from '../swap-liquidity/swap-liquidity.module';
import { ExchangeModule } from '../exchange/exchange.module';
import { SpotTokenEntity } from '../models/token/spot-token.entity';
import { SpotAccountLiquidityProvisionEntity } from '../models/account/spot-account-liquidity-provision.entity';
import { SpotAccountStakeEventEntity } from '../models/account/spot-account-stake-event.entity';
import { SpotPairEntity } from '../models/pair/spot-pair.entity';
import { StakingViewModule } from '../staking-view/staking-view.module';
import { UdfModule } from './udf/udf.module';
```

And in the `@Module` decorator:
```typescript
@Module({
  imports: [
    IndexerEventsModule,
    BrokerSwapHopModule,
    SwapLiquidityModule,
    SpotCatalogModule,
    DynamicSwapFeeModule,
    ExchangeModule,
    StakingViewModule,
    UdfModule,
    TypeOrmModule.forFeature([SpotTokenEntity, SpotAccountLiquidityProvisionEntity, SpotAccountStakeEventEntity, SpotPairEntity]),
  ],
  // ... rest unchanged
```

- [ ] **Step 2: Verify broker TypeScript compiles**

```bash
pnpm --filter @giwater/broker exec tsc --noEmit 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/broker/src/api/api.module.ts
git commit -m "feat(broker): register UdfModule in ApiModule"
```

---

## Task 6: Wire UdfService into GatewayRpcInvokeService

**Files:**
- Modify: `apps/broker/src/gateway-rpc/gateway-rpc-invoke.module.ts`
- Modify: `apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts`

- [ ] **Step 1: Add UdfModule to GatewayRpcInvokeModule**

In `apps/broker/src/gateway-rpc/gateway-rpc-invoke.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DynamicSwapFeeModule } from '../dynamic-fee/dynamic-swap-fee.module';
import { SpotCatalogModule } from '../spot-catalog/spot-catalog.module';
import { SwapLiquidityModule } from '../swap-liquidity/swap-liquidity.module';
import { BrokerSwapHopModule } from '../swap-hop/broker-swap-hop.module';
import { UdfModule } from '../api/udf/udf.module';
import { GatewayRpcInvokeService } from './gateway-rpc-invoke.service';

@Module({
  imports: [
    SpotCatalogModule,
    SwapLiquidityModule,
    DynamicSwapFeeModule,
    BrokerSwapHopModule,
    UdfModule,
  ],
  providers: [GatewayRpcInvokeService],
  exports: [GatewayRpcInvokeService],
})
export class GatewayRpcInvokeModule {}
```

- [ ] **Step 2: Inject UdfService and add udf branch in GatewayRpcInvokeService**

In `apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts`:

**2a.** Add the import at the top (with existing imports):

```typescript
import { UdfService } from '../api/udf/udf.service';
```

**2b.** Add `udfService` to the constructor (after the existing last parameter `dynamicSwapFeeReadModel`):

```typescript
constructor(
  private readonly spotCatalog: SpotCatalogService,
  private readonly swapGraph: SwapLiquidityGraphService,
  private readonly swapRouteSpotPairQuote: SwapRouteSpotPairQuoteService,
  private readonly spotGroups: SpotGroupsService,
  private readonly indexerPersistence: IndexerEventPersistenceService,
  private readonly brokerSwapHopQuery: BrokerSwapHopQueryService,
  private readonly dynamicSwapFeeReadModel: DynamicSwapFeeReadModelService,
  private readonly udfService: UdfService,
) {}
```

**2c.** Add the `udf` branch **before** the final catch-all `this.logger.debug(...)` line (which is at the end of the `try` block, around line 614). Insert after the `spot-pair-groups` block closing brace:

```typescript
      if (a === 'udf') {
        if (method === 'GET' && b === 'config') {
          return { ok: true, statusCode: 200, body: this.udfService.getConfig() };
        }
        if (method === 'GET' && b === 'time') {
          return { ok: true, statusCode: 200, body: this.udfService.getTime() };
        }
        if (method === 'GET' && b === 'symbols') {
          const symbol = query.symbol;
          if (!symbol?.trim()) {
            return { ok: false, statusCode: 400, error: 'symbol parameter is required' };
          }
          return { ok: true, statusCode: 200, body: await this.udfService.resolveSymbol(String(symbol).trim()) };
        }
        if (method === 'GET' && b === 'search') {
          const q = String(query.query ?? '');
          const type = String(query.type ?? '');
          const limit = parseInt(String(query.limit ?? '30'), 10) || 30;
          return { ok: true, statusCode: 200, body: await this.udfService.search(q, type, limit) };
        }
        if (method === 'GET' && b === 'history') {
          const symbol = query.symbol;
          const resolution = query.resolution;
          const from = query.from;
          const to = query.to;
          if (!symbol?.trim() || !resolution?.trim() || !from || !to) {
            return { ok: false, statusCode: 400, error: 'symbol, resolution, from, to are required' };
          }
          return {
            ok: true,
            statusCode: 200,
            body: await this.udfService.getHistory(
              String(symbol).trim(),
              String(resolution).trim(),
              Number(from),
              Number(to),
              query.countback ? Number(query.countback) : undefined,
            ),
          };
        }
        return { ok: false, statusCode: 404, error: `No UDF route: ${method} ${path}` };
      }
```

- [ ] **Step 3: Verify broker TypeScript compiles**

```bash
pnpm --filter @giwater/broker exec tsc --noEmit 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/broker/src/gateway-rpc/gateway-rpc-invoke.module.ts \
        apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts
git commit -m "feat(broker): wire UdfService into GatewayRpcInvokeService for RPC routing"
```

---

## Task 7: Gateway Parity Routes

**Files:**
- Modify: `apps/gateway/src/api/broker-http-parity.controller.ts`

Add 5 new routes at the end of the class (before the closing `}`). The `/udf/time` route needs `@Res()` to send a plain-text integer. All others return `unknown`.

- [ ] **Step 1: Add udf routes**

Append the following methods to `BrokerHttpParityController` (add `Res` to existing NestJS imports if not present, and add `import type { Response } from 'express';`):

```typescript
  @Get('udf/config')
  @ApiOperation({ summary: 'Broker parity: GET /udf/config' })
  async udfConfig(): Promise<unknown> {
    return this.proxy('GET', '/udf/config');
  }

  @Get('udf/time')
  @ApiOperation({ summary: 'Broker parity: GET /udf/time — plain integer response' })
  async udfTime(@Res() res: Response): Promise<void> {
    const body = await this.proxy('GET', '/udf/time');
    res.send(String(body));
  }

  @Get('udf/symbols')
  @ApiOperation({ summary: 'Broker parity: GET /udf/symbols' })
  @ApiQuery({ name: 'symbol', required: true, description: 'Ticker: PAIR:0x... or TOKEN:0x...' })
  async udfSymbols(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/udf/symbols', query);
  }

  @Get('udf/search')
  @ApiOperation({ summary: 'Broker parity: GET /udf/search' })
  @ApiQuery({ name: 'query', required: false })
  @ApiQuery({ name: 'type', required: true, enum: ['pair', 'token'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async udfSearch(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/udf/search', query);
  }

  @Get('udf/history')
  @ApiOperation({ summary: 'Broker parity: GET /udf/history' })
  @ApiQuery({ name: 'symbol', required: true })
  @ApiQuery({ name: 'resolution', required: true })
  @ApiQuery({ name: 'from', required: true, type: Number })
  @ApiQuery({ name: 'to', required: true, type: Number })
  @ApiQuery({ name: 'countback', required: false, type: Number })
  async udfHistory(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.proxy('GET', '/udf/history', query);
  }
```

Also add `Res` to the NestJS import if it isn't there yet:

```typescript
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Res,        // ADD THIS
} from '@nestjs/common';
import type { Response } from 'express';   // ADD THIS
```

- [ ] **Step 2: Verify gateway TypeScript compiles**

```bash
pnpm --filter @giwater/gateway exec tsc --noEmit 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/gateway/src/api/broker-http-parity.controller.ts
git commit -m "feat(gateway): add UDF parity routes forwarding to broker via RPC"
```

---

## Task 8: Full Build Verification

- [ ] **Step 1: Build shared package**

```bash
pnpm --filter @giwater/shared build
```

Expected: success.

- [ ] **Step 2: Build broker**

```bash
pnpm --filter @giwater/broker exec tsc --noEmit 2>&1 | tail -30
```

Expected: no errors.

- [ ] **Step 3: Build gateway**

```bash
pnpm --filter @giwater/gateway exec tsc --noEmit 2>&1 | tail -30
```

Expected: no errors.

- [ ] **Step 4: Smoke test broker UDF endpoints (if running locally)**

```bash
# Config
curl -s http://localhost:3033/udf/config | jq '.supported_resolutions'
# Expected: ["5","60","1D","1W","1M"]

# Time
curl -s http://localhost:3033/udf/time
# Expected: plain integer like 1715600000

# Search
curl -s "http://localhost:3033/udf/search?type=pair&limit=5" | jq '.[0]'
# Expected: object with symbol, ticker (PAIR:0x...), type: "pair"
```

- [ ] **Step 5: Final commit if any adjustments made**

```bash
git add -p
git commit -m "fix(broker/gateway): UDF build verification adjustments"
```

---

## Resolution Reference

| TV resolution | Broker resolution | Period (seconds) |
|--------------|-------------------|-----------------|
| `5` | `1m` | 300 (5-min cron minimum) |
| `60` | `1h` | 3600 |
| `1D` | `1d` | 86400 |
| `1W` | `1w` | 604800 |
| `1M` | `1mo` | 2592000 |

## Key Entity Fields Used

**SpotPairEntity:** `address`, `symbol`, `baseName`, `quoteName`, `listed`

**SpotTokenEntity:** `address`, `symbol`, `name`, `listed`

**SpotPairTimeBucketEntity:** `pair`, `resolution`, `bucketStartTs`, `open`, `high`, `low`, `close`, `baseVolumeUSD`, `quoteVolumeUSD`

**SpotTokenTimeBucketEntity:** `token`, `resolution`, `bucketStartTs`, `open`, `high`, `low`, `close`, `volumeUSD`
