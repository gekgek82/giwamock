# Config-Service Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract banners, referral, admin_watched_wallets, and token_faucets tables from broker into a new standalone `config-service` NestJS app with its own Postgres database, so the broker DB can be safely pruned without destroying admin/user-managed config data.

**Architecture:** Gateway's `BrokerProxyController` calls `resolveBrokerTarget(path)` from `@giwater/shared` to decide whether to forward via RabbitMQ RPC to broker (`broker.rpc`) or config-service (`config-service.rpc`). Config-service mirrors broker's RPC handler pattern. See `docs/superpowers/specs/2026-05-17-config-service-split-design.md`.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL, amqp-connection-manager, pnpm workspace, Railway

---

## File Structure

```
packages/shared/src/
  broker-routing.ts          ← NEW: resolveBrokerTarget(), BROKER_ROUTE_REGISTRY

apps/gateway/src/
  config/configuration.ts    ← ADD configServiceRpcQueue
  rabbitmq/gateway-rabbitmq.service.ts  ← ADD rpcToConfigService()
  api/broker-proxy.controller.ts        ← UPDATE invoke() to route by target

apps/config-service/               ← NEW APP
  package.json
  tsconfig.json
  nest-cli.json
  src/
    main.ts
    app.module.ts
    data-source.ts
    config/configuration.ts
    config-db/config-db.module.ts
    migrations/1748100000000-InitialConfigSchema.ts
    models/
      banner/banner.entity.ts
      referral/referral-code.entity.ts
      referral/referral-relationship.entity.ts
      referral/referral-tier-badge.entity.ts
      admin/admin-watched-wallet.entity.ts
      faucet/token-faucet.entity.ts
    api/
      banner/banner.service.ts
      referral/referral.service.ts
      admin-watched-wallets/admin-watched-wallets.service.ts
      token-faucets/token-faucets.service.ts
      admin-watched-wallets/admin-watched-wallets.controller.ts
      token-faucets/token-faucets.controller.ts
    gateway-rpc/
      config-rpc-invoke.service.ts
      config-rpc-invoke.module.ts
    rabbitmq/
      config-rabbitmq.service.ts
      config-rabbitmq.module.ts
  scripts/
    migrate-from-broker.ts

apps/web/app/api/config-admin/[...path]/
  route.ts                   ← NEW: proxy to CONFIG_ADMIN_URL

apps/broker/src/
  broker-db/broker-db.module.ts         ← REMOVE config entities/migrations
  api/api.module.ts                     ← REMOVE config controllers/services
  gateway-rpc/gateway-rpc-invoke.module.ts  ← REMOVE BannerEntity
  gateway-rpc/gateway-rpc-invoke.service.ts ← REMOVE banners/referral routes
```

---

## Task 1: Add `resolveBrokerTarget` to `@giwater/shared`

**Files:**
- Create: `packages/shared/src/broker-routing.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `packages/shared/src/broker-routing.ts`**

```typescript
export type BrokerTarget = 'broker' | 'config';

export const BROKER_ROUTE_REGISTRY: Array<{ pattern: RegExp; target: BrokerTarget }> = [
  { pattern: /^\/banners(\/|$)/, target: 'config' },
  { pattern: /^\/referral(\/|$)/, target: 'config' },
  { pattern: /^\/admin\/watched-wallets(\/|$)/, target: 'config' },
  { pattern: /^\/token-faucets(\/|$)/, target: 'config' },
];

export function resolveBrokerTarget(path: string): BrokerTarget {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return BROKER_ROUTE_REGISTRY.find(({ pattern }) => pattern.test(normalized))?.target ?? 'broker';
}
```

- [ ] **Step 2: Export from `packages/shared/src/index.ts`**

Add this line at the end of `packages/shared/src/index.ts`:

```typescript
export * from './broker-routing';
```

- [ ] **Step 3: Build shared to verify no compile errors**

Run: `pnpm --filter @giwater/shared build`

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/broker-routing.ts packages/shared/src/index.ts
git commit -m "feat(shared): add resolveBrokerTarget and BROKER_ROUTE_REGISTRY"
```

---

## Task 2: Update gateway to route to config-service via RPC

**Files:**
- Modify: `apps/gateway/src/config/configuration.ts`
- Modify: `apps/gateway/src/rabbitmq/gateway-rabbitmq.service.ts`
- Modify: `apps/gateway/src/api/broker-proxy.controller.ts`

- [ ] **Step 1: Add `configServiceRpcQueue` to `apps/gateway/src/config/configuration.ts`**

In the `GatewayConfig` interface, add to `rabbitmq`:

```typescript
rabbitmq: {
  url: string;
  brokerRpcQueue: string;
  configServiceRpcQueue: string;   // ← ADD THIS
  gatewayExchange: string;
  notificationBindingKey: string;
  rpcTimeoutMs: number;
};
```

In the default export factory, add inside `rabbitmq: { ... }`:

```typescript
configServiceRpcQueue:
  process.env.CONFIG_SERVICE_RPC_QUEUE ?? 'config-service.rpc',
```

The full updated `rabbitmq` block in the factory:

```typescript
rabbitmq: {
  url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
  brokerRpcQueue:
    process.env.RABBITMQ_BROKER_RPC_QUEUE ?? 'broker.rpc',
  configServiceRpcQueue:
    process.env.CONFIG_SERVICE_RPC_QUEUE ?? 'config-service.rpc',
  gatewayExchange:
    process.env.RABBITMQ_GATEWAY_EXCHANGE ?? 'giwater.gateway',
  notificationBindingKey:
    process.env.RABBITMQ_GATEWAY_BINDING_KEY ?? '#',
  rpcTimeoutMs: parseInt(process.env.RABBITMQ_RPC_TIMEOUT_MS ?? '15000', 10),
},
```

- [ ] **Step 2: Add `rpcToConfigService()` to `apps/gateway/src/rabbitmq/gateway-rabbitmq.service.ts`**

Add the following method after `rpcToBroker()`. It reuses the same `rpcChannel` (same reply queue, different destination):

```typescript
async rpcToConfigService(body: Record<string, unknown>): Promise<unknown> {
  const ch = this.rpcChannel;
  const replyTo = this.replyQueueName;
  if (!ch || !replyTo) {
    throw new Error('RabbitMQ RPC channel not ready');
  }

  const correlationId = randomUUID();
  const { configServiceRpcQueue, rpcTimeoutMs } = this.cfg;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      this.pending.delete(correlationId);
      reject(new Error(`Config-service RPC timeout after ${rpcTimeoutMs}ms`));
    }, rpcTimeoutMs);

    this.pending.set(correlationId, { resolve, reject, timer });

    void ch
      .sendToQueue(
        configServiceRpcQueue,
        Buffer.from(JSON.stringify(body)),
        {
          correlationId,
          replyTo,
          persistent: true,
          contentType: 'application/json',
        },
      )
      .then((sent) => {
        if (!sent) {
          clearTimeout(timer);
          this.pending.delete(correlationId);
          reject(new Error('Failed to send RPC to config-service (channel backpressure?)'));
        }
      })
      .catch((err: Error) => {
        clearTimeout(timer);
        this.pending.delete(correlationId);
        reject(err);
      });
  });
}
```

- [ ] **Step 3: Update `apps/gateway/src/api/broker-proxy.controller.ts` to route by target**

Replace the import at the top to add `resolveBrokerTarget`:

```typescript
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  BrokerGatewayHttpLikeRequest,
  BrokerGatewayRpcResponseDto,
} from '@giwater/shared';
import { resolveBrokerTarget } from '@giwater/shared';
import { GatewayRabbitmqService } from '../rabbitmq/gateway-rabbitmq.service';
```

Replace the `invoke()` method body:

```typescript
async invoke(@Body() body: BrokerGatewayHttpLikeRequest): Promise<unknown> {
  if (!body?.method?.trim() || !body?.path?.trim()) {
    throw new BadRequestException('`method` and `path` are required');
  }

  const target = resolveBrokerTarget(body.path);
  const rpcBody = {
    action: 'apiInvoke',
    request: {
      method: body.method,
      path: body.path,
      query: body.query ?? {},
      body: body.body ?? null,
    },
  };

  const raw = (
    target === 'config'
      ? await this.rabbit.rpcToConfigService(rpcBody)
      : await this.rabbit.rpcToBroker(rpcBody)
  ) as BrokerGatewayRpcResponseDto;

  if (!raw || typeof raw !== 'object' || typeof raw.ok !== 'boolean') {
    throw new HttpException('Invalid RPC response', 502);
  }
  if (!raw.ok) {
    throw new HttpException(raw, raw.statusCode ?? 500);
  }
  return raw.body;
}
```

- [ ] **Step 4: Typecheck gateway**

Run: `pnpm --filter @giwater/gateway typecheck`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/gateway/src/config/configuration.ts \
        apps/gateway/src/rabbitmq/gateway-rabbitmq.service.ts \
        apps/gateway/src/api/broker-proxy.controller.ts
git commit -m "feat(gateway): route broker RPC calls to config-service via resolveBrokerTarget"
```

---

## Task 3: Scaffold `apps/config-service`

**Files:**
- Create: `apps/config-service/package.json`
- Create: `apps/config-service/tsconfig.json`
- Create: `apps/config-service/nest-cli.json`

- [ ] **Step 1: Create `apps/config-service/package.json`**

```json
{
  "name": "@giwater/config-service",
  "version": "0.0.1",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "build": "pnpm --filter @giwater/shared build && nest build",
    "dev": "nest start --watch",
    "start": "nest start",
    "start:prod": "node dist/main.js",
    "typeorm": "typeorm-ts-node-commonjs -d src/data-source.ts",
    "migration:run": "pnpm typeorm migration:run",
    "migration:revert": "pnpm typeorm migration:revert",
    "migration:generate": "pnpm typeorm migration:generate",
    "migration:show": "pnpm typeorm migration:show",
    "lint": "eslint \"src/**/*.ts\"",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@giwater/shared": "workspace:*",
    "@nestjs/common": "^11.0.1",
    "@nestjs/config": "^4.0.2",
    "@nestjs/core": "^11.0.1",
    "@nestjs/platform-express": "^11.0.1",
    "@nestjs/typeorm": "^11.0.0",
    "amqp-connection-manager": "^4.1.14",
    "amqplib": "^0.10.4",
    "pg": "^8.17.2",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "typeorm": "^0.3.28"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@types/amqplib": "^0.10.6",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.7",
    "typescript": "^5.7.3"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create `apps/config-service/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "resolvePackageJsonExports": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "strictPropertyInitialization": false,
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `apps/config-service/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 4: Run pnpm install to register the new workspace package**

Run: `pnpm install`

Expected: `@giwater/config-service` linked in node_modules.

- [ ] **Step 5: Commit**

```bash
git add apps/config-service/package.json apps/config-service/tsconfig.json apps/config-service/nest-cli.json pnpm-lock.yaml
git commit -m "chore(config-service): scaffold package.json, tsconfig, nest-cli"
```

---

## Task 4: Config-service configuration, main, app skeleton

**Files:**
- Create: `apps/config-service/src/config/configuration.ts`
- Create: `apps/config-service/src/main.ts`
- Create: `apps/config-service/src/app.module.ts`
- Create: `apps/config-service/src/data-source.ts`

- [ ] **Step 1: Create `apps/config-service/src/config/configuration.ts`**

```typescript
export interface ConfigServiceConfig {
  port: number;
  configDb: {
    url: string;
  };
  rabbitmq: {
    url: string;
    rpcQueue: string;
  };
}

export default (): ConfigServiceConfig => ({
  port: parseInt(process.env.PORT ?? '3047', 10),
  configDb: {
    url:
      process.env.CONFIG_DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/giwater_config',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
    rpcQueue: process.env.RABBITMQ_RPC_QUEUE ?? 'config-service.rpc',
  },
});
```

- [ ] **Step 2: Create `apps/config-service/src/main.ts`**

```typescript
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('port');
  await app.listen(port);

  logger.log(`Config-service HTTP listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Create `apps/config-service/src/app.module.ts`** (stub — will be filled in Task 7)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Create `apps/config-service/src/data-source.ts`** (for TypeORM CLI)

```typescript
import { DataSource } from 'typeorm';
import { BannerEntity } from './models/banner/banner.entity';
import { ReferralCodeEntity } from './models/referral/referral-code.entity';
import { ReferralRelationshipEntity } from './models/referral/referral-relationship.entity';
import { ReferralTierBadgeEntity } from './models/referral/referral-tier-badge.entity';
import { AdminWatchedWalletEntity } from './models/admin/admin-watched-wallet.entity';
import { TokenFaucetEntity } from './models/faucet/token-faucet.entity';
import { InitialConfigSchema1748100000000 } from './migrations/1748100000000-InitialConfigSchema';

export default new DataSource({
  type: 'postgres',
  url: process.env.CONFIG_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/giwater_config',
  entities: [
    BannerEntity,
    ReferralCodeEntity,
    ReferralRelationshipEntity,
    ReferralTierBadgeEntity,
    AdminWatchedWalletEntity,
    TokenFaucetEntity,
  ],
  migrations: [InitialConfigSchema1748100000000],
  synchronize: false,
});
```

- [ ] **Step 5: Commit skeleton**

```bash
git add apps/config-service/src/
git commit -m "feat(config-service): add configuration, main, app skeleton"
```

---

## Task 5: Config-service entities + DB module + migration

**Files:**
- Create: `apps/config-service/src/models/banner/banner.entity.ts`
- Create: `apps/config-service/src/models/referral/referral-code.entity.ts`
- Create: `apps/config-service/src/models/referral/referral-relationship.entity.ts`
- Create: `apps/config-service/src/models/referral/referral-tier-badge.entity.ts`
- Create: `apps/config-service/src/models/admin/admin-watched-wallet.entity.ts`
- Create: `apps/config-service/src/models/faucet/token-faucet.entity.ts`
- Create: `apps/config-service/src/migrations/1748100000000-InitialConfigSchema.ts`
- Create: `apps/config-service/src/config-db/config-db.module.ts`

- [ ] **Step 1: Create `apps/config-service/src/models/banner/banner.entity.ts`**

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { BannerPage, BannerClickTarget } from '@giwater/shared';

@Entity('banners')
export class BannerEntity {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'page', type: 'varchar', length: 50 })
  page: BannerPage;

  @Column({ name: 'link_url', type: 'text', nullable: true })
  linkUrl: string | null;

  @Column({ name: 'click_target', type: 'varchar', length: 20, default: 'NEW_TAB' })
  clickTarget: BannerClickTarget;

  @Column({ name: 'image_pc_data', type: 'text', nullable: true })
  imagePcData: string | null;

  @Column({ name: 'image_mobile_data', type: 'text', nullable: true })
  imageMobileData: string | null;

  @Column({ name: 'start_at', type: 'timestamptz', nullable: true })
  startAt: Date | null;

  @Column({ name: 'end_at', type: 'timestamptz', nullable: true })
  endAt: Date | null;

  @Column({ name: 'impressions', type: 'integer', default: 0 })
  impressions: number;

  @Column({ name: 'clicks', type: 'integer', default: 0 })
  clicks: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Create `apps/config-service/src/models/referral/referral-code.entity.ts`**

```typescript
import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'referral_codes' })
export class ReferralCodeEntity {
  @PrimaryColumn({ type: 'text' })
  address!: string;

  @Column({ type: 'text', unique: true })
  code!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
```

- [ ] **Step 3: Create `apps/config-service/src/models/referral/referral-relationship.entity.ts`**

```typescript
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'referral_relationships' })
export class ReferralRelationshipEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  referrerAddress!: string;

  @Column({ type: 'text', unique: true })
  refereeAddress!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
```

- [ ] **Step 4: Create `apps/config-service/src/models/referral/referral-tier-badge.entity.ts`**

```typescript
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'referral_tier_badges' })
export class ReferralTierBadgeEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  address!: string;

  @Column({ type: 'text' })
  badgeType!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  grantedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  grantedBy!: string | null;
}
```

- [ ] **Step 5: Create `apps/config-service/src/models/admin/admin-watched-wallet.entity.ts`**

```typescript
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'admin_watched_wallets' })
export class AdminWatchedWalletEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  address!: string;

  @Column({ type: 'text', default: '' })
  label!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
```

- [ ] **Step 6: Create `apps/config-service/src/models/faucet/token-faucet.entity.ts`**

```typescript
import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('token_faucets')
export class TokenFaucetEntity {
  @PrimaryColumn({ name: 'faucet_address', type: 'varchar', length: 42 })
  faucetAddress: string;

  @Column({ name: 'token_address', type: 'varchar', length: 42 })
  tokenAddress: string;

  @Column({ name: 'token_name', type: 'varchar', length: 100 })
  tokenName: string;

  @Column({ name: 'token_symbol', type: 'varchar', length: 20 })
  tokenSymbol: string;

  @Column({ name: 'token_decimals', type: 'integer', default: 18 })
  tokenDecimals: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

- [ ] **Step 7: Create `apps/config-service/src/migrations/1748100000000-InitialConfigSchema.ts`**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialConfigSchema1748100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "banners" (
        "id" SERIAL PRIMARY KEY,
        "title" varchar(255) NOT NULL,
        "page" varchar(50) NOT NULL,
        "link_url" text NULL,
        "click_target" varchar(20) NOT NULL DEFAULT 'NEW_TAB',
        "image_pc_data" text NULL,
        "image_mobile_data" text NULL,
        "start_at" timestamptz NULL,
        "end_at" timestamptz NULL,
        "impressions" integer NOT NULL DEFAULT 0,
        "clicks" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_banners_page" ON "banners" ("page")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_banners_dates" ON "banners" ("start_at", "end_at")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        address text PRIMARY KEY,
        code text NOT NULL UNIQUE,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS referral_relationships (
        id serial PRIMARY KEY,
        "referrerAddress" text NOT NULL,
        "refereeAddress" text NOT NULL UNIQUE,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_relationships_referrer
      ON referral_relationships ("referrerAddress")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "referral_tier_badges" (
        "id"         SERIAL PRIMARY KEY,
        "address"    TEXT NOT NULL,
        "badgeType"  TEXT NOT NULL,
        "isActive"   BOOLEAN NOT NULL DEFAULT TRUE,
        "grantedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "expiresAt"  TIMESTAMPTZ,
        "grantedBy"  TEXT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_referral_tier_badges_address" ON "referral_tier_badges" ("address")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_referral_tier_badges_active" ON "referral_tier_badges" ("address", "isActive")`
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_watched_wallets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "address" text NOT NULL,
        "label" text NOT NULL DEFAULT '',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_watched_wallets" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_admin_watched_wallets_address" UNIQUE ("address")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "token_faucets" (
        "faucet_address" varchar(42) PRIMARY KEY,
        "token_address" varchar(42) NOT NULL,
        "token_name" varchar(100) NOT NULL,
        "token_symbol" varchar(20) NOT NULL,
        "token_decimals" integer NOT NULL DEFAULT 18,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "token_faucets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_watched_wallets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "referral_tier_badges"`);
    await queryRunner.query(`DROP TABLE IF EXISTS referral_relationships`);
    await queryRunner.query(`DROP TABLE IF EXISTS referral_codes`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_banners_dates"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_banners_page"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "banners"`);
  }
}
```

- [ ] **Step 8: Create `apps/config-service/src/config-db/config-db.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { ConfigServiceConfig } from '../config/configuration';
import { BannerEntity } from '../models/banner/banner.entity';
import { ReferralCodeEntity } from '../models/referral/referral-code.entity';
import { ReferralRelationshipEntity } from '../models/referral/referral-relationship.entity';
import { ReferralTierBadgeEntity } from '../models/referral/referral-tier-badge.entity';
import { AdminWatchedWalletEntity } from '../models/admin/admin-watched-wallet.entity';
import { TokenFaucetEntity } from '../models/faucet/token-faucet.entity';
import { InitialConfigSchema1748100000000 } from '../migrations/1748100000000-InitialConfigSchema';

const ALL_ENTITIES = [
  BannerEntity,
  ReferralCodeEntity,
  ReferralRelationshipEntity,
  ReferralTierBadgeEntity,
  AdminWatchedWalletEntity,
  TokenFaucetEntity,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.getOrThrow<ConfigServiceConfig['configDb']>('configDb').url;
        return {
          type: 'postgres' as const,
          url,
          entities: ALL_ENTITIES,
          migrations: [InitialConfigSchema1748100000000],
          migrationsRun: true,
          synchronize: false,
          logging: false,
        };
      },
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class ConfigDbModule {}
```

- [ ] **Step 9: Typecheck**

Run: `pnpm --filter @giwater/config-service typecheck`

Expected: No errors.

- [ ] **Step 10: Commit**

```bash
git add apps/config-service/src/models/ \
        apps/config-service/src/migrations/ \
        apps/config-service/src/config-db/ \
        apps/config-service/src/data-source.ts
git commit -m "feat(config-service): add entities, initial migration, and DB module"
```

---

## Task 6: Config-service API services

**Files:**
- Create: `apps/config-service/src/api/banner/banner.service.ts`
- Create: `apps/config-service/src/api/referral/referral.service.ts`
- Create: `apps/config-service/src/api/admin-watched-wallets/admin-watched-wallets.service.ts`
- Create: `apps/config-service/src/api/admin-watched-wallets/admin-watched-wallets.controller.ts`
- Create: `apps/config-service/src/api/token-faucets/token-faucets.service.ts`
- Create: `apps/config-service/src/api/token-faucets/token-faucets.controller.ts`
- Create: `apps/config-service/src/api/api.module.ts`

- [ ] **Step 1: Create `apps/config-service/src/api/banner/banner.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BannerEntity } from '../../models/banner/banner.entity';
import type {
  AdminBannerInfo,
  BannerListResponse,
  CreateBannerRequest,
  UpdateBannerRequest,
  BannerPage,
  ActiveBanner,
} from '@giwater/shared';
import { BannerStatus } from '@giwater/shared';

@Injectable()
export class BannerService {
  constructor(
    @InjectRepository(BannerEntity)
    private readonly bannerRepo: Repository<BannerEntity>,
  ) {}

  async findAll(page?: BannerPage): Promise<BannerListResponse> {
    const where = page ? { page } : {};
    const banners = await this.bannerRepo.find({ where, order: { createdAt: 'DESC' } });
    return { banners: banners.map((b) => this.toAdminDto(b)), total: banners.length };
  }

  async findOne(id: number): Promise<AdminBannerInfo> {
    const banner = await this.findEntityOrThrow(id);
    return this.toAdminDto(banner);
  }

  async create(dto: CreateBannerRequest): Promise<AdminBannerInfo> {
    const saved = await this.bannerRepo.save(
      this.bannerRepo.create({
        title: dto.title,
        page: dto.page,
        linkUrl: dto.linkUrl ?? null,
        clickTarget: dto.clickTarget ?? 'NEW_TAB',
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
      }),
    );
    return this.toAdminDto(saved);
  }

  async update(id: number, dto: UpdateBannerRequest): Promise<AdminBannerInfo> {
    const banner = await this.findEntityOrThrow(id);
    if (dto.title !== undefined) banner.title = dto.title;
    if (dto.linkUrl !== undefined) banner.linkUrl = dto.linkUrl ?? null;
    if (dto.clickTarget !== undefined) banner.clickTarget = dto.clickTarget;
    if (dto.startAt !== undefined) banner.startAt = dto.startAt ? new Date(dto.startAt) : null;
    if (dto.endAt !== undefined) banner.endAt = dto.endAt ? new Date(dto.endAt) : null;
    const saved = await this.bannerRepo.save(banner);
    return this.toAdminDto(saved);
  }

  async remove(id: number): Promise<void> {
    const banner = await this.findEntityOrThrow(id);
    await this.bannerRepo.delete(banner.id);
  }

  async setPcImage(id: number, fileBuffer: Buffer, mimeType: string): Promise<AdminBannerInfo> {
    const banner = await this.findEntityOrThrow(id);
    banner.imagePcData = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    return this.toAdminDto(await this.bannerRepo.save(banner));
  }

  async setMobileImage(id: number, fileBuffer: Buffer, mimeType: string): Promise<AdminBannerInfo> {
    const banner = await this.findEntityOrThrow(id);
    banner.imageMobileData = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    return this.toAdminDto(await this.bannerRepo.save(banner));
  }

  async deletePcImage(id: number): Promise<AdminBannerInfo> {
    const banner = await this.findEntityOrThrow(id);
    banner.imagePcData = null;
    return this.toAdminDto(await this.bannerRepo.save(banner));
  }

  async deleteMobileImage(id: number): Promise<AdminBannerInfo> {
    const banner = await this.findEntityOrThrow(id);
    banner.imageMobileData = null;
    return this.toAdminDto(await this.bannerRepo.save(banner));
  }

  async getActiveBanners(page: BannerPage): Promise<ActiveBanner[]> {
    const now = new Date();
    const banners = await this.bannerRepo
      .createQueryBuilder('b')
      .where('b.page = :page', { page })
      .andWhere('(b.start_at IS NULL OR b.start_at <= :now)', { now })
      .andWhere('(b.end_at IS NULL OR b.end_at >= :now)', { now })
      .orderBy('b.created_at', 'ASC')
      .getMany();
    return banners.map((b) => ({
      id: b.id,
      imagePcUrl: b.imagePcData,
      imageMobileUrl: b.imageMobileData,
      linkUrl: b.linkUrl,
      clickTarget: b.clickTarget,
    }));
  }

  async recordImpression(id: number): Promise<void> {
    await this.bannerRepo.increment({ id }, 'impressions', 1);
  }

  async recordClick(id: number): Promise<void> {
    await this.bannerRepo.increment({ id }, 'clicks', 1);
  }

  private async findEntityOrThrow(id: number): Promise<BannerEntity> {
    const banner = await this.bannerRepo.findOne({ where: { id } });
    if (!banner) throw new NotFoundException(`Banner ${id} not found`);
    return banner;
  }

  private computeStatus(b: BannerEntity): typeof BannerStatus[keyof typeof BannerStatus] {
    const now = new Date();
    if (b.startAt && now < b.startAt) return BannerStatus.SCHEDULED;
    if (b.endAt && now > b.endAt) return BannerStatus.ENDED;
    return BannerStatus.ACTIVE;
  }

  private toAdminDto(b: BannerEntity): AdminBannerInfo {
    const impressions = b.impressions;
    const clicks = b.clicks;
    const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';
    return {
      id: b.id,
      title: b.title,
      page: b.page,
      linkUrl: b.linkUrl,
      clickTarget: b.clickTarget,
      imagePcUrl: b.imagePcData,
      imageMobileUrl: b.imageMobileData,
      status: this.computeStatus(b),
      startAt: b.startAt ? b.startAt.toISOString() : null,
      endAt: b.endAt ? b.endAt.toISOString() : null,
      impressions,
      clicks,
      ctr,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  }
}
```

- [ ] **Step 2: Create `apps/config-service/src/api/referral/referral.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReferralCodeEntity } from '../../models/referral/referral-code.entity';
import { ReferralRelationshipEntity } from '../../models/referral/referral-relationship.entity';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'GW-';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

@Injectable()
export class ReferralService {
  constructor(
    @InjectRepository(ReferralCodeEntity)
    private readonly codeRepo: Repository<ReferralCodeEntity>,
    @InjectRepository(ReferralRelationshipEntity)
    private readonly relRepo: Repository<ReferralRelationshipEntity>,
  ) {}

  async getOrCreateCode(address: string): Promise<ReferralCodeEntity> {
    const normalized = address.toLowerCase();
    const existing = await this.codeRepo.findOne({ where: { address: normalized } });
    if (existing) return existing;

    let code: string;
    let attempts = 0;
    do {
      code = generateCode();
      attempts++;
      if (attempts > 20) throw new Error('Failed to generate unique referral code');
    } while (await this.codeRepo.findOne({ where: { code } }));

    const entity = this.codeRepo.create({ address: normalized, code });
    return this.codeRepo.save(entity);
  }

  async claimReferral(
    refereeAddress: string,
    referralCode: string,
  ): Promise<{ success: boolean; alreadyClaimed: boolean; referrerAddress?: string }> {
    const normalizedReferee = refereeAddress.toLowerCase();
    const existing = await this.relRepo.findOne({ where: { refereeAddress: normalizedReferee } });
    if (existing) {
      return { success: false, alreadyClaimed: true, referrerAddress: existing.referrerAddress };
    }
    const referrer = await this.codeRepo.findOne({ where: { code: referralCode.toUpperCase() } });
    if (!referrer) return { success: false, alreadyClaimed: false };
    if (referrer.address === normalizedReferee) return { success: false, alreadyClaimed: false };
    const rel = this.relRepo.create({ referrerAddress: referrer.address, refereeAddress: normalizedReferee });
    await this.relRepo.save(rel);
    return { success: true, alreadyClaimed: false, referrerAddress: referrer.address };
  }
}
```

- [ ] **Step 3: Create `apps/config-service/src/api/admin-watched-wallets/admin-watched-wallets.service.ts`**

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminWatchedWalletEntity } from '../../models/admin/admin-watched-wallet.entity';

export interface AdminWatchedWalletDto {
  id: string;
  address: string;
  label: string;
  createdAt: Date;
}

@Injectable()
export class AdminWatchedWalletsService {
  constructor(
    @InjectRepository(AdminWatchedWalletEntity)
    private readonly repo: Repository<AdminWatchedWalletEntity>,
  ) {}

  async list(): Promise<{ wallets: AdminWatchedWalletDto[] }> {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    return { wallets: rows.map((r) => ({ id: r.id, address: r.address, label: r.label, createdAt: r.createdAt })) };
  }

  async upsert(body: { address?: string; label?: string }): Promise<AdminWatchedWalletDto> {
    const address = typeof body?.address === 'string' ? body.address.trim() : '';
    if (!address) throw new BadRequestException('address is required');
    const label = typeof body?.label === 'string' ? body.label : '';
    const existing = await this.repo.findOne({ where: { address } });
    if (existing) {
      if (typeof body?.label === 'string' && existing.label !== label) {
        existing.label = label;
        await this.repo.save(existing);
      }
      return { id: existing.id, address: existing.address, label: existing.label, createdAt: existing.createdAt };
    }
    const saved = await this.repo.save(this.repo.create({ address, label }));
    return { id: saved.id, address: saved.address, label: saved.label, createdAt: saved.createdAt };
  }

  async remove(address: string): Promise<{ ok: true }> {
    const trimmed = address?.trim();
    if (!trimmed) throw new BadRequestException('address is required');
    await this.repo.delete({ address: trimmed });
    return { ok: true };
  }
}
```

- [ ] **Step 4: Create `apps/config-service/src/api/admin-watched-wallets/admin-watched-wallets.controller.ts`**

```typescript
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { AdminWatchedWalletsService } from './admin-watched-wallets.service';

@Controller('admin/watched-wallets')
export class AdminWatchedWalletsController {
  constructor(private readonly svc: AdminWatchedWalletsService) {}

  @Get()
  list() { return this.svc.list(); }

  @Post()
  upsert(@Body() body: { address?: string; label?: string }) { return this.svc.upsert(body); }

  @Delete(':address')
  remove(@Param('address') address: string) { return this.svc.remove(address); }
}
```

- [ ] **Step 5: Create `apps/config-service/src/api/token-faucets/token-faucets.service.ts`**

```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenFaucetEntity } from '../../models/faucet/token-faucet.entity';
import type { AdminFaucetInfo, FaucetListResponse, RegisterFaucetRequest } from '@giwater/shared';

@Injectable()
export class TokenFaucetsService {
  constructor(
    @InjectRepository(TokenFaucetEntity)
    private readonly faucetRepo: Repository<TokenFaucetEntity>,
  ) {}

  async findAll(): Promise<FaucetListResponse> {
    const faucets = await this.faucetRepo.find({ order: { createdAt: 'DESC' } });
    return { faucets: faucets.map((f) => this.toDto(f)), total: faucets.length };
  }

  async register(dto: RegisterFaucetRequest): Promise<AdminFaucetInfo> {
    const normalized = dto.faucetAddress.toLowerCase();
    const existing = await this.faucetRepo.findOne({ where: { faucetAddress: normalized } });
    if (existing) throw new ConflictException(`Faucet ${normalized} is already registered`);
    const saved = await this.faucetRepo.save(
      this.faucetRepo.create({
        faucetAddress: normalized,
        tokenAddress: dto.tokenAddress.toLowerCase(),
        tokenName: dto.tokenName,
        tokenSymbol: dto.tokenSymbol,
        tokenDecimals: dto.tokenDecimals,
      }),
    );
    return this.toDto(saved);
  }

  async remove(faucetAddress: string): Promise<void> {
    const normalized = faucetAddress.toLowerCase();
    const faucet = await this.faucetRepo.findOne({ where: { faucetAddress: normalized } });
    if (!faucet) throw new NotFoundException(`Faucet ${normalized} not found`);
    await this.faucetRepo.delete({ faucetAddress: normalized });
  }

  private toDto(f: TokenFaucetEntity): AdminFaucetInfo {
    return {
      faucetAddress: f.faucetAddress,
      tokenAddress: f.tokenAddress,
      tokenName: f.tokenName,
      tokenSymbol: f.tokenSymbol,
      tokenDecimals: f.tokenDecimals,
      createdAt: f.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Step 6: Create `apps/config-service/src/api/token-faucets/token-faucets.controller.ts`**

```typescript
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { TokenFaucetsService } from './token-faucets.service';
import type { RegisterFaucetRequest } from '@giwater/shared';

@Controller('token-faucets')
export class TokenFaucetsController {
  constructor(private readonly svc: TokenFaucetsService) {}

  @Get()
  findAll() { return this.svc.findAll(); }

  @Post()
  register(@Body() body: RegisterFaucetRequest) { return this.svc.register(body); }

  @Delete(':address')
  remove(@Param('address') address: string) { return this.svc.remove(address); }
}
```

- [ ] **Step 7: Create `apps/config-service/src/api/api.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BannerEntity } from '../models/banner/banner.entity';
import { ReferralCodeEntity } from '../models/referral/referral-code.entity';
import { ReferralRelationshipEntity } from '../models/referral/referral-relationship.entity';
import { AdminWatchedWalletEntity } from '../models/admin/admin-watched-wallet.entity';
import { TokenFaucetEntity } from '../models/faucet/token-faucet.entity';
import { BannerService } from './banner/banner.service';
import { ReferralService } from './referral/referral.service';
import { AdminWatchedWalletsService } from './admin-watched-wallets/admin-watched-wallets.service';
import { AdminWatchedWalletsController } from './admin-watched-wallets/admin-watched-wallets.controller';
import { TokenFaucetsService } from './token-faucets/token-faucets.service';
import { TokenFaucetsController } from './token-faucets/token-faucets.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BannerEntity,
      ReferralCodeEntity,
      ReferralRelationshipEntity,
      AdminWatchedWalletEntity,
      TokenFaucetEntity,
    ]),
  ],
  controllers: [AdminWatchedWalletsController, TokenFaucetsController],
  providers: [BannerService, ReferralService, AdminWatchedWalletsService, TokenFaucetsService],
  exports: [BannerService, ReferralService, AdminWatchedWalletsService, TokenFaucetsService],
})
export class ApiModule {}
```

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter @giwater/config-service typecheck`

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add apps/config-service/src/api/
git commit -m "feat(config-service): add banner, referral, watched-wallets, faucet services and controllers"
```

---

## Task 7: Config-service RabbitMQ consumer + gateway-rpc handler

**Files:**
- Create: `apps/config-service/src/gateway-rpc/config-rpc-invoke.service.ts`
- Create: `apps/config-service/src/gateway-rpc/config-rpc-invoke.module.ts`
- Create: `apps/config-service/src/rabbitmq/config-rabbitmq.service.ts`
- Create: `apps/config-service/src/rabbitmq/config-rabbitmq.module.ts`

- [ ] **Step 1: Create `apps/config-service/src/gateway-rpc/config-rpc-invoke.service.ts`**

This service handles HTTP-shaped RPC calls for all config routes (mirrors broker's `GatewayRpcInvokeService`):

```typescript
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  BannerPage,
  BrokerGatewayRpcRequestDto,
  BrokerGatewayRpcResponseDto,
  ReferralClaimRequest,
} from '@giwater/shared';
import { BannerService } from '../api/banner/banner.service';
import { ReferralService } from '../api/referral/referral.service';
import { AdminWatchedWalletsService } from '../api/admin-watched-wallets/admin-watched-wallets.service';
import { TokenFaucetsService } from '../api/token-faucets/token-faucets.service';

function normalizeHttpPath(path: string): string {
  const t = path.trim();
  return t.startsWith('/') ? t : `/${t}`;
}

function pathSegments(path: string): string[] {
  return normalizeHttpPath(path)
    .replace(/^\/+/, '')
    .split('/')
    .filter((s) => s.length > 0)
    .map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
}

function httpErrorToRpc(err: unknown): BrokerGatewayRpcResponseDto {
  if (err instanceof NotFoundException) return { ok: false, statusCode: 404, error: err.message };
  if (err instanceof BadRequestException) return { ok: false, statusCode: 400, error: err.message };
  if (err instanceof ConflictException) return { ok: false, statusCode: 409, error: err.message };
  const msg = err instanceof Error ? err.message : String(err);
  return { ok: false, statusCode: 500, error: msg };
}

@Injectable()
export class ConfigRpcInvokeService {
  private readonly logger = new Logger(ConfigRpcInvokeService.name);

  constructor(
    private readonly bannerSvc: BannerService,
    private readonly referralSvc: ReferralService,
    private readonly watchedWalletsSvc: AdminWatchedWalletsService,
    private readonly faucetSvc: TokenFaucetsService,
  ) {}

  async handleRpcEnvelope(
    envelope: BrokerGatewayRpcRequestDto,
  ): Promise<BrokerGatewayRpcResponseDto> {
    if (envelope.action === 'ping') {
      return { ok: true, statusCode: 200, body: { ok: true, action: 'ping', message: 'config-service alive' } };
    }
    if (envelope.action !== 'apiInvoke') {
      return { ok: false, statusCode: 400, error: `Unknown action: ${String(envelope.action)}` };
    }
    return this.invokeHttpLike(envelope.request);
  }

  private async invokeHttpLike(
    request: BrokerGatewayRpcRequestDto['request'],
  ): Promise<BrokerGatewayRpcResponseDto> {
    if (!request || typeof request.method !== 'string' || !request.path) {
      return { ok: false, statusCode: 400, error: 'request.method and request.path are required' };
    }
    const method = request.method.trim().toUpperCase();
    const path = normalizeHttpPath(request.path);
    const query = request.query ?? {};
    const body = request.body;
    const seg = pathSegments(path);
    const a = seg[0];
    const b = seg[1];
    const c = seg[2];

    try {
      if (method === 'GET' && pathSegments(path).join('/') === 'health') {
        return { ok: true, statusCode: 200, body: { status: 'ok', service: 'giwater-config-service' } };
      }

      // banners
      if (a === 'banners') {
        if (method === 'GET' && b) {
          const banners = await this.bannerSvc.getActiveBanners(b.toUpperCase() as BannerPage);
          return { ok: true, statusCode: 200, body: banners };
        }
        if (method === 'POST' && b && c === 'impression') {
          const id = parseInt(b, 10);
          if (!Number.isFinite(id)) return { ok: false, statusCode: 400, error: 'Invalid banner id' };
          await this.bannerSvc.recordImpression(id);
          return { ok: true, statusCode: 204, body: null };
        }
        if (method === 'POST' && b && c === 'click') {
          const id = parseInt(b, 10);
          if (!Number.isFinite(id)) return { ok: false, statusCode: 400, error: 'Invalid banner id' };
          await this.bannerSvc.recordClick(id);
          return { ok: true, statusCode: 204, body: null };
        }
        return { ok: false, statusCode: 404, error: `No banners route: ${method} ${path}` };
      }

      // referral
      if (a === 'referral') {
        if (method === 'GET' && b === 'code' && c) {
          const entity = await this.referralSvc.getOrCreateCode(c);
          return { ok: true, statusCode: 200, body: { address: entity.address, code: entity.code } };
        }
        if (method === 'POST' && b === 'claim') {
          const req = body as ReferralClaimRequest;
          const result = await this.referralSvc.claimReferral(req.refereeAddress, req.referralCode);
          return { ok: true, statusCode: 200, body: result };
        }
        return { ok: false, statusCode: 404, error: `No referral route: ${method} ${path}` };
      }

      // admin/watched-wallets (via RPC for read, but HTTP for writes — this handles any RPC reads)
      if (a === 'admin' && b === 'watched-wallets') {
        if (method === 'GET' && !c) {
          return { ok: true, statusCode: 200, body: await this.watchedWalletsSvc.list() };
        }
        if (method === 'POST' && !c) {
          const dto = body as { address?: string; label?: string };
          return { ok: true, statusCode: 200, body: await this.watchedWalletsSvc.upsert(dto) };
        }
        if (method === 'DELETE' && c) {
          return { ok: true, statusCode: 200, body: await this.watchedWalletsSvc.remove(c) };
        }
        return { ok: false, statusCode: 404, error: `No admin/watched-wallets route: ${method} ${path}` };
      }

      // token-faucets
      if (a === 'token-faucets') {
        if (method === 'GET' && !b) {
          return { ok: true, statusCode: 200, body: await this.faucetSvc.findAll() };
        }
        if (method === 'POST' && !b) {
          return { ok: true, statusCode: 201, body: await this.faucetSvc.register(body as Parameters<TokenFaucetsService['register']>[0]) };
        }
        if (method === 'DELETE' && b) {
          await this.faucetSvc.remove(b);
          return { ok: true, statusCode: 204, body: null };
        }
        return { ok: false, statusCode: 404, error: `No token-faucets route: ${method} ${path}` };
      }

      this.logger.debug(`apiInvoke: no route for ${method} ${path}`);
      return { ok: false, statusCode: 501, error: `No config-service RPC handler for ${method} ${path}` };
    } catch (err) {
      this.logger.warn(`apiInvoke error ${method} ${path}: ${err instanceof Error ? err.message : err}`);
      return httpErrorToRpc(err);
    }
  }
}
```

- [ ] **Step 2: Create `apps/config-service/src/gateway-rpc/config-rpc-invoke.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ApiModule } from '../api/api.module';
import { ConfigRpcInvokeService } from './config-rpc-invoke.service';

@Module({
  imports: [ApiModule],
  providers: [ConfigRpcInvokeService],
  exports: [ConfigRpcInvokeService],
})
export class ConfigRpcInvokeModule {}
```

- [ ] **Step 3: Create `apps/config-service/src/rabbitmq/config-rabbitmq.service.ts`**

```typescript
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import type { BrokerGatewayRpcRequestDto } from '@giwater/shared';
import type { ConfigServiceConfig } from '../config/configuration';
import { ConfigRpcInvokeService } from '../gateway-rpc/config-rpc-invoke.service';

@Injectable()
export class ConfigRabbitmqService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ConfigRabbitmqService.name);
  private connection?: ReturnType<typeof amqp.connect>;
  private consumerChannel?: ChannelWrapper;

  constructor(
    private readonly configService: ConfigService,
    private readonly rpcInvoke: ConfigRpcInvokeService,
  ) {}

  private get cfg(): ConfigServiceConfig['rabbitmq'] {
    return this.configService.getOrThrow<ConfigServiceConfig['rabbitmq']>('rabbitmq');
  }

  async onApplicationBootstrap(): Promise<void> {
    const { url, rpcQueue } = this.cfg;

    this.connection = amqp.connect([url], { reconnectTimeInSeconds: 5 });
    this.connection.on('connect', () => this.logger.log('RabbitMQ connection established'));
    this.connection.on('disconnect', (err) =>
      this.logger.warn(`RabbitMQ disconnected: ${err?.err?.message ?? err}`),
    );

    this.consumerChannel = this.connection.createChannel({
      json: false,
      setup: async (channel: Channel) => {
        await channel.assertQueue(rpcQueue, { durable: true });
        await channel.prefetch(10);
        await channel.consume(
          rpcQueue,
          (msg) => { void this.handleRpcMessage(channel, msg); },
          { noAck: false },
        );
        this.logger.log(`Consuming RPC queue: ${rpcQueue}`);
      },
    });

    await this.consumerChannel.waitForConnect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumerChannel?.close();
    await this.connection?.close();
  }

  private async handleRpcMessage(
    channel: Channel,
    msg: ConsumeMessage | null,
  ): Promise<void> {
    if (!msg) return;
    const { replyTo, correlationId } = msg.properties;
    if (!replyTo) {
      this.logger.warn('RPC message missing replyTo; dropping');
      channel.ack(msg);
      return;
    }
    try {
      const bodyText = msg.content.toString();
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(bodyText) as Record<string, unknown>; }
      catch { body = { raw: bodyText }; }

      const action = typeof body.action === 'string' ? body.action : 'ping';
      const envelope: BrokerGatewayRpcRequestDto = {
        action: action === 'apiInvoke' ? 'apiInvoke' : 'ping',
        request:
          body.request !== undefined && typeof body.request === 'object'
            ? (body.request as BrokerGatewayRpcRequestDto['request'])
            : undefined,
      };
      const response = await this.rpcInvoke.handleRpcEnvelope(envelope);
      const replyPayload =
        action === 'ping' && response.ok && response.body !== undefined
          ? response.body
          : response;

      channel.sendToQueue(
        replyTo,
        Buffer.from(JSON.stringify(replyPayload)),
        { correlationId, persistent: true },
      );
      channel.ack(msg);
    } catch (err) {
      this.logger.error(`RPC handling failed: ${err instanceof Error ? err.message : err}`);
      channel.nack(msg, false, true);
    }
  }
}
```

- [ ] **Step 4: Create `apps/config-service/src/rabbitmq/config-rabbitmq.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigRpcInvokeModule } from '../gateway-rpc/config-rpc-invoke.module';
import { ConfigRabbitmqService } from './config-rabbitmq.service';

@Module({
  imports: [ConfigRpcInvokeModule],
  providers: [ConfigRabbitmqService],
})
export class ConfigRabbitmqModule {}
```

- [ ] **Step 5: Wire up `apps/config-service/src/app.module.ts`**

Replace the stub created in Task 4:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { ConfigDbModule } from './config-db/config-db.module';
import { ApiModule } from './api/api.module';
import { ConfigRabbitmqModule } from './rabbitmq/config-rabbitmq.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ConfigDbModule,
    ApiModule,
    ConfigRabbitmqModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 6: Typecheck config-service**

Run: `pnpm --filter @giwater/config-service typecheck`

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/config-service/src/gateway-rpc/ \
        apps/config-service/src/rabbitmq/ \
        apps/config-service/src/app.module.ts
git commit -m "feat(config-service): add RabbitMQ RPC consumer and gateway-rpc handler"
```

---

## Task 8: Next.js config-admin proxy + update watched-wallets page

**Files:**
- Create: `apps/web/app/api/config-admin/[...path]/route.ts`
- Find + Modify: watched-wallets admin page to use `/api/config-admin/` instead of `/api/broker-admin/`

- [ ] **Step 1: Find the broker-admin proxy route to use as template**

Run: `cat apps/web/app/api/broker-admin/\[...path\]/route.ts`

This shows the template for the new proxy.

- [ ] **Step 2: Create `apps/web/app/api/config-admin/[...path]/route.ts`**

```typescript
import { type NextRequest, NextResponse } from 'next/server';

const CONFIG_ADMIN_URL =
  process.env.CONFIG_ADMIN_URL ?? 'http://localhost:3047';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyToConfigAdmin(req, await params);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyToConfigAdmin(req, await params);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyToConfigAdmin(req, await params);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyToConfigAdmin(req, await params);
}

async function proxyToConfigAdmin(
  req: NextRequest,
  params: { path: string[] },
): Promise<NextResponse> {
  const subPath = params.path.join('/');
  const search = req.nextUrl.search ?? '';
  const targetUrl = `${CONFIG_ADMIN_URL}/${subPath}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!['host', 'connection'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  let body: BodyInit | undefined;
  const method = req.method;
  if (method !== 'GET' && method !== 'HEAD') {
    body = await req.arrayBuffer();
  }

  const res = await fetch(targetUrl, { method, headers, body });
  const resBody = await res.arrayBuffer();
  const resHeaders = new Headers();
  res.headers.forEach((value, key) => {
    resHeaders.set(key, value);
  });

  return new NextResponse(resBody, {
    status: res.status,
    headers: resHeaders,
  });
}
```

- [ ] **Step 3: Find and update the watched-wallets page**

Run: `grep -r "broker-admin" apps/web/app/admin/ --include="*.tsx" --include="*.ts" -l`

This identifies which files use `/api/broker-admin/` for watched-wallets config routes.

- [ ] **Step 4: In each file found, replace `/api/broker-admin/admin/watched-wallets` with `/api/config-admin/admin/watched-wallets`**

Also replace any fetch calls to `/api/broker-admin/token-faucets` with `/api/config-admin/token-faucets` if found.

Run the grep again to confirm no remaining `/api/broker-admin/` references to config routes (banners, referral, watched-wallets, token-faucets):

```bash
grep -r "broker-admin" apps/web/app/admin/ --include="*.tsx" --include="*.ts" | grep -E "watched-wallets|token-faucets|banners|referral"
```

Expected: No output (all config routes migrated to config-admin).

- [ ] **Step 5: Add `CONFIG_ADMIN_URL` to `apps/web` environment variable documentation**

In `apps/web/.env.example` (or equivalent), add:

```
CONFIG_ADMIN_URL=http://localhost:3047
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/config-admin/ apps/web/app/admin/
git commit -m "feat(web): add config-admin proxy route and migrate watched-wallets to config-service"
```

---

## Task 9: Data migration script

**Files:**
- Create: `apps/config-service/scripts/migrate-from-broker.ts`

- [ ] **Step 1: Create `apps/config-service/scripts/migrate-from-broker.ts`**

```typescript
/**
 * One-time data migration: copies config tables from broker DB to config DB.
 *
 * Usage:
 *   BROKER_DATABASE_URL=postgres://... CONFIG_DATABASE_URL=postgres://... \
 *   node --loader ts-node/esm scripts/migrate-from-broker.ts
 *
 * Safe to re-run: verifies row counts before each table and skips if already migrated.
 */
import pg from 'pg';

const BROKER_URL = process.env.BROKER_DATABASE_URL;
const CONFIG_URL = process.env.CONFIG_DATABASE_URL;

if (!BROKER_URL) { console.error('ERROR: BROKER_DATABASE_URL not set'); process.exit(1); }
if (!CONFIG_URL) { console.error('ERROR: CONFIG_DATABASE_URL not set'); process.exit(1); }

const brokerClient = new pg.Client({ connectionString: BROKER_URL });
const configClient = new pg.Client({ connectionString: CONFIG_URL });

const TABLES: Array<{ table: string; columns: string[] }> = [
  {
    table: 'banners',
    columns: ['id', 'title', 'page', 'link_url', 'click_target', 'image_pc_data', 'image_mobile_data', 'start_at', 'end_at', 'impressions', 'clicks', 'created_at', 'updated_at'],
  },
  {
    table: 'referral_codes',
    columns: ['address', 'code', '"createdAt"'],
  },
  {
    table: 'referral_relationships',
    columns: ['id', '"referrerAddress"', '"refereeAddress"', '"createdAt"'],
  },
  {
    table: 'referral_tier_badges',
    columns: ['id', 'address', '"badgeType"', '"isActive"', '"grantedAt"', '"expiresAt"', '"grantedBy"'],
  },
  {
    table: 'admin_watched_wallets',
    columns: ['id', 'address', 'label', '"createdAt"'],
  },
  {
    table: 'token_faucets',
    columns: ['faucet_address', 'token_address', 'token_name', 'token_symbol', 'token_decimals', 'created_at'],
  },
];

async function migrateTable(table: string, columns: string[]): Promise<void> {
  const colList = columns.join(', ');
  const { rows: brokerRows } = await brokerClient.query<Record<string, unknown>>(
    `SELECT ${colList} FROM "${table}"`,
  );
  console.log(`  [${table}] broker has ${brokerRows.length} rows`);

  const { rows: configRows } = await configClient.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "${table}"`,
  );
  const configCount = parseInt(configRows[0]?.count ?? '0', 10);

  if (configCount > 0) {
    console.log(`  [${table}] config already has ${configCount} rows — skipping`);
    return;
  }
  if (brokerRows.length === 0) {
    console.log(`  [${table}] nothing to migrate`);
    return;
  }

  const BATCH = 100;
  for (let i = 0; i < brokerRows.length; i += BATCH) {
    const batch = brokerRows.slice(i, i + BATCH);
    const valuePlaceholders = batch.map((_, rowIdx) => {
      const placeholders = columns.map((_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`);
      return `(${placeholders.join(', ')})`;
    });
    const values = batch.flatMap((row) =>
      columns.map((col) => row[col.replace(/"/g, '')] ?? null),
    );
    await configClient.query(
      `INSERT INTO "${table}" (${colList}) VALUES ${valuePlaceholders.join(', ')} ON CONFLICT DO NOTHING`,
      values,
    );
  }

  const { rows: verifyRows } = await configClient.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "${table}"`,
  );
  const migratedCount = parseInt(verifyRows[0]?.count ?? '0', 10);
  if (migratedCount !== brokerRows.length) {
    throw new Error(`[${table}] row count mismatch: broker=${brokerRows.length} config=${migratedCount}`);
  }
  console.log(`  [${table}] migrated ${migratedCount} rows ✓`);
}

async function main(): Promise<void> {
  await brokerClient.connect();
  await configClient.connect();
  console.log('Connected to both databases.');

  for (const { table, columns } of TABLES) {
    console.log(`Migrating ${table}...`);
    await migrateTable(table, columns);
  }

  console.log('\nMigration complete.');
  await brokerClient.end();
  await configClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/config-service/scripts/migrate-from-broker.ts
git commit -m "feat(config-service): add data migration script from broker to config DB"
```

---

## Task 10: Broker cleanup

Remove config modules from broker so broker DB can be pruned without touching config data.

**Files:**
- Modify: `apps/broker/src/broker-db/broker-db.module.ts`
- Modify: `apps/broker/src/api/api.module.ts`
- Modify: `apps/broker/src/gateway-rpc/gateway-rpc-invoke.module.ts`
- Modify: `apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts`
- Modify: `apps/broker/src/migrations/1748000000000-AddAdminWatchedWallets.ts` (check it's registered in broker-db.module.ts; if not already, don't add it — it will be dropped anyway)

- [ ] **Step 1: Remove config entities + migrations from `apps/broker/src/broker-db/broker-db.module.ts`**

Remove these imports:

```typescript
// Remove these imports:
import { TokenFaucetEntity } from '../models/faucet/token-faucet.entity';
import { BannerEntity } from '../models/banner/banner.entity';
import { ReferralCodeEntity } from '../models/referral/referral-code.entity';
import { ReferralRelationshipEntity } from '../models/referral/referral-relationship.entity';
import { ReferralTierBadgeEntity } from '../models/referral/referral-tier-badge.entity';
import { AddBannersTable1747500000000 } from '../migrations/1747500000000-AddBannersTable';
import { ReferralTables1747700000000 } from '../migrations/1747700000000-ReferralTables';
import { ReferralTierBadges1747800000000 } from '../migrations/1747800000000-ReferralTierBadges';
```

Remove `TokenFaucetEntity`, `BannerEntity`, `ReferralCodeEntity`, `ReferralRelationshipEntity`, `ReferralTierBadgeEntity` from `ALL_ENTITIES`.

Remove `AddBannersTable1747500000000`, `ReferralTables1747700000000`, `ReferralTierBadges1747800000000` from the `migrations` array.

Also check if `AdminWatchedWalletEntity` and `AddAdminWatchedWallets1748000000000` are in the file — if so, remove them from `ALL_ENTITIES` and `migrations` too (they are config data).

- [ ] **Step 2: Remove config controllers/services from `apps/broker/src/api/api.module.ts`**

Remove from imports:

```typescript
// Remove:
import { ReferralModule } from '../referral/referral.module';
import { AdminFaucetController } from './admin-faucet/admin-faucet.controller';
import { AdminFaucetService } from './admin-faucet/admin-faucet.service';
import { AdminWatchedWalletsController } from './admin-watched-wallets/admin-watched-wallets.controller';
import { AdminWatchedWalletEntity } from '../models/admin/admin-watched-wallet.entity';
import { ReferralController } from './referral/referral.controller';
import { AdminReferralController } from './admin-referral/admin-referral.controller';
import { AdminBannerController } from './banner/admin-banner.controller';
import { PublicBannerController } from './banner/public-banner.controller';
import { AdminBannerService } from './banner/admin-banner.service';
import { TokenFaucetEntity } from '../models/faucet/token-faucet.entity';
import { BannerEntity } from '../models/banner/banner.entity';
```

Remove from `TypeOrmModule.forFeature([...])`: `TokenFaucetEntity`, `BannerEntity`, `AdminWatchedWalletEntity`.

Remove from `imports: [...]`: `ReferralModule`.

Remove from `controllers: [...]`: `AdminFaucetController`, `AdminWatchedWalletsController`, `ReferralController`, `AdminReferralController`, `AdminBannerController`, `PublicBannerController`.

Remove from `providers: [...]`: `AdminFaucetService`, `AdminBannerService`.

- [ ] **Step 3: Remove BannerEntity from `apps/broker/src/gateway-rpc/gateway-rpc-invoke.module.ts`**

Remove:

```typescript
// Remove:
import { AdminBannerService } from '../api/banner/admin-banner.service';
import { BannerEntity } from '../models/banner/banner.entity';
```

Remove `BannerEntity` from `TypeOrmModule.forFeature([...])`.

Remove `AdminBannerService` from `providers: [...]`.

- [ ] **Step 4: Remove banners and referral routes from `apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts`**

Remove:

```typescript
// Remove these imports:
import { AdminBannerService } from '../api/banner/admin-banner.service';
import type { BannerPage } from '@giwater/shared';
```

Remove `private readonly adminBanner: AdminBannerService` from the constructor.

Remove the entire `if (a === 'banners') { ... }` block from `invokeHttpLike()`.

- [ ] **Step 5: Typecheck broker**

Run: `pnpm --filter @giwater/broker typecheck`

Expected: No errors. Fix any residual import errors before committing.

- [ ] **Step 6: Commit**

```bash
git add apps/broker/src/broker-db/broker-db.module.ts \
        apps/broker/src/api/api.module.ts \
        apps/broker/src/gateway-rpc/gateway-rpc-invoke.module.ts \
        apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts
git commit -m "feat(broker): remove config modules (banners, referral, faucets, watched-wallets) — moved to config-service"
```

---

## Task 11: Build verification

- [ ] **Step 1: Build shared**

Run: `pnpm --filter @giwater/shared build`

Expected: Succeeds.

- [ ] **Step 2: Typecheck all services in parallel**

Run: `pnpm --filter @giwater/broker typecheck & pnpm --filter @giwater/gateway typecheck & pnpm --filter @giwater/config-service typecheck && wait`

Expected: All three pass with no errors.

- [ ] **Step 3: Verify gateway HTTP server starts**

Run (in background): `pnpm --filter @giwater/gateway dev &`

Then:

```bash
sleep 5 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3046/api/health
```

Expected: `200`

Kill the dev server after verifying.

- [ ] **Step 4: Final commit with build stamp**

```bash
git add .
git commit -m "chore: verify full build passes after config-service split"
```

---

## Railway Deployment Checklist

After all tasks are complete and code is deployed:

1. Create new Railway service `Giwater Config Service` from `apps/config-service`
2. Provision new Postgres database, set `CONFIG_DATABASE_URL` on the config-service
3. Set `RABBITMQ_URL` (same as broker), `RABBITMQ_RPC_QUEUE=config-service.rpc`, `PORT=3047`
4. Deploy config-service — it runs `migrationsRun: true` so schema is created on startup
5. Run data migration: `BROKER_DATABASE_URL=<...> CONFIG_DATABASE_URL=<...> node --loader ts-node/esm apps/config-service/scripts/migrate-from-broker.ts`
6. Verify config-service is healthy (check Railway logs for "Consuming RPC queue: config-service.rpc")
7. Set `CONFIG_SERVICE_RPC_QUEUE=config-service.rpc` and `CONFIG_ADMIN_URL=<config-service-internal-url>` on gateway and web
8. Deploy gateway with routing changes
9. Deploy web with `/api/config-admin/` proxy
10. Smoke-test: `GET /api/v1/broker/invoke` with `{ method: 'GET', path: '/banners/HOME' }` returns banner data
11. Deploy broker with config modules removed (broker DB tables for config data still exist until confirmed safe)
12. After confirming all config routes work, drop migrated tables from broker DB manually
