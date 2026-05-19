# veNFT Lock Position Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Index VotingEscrow lock/unlock events through amm-indexer → broker pipeline and expose per-user veNFT lock positions and full event history via REST API.

**Architecture:** `amm-indexer` (Ponder) listens to 6 VotingEscrow events, stores raw rows in Ponder DB, and publishes typed payloads to RabbitMQ. The `broker` consumes these messages, upserts a `ve_lock_positions` table (current state) and appends to a `ve_lock_events` table (history). A NestJS `ve-lock` module exposes 4 REST endpoints. No contract changes needed — `VotingEscrowAbi` and `VOTING_ESCROW_ADDRESS` are already exported from `@giwater/shared`.

**Tech Stack:** Ponder (amm-indexer), NestJS + TypeORM + raw SQL (broker), `@giwater/shared` typed payloads, RabbitMQ, PostgreSQL.

---

## File Map

### `@giwater/shared`
- **Modify:** `packages/shared/src/contract-events/indexer-broker-queue-payload.ts` — add 6 VE payload interfaces + update 3 union types

### `amm-indexer`
- **Modify:** `apps/amm-indexer/ponder.config.ts` — add VotingEscrow contract
- **Modify:** `apps/amm-indexer/ponder.schema.ts` — add 6 Ponder tables
- **Create:** `apps/amm-indexer/src/handlers/veDeposit.ts`
- **Create:** `apps/amm-indexer/src/handlers/veWithdraw.ts`
- **Create:** `apps/amm-indexer/src/handlers/veLockPermanent.ts`
- **Create:** `apps/amm-indexer/src/handlers/veUnlockPermanent.ts`
- **Create:** `apps/amm-indexer/src/handlers/veMerge.ts`
- **Create:** `apps/amm-indexer/src/handlers/veSplit.ts`
- **Modify:** `apps/amm-indexer/src/index.ts` — register 6 new handlers

### `broker`
- **Create:** `apps/broker/src/models/ve-lock/ve-lock-position.entity.ts`
- **Create:** `apps/broker/src/models/ve-lock/ve-lock-event.entity.ts`
- **Create:** `apps/broker/migrations/002_ve_lock_tables.sql`
- **Modify:** `apps/broker/src/broker-db/broker-db.module.ts` — register 2 new entities
- **Create:** `apps/broker/src/aggregator/ve-lock-events.ts`
- **Modify:** `apps/broker/src/aggregator/index.ts` — add 6 new cases + imports
- **Create:** `apps/broker/src/ve-lock/ve-lock.service.ts`
- **Create:** `apps/broker/src/ve-lock/ve-lock.controller.ts`
- **Create:** `apps/broker/src/ve-lock/ve-lock.module.ts`
- **Modify:** `apps/broker/src/app.module.ts` — import VeLockModule

---

## Task 1: Add VE payload types to `@giwater/shared`

**Files:**
- Modify: `packages/shared/src/contract-events/indexer-broker-queue-payload.ts`

The file currently ends with `CLGaugeWithdrawIndexerBrokerPayload` around line 296. Add the following after `CLGaugeWithdrawIndexerBrokerPayload` (before the union types at line 298) and update the three union types.

- [ ] **Step 1: Add 6 payload interface pairs (wire + notify) and update unions**

Open `packages/shared/src/contract-events/indexer-broker-queue-payload.ts`.

After the `CLGaugeWithdrawIndexerBrokerPayload` block and before `/** On-chain UniversalRouter events on the broker queue (includes \`ts\`). */`, insert:

```typescript
/** `VotingEscrow.Deposit` — lock creation or modification. depositType: '0'=DEPOSIT_FOR_TYPE '1'=CREATE_LOCK_TYPE '2'=INCREASE_LOCK_AMOUNT '3'=INCREASE_UNLOCK_TIME */
export interface VeDepositIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'VeDeposit';
  provider: HexAddress;
  tokenId: BrokerJsonBigInt;
  depositType: string;
  value: BrokerJsonBigInt;
  locktime: BrokerJsonBigInt;
}

/** `VotingEscrow.Withdraw` — unlock and burn veNFT. */
export interface VeWithdrawIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'VeWithdraw';
  provider: HexAddress;
  tokenId: BrokerJsonBigInt;
  value: BrokerJsonBigInt;
}

/** `VotingEscrow.LockPermanent` — convert time-based lock to permanent. */
export interface VeLockPermanentIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'VeLockPermanent';
  owner: HexAddress;
  tokenId: BrokerJsonBigInt;
  amount: BrokerJsonBigInt;
}

/** `VotingEscrow.UnlockPermanent` — convert permanent lock back to time-based. */
export interface VeUnlockPermanentIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'VeUnlockPermanent';
  owner: HexAddress;
  tokenId: BrokerJsonBigInt;
  amount: BrokerJsonBigInt;
}

/** `VotingEscrow.Merge` — burn `from` into `to`. */
export interface VeMergeIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'VeMerge';
  sender: HexAddress;
  from: BrokerJsonBigInt;
  to: BrokerJsonBigInt;
  amountFrom: BrokerJsonBigInt;
  amountTo: BrokerJsonBigInt;
  amountFinal: BrokerJsonBigInt;
  locktime: BrokerJsonBigInt;
}

/** `VotingEscrow.Split` — burn `from`, mint `tokenId1` and `tokenId2`. */
export interface VeSplitIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'VeSplit';
  from: BrokerJsonBigInt;
  tokenId1: BrokerJsonBigInt;
  tokenId2: BrokerJsonBigInt;
  sender: HexAddress;
  splitAmount1: BrokerJsonBigInt;
  splitAmount2: BrokerJsonBigInt;
  locktime: BrokerJsonBigInt;
}
```

Now update the `IndexerBrokerOnchainQueuePayload` union — append the 6 new types:
```typescript
  | VeDepositIndexerBrokerPayload
  | VeWithdrawIndexerBrokerPayload
  | VeLockPermanentIndexerBrokerPayload
  | VeUnlockPermanentIndexerBrokerPayload
  | VeMergeIndexerBrokerPayload
  | VeSplitIndexerBrokerPayload;
```

Update `IndexerBrokerOnchainWirePayloadWithoutTs` union (before the `'ts'` omit) the same way.

Now add the Notify input types (native `bigint`) after the existing `VoterWhitelistTokenIndexerBrokerNotifyInput` block (near the end of the file):

```typescript
export interface VeDepositIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'VeDeposit';
  provider: HexAddress;
  tokenId: bigint;
  depositType: string;
  value: bigint;
  locktime: bigint;
}

export interface VeWithdrawIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'VeWithdraw';
  provider: HexAddress;
  tokenId: bigint;
  value: bigint;
}

export interface VeLockPermanentIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'VeLockPermanent';
  owner: HexAddress;
  tokenId: bigint;
  amount: bigint;
}

export interface VeUnlockPermanentIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'VeUnlockPermanent';
  owner: HexAddress;
  tokenId: bigint;
  amount: bigint;
}

export interface VeMergeIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'VeMerge';
  sender: HexAddress;
  from: bigint;
  to: bigint;
  amountFrom: bigint;
  amountTo: bigint;
  amountFinal: bigint;
  locktime: bigint;
}

export interface VeSplitIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'VeSplit';
  from: bigint;
  tokenId1: bigint;
  tokenId2: bigint;
  sender: HexAddress;
  splitAmount1: bigint;
  splitAmount2: bigint;
  locktime: bigint;
}
```

Append the 6 NotifyInput types to the `IndexerBrokerNotifyPayload` union at the end of the file:
```typescript
  | VeDepositIndexerBrokerNotifyInput
  | VeWithdrawIndexerBrokerNotifyInput
  | VeLockPermanentIndexerBrokerNotifyInput
  | VeUnlockPermanentIndexerBrokerNotifyInput
  | VeMergeIndexerBrokerNotifyInput
  | VeSplitIndexerBrokerNotifyInput;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
pnpm --filter @giwater/shared build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
git add packages/shared/src/contract-events/indexer-broker-queue-payload.ts
git commit -m "feat(shared): add VotingEscrow VeDeposit/Withdraw/LockPermanent/UnlockPermanent/Merge/Split payload types"
```

---

## Task 2: Add Ponder schema tables for VE events

**Files:**
- Modify: `apps/amm-indexer/ponder.schema.ts`

- [ ] **Step 1: Append 6 new onchainTable definitions**

At the end of `apps/amm-indexer/ponder.schema.ts`, append:

```typescript
/** One row per `VotingEscrow.Deposit` log. */
export const veDepositEvent = onchainTable(
  "ve_deposit_event",
  (p) => ({
    id: p.text().primaryKey(),
    provider: p.hex().notNull(),
    tokenId: p.bigint().notNull(),
    depositType: p.text().notNull(),
    value: p.bigint().notNull(),
    locktime: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    providerIdx: index().on(t.provider),
    tokenIdIdx: index().on(t.tokenId),
  }),
);

/** One row per `VotingEscrow.Withdraw` log. */
export const veWithdrawEvent = onchainTable(
  "ve_withdraw_event",
  (p) => ({
    id: p.text().primaryKey(),
    provider: p.hex().notNull(),
    tokenId: p.bigint().notNull(),
    value: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    providerIdx: index().on(t.provider),
    tokenIdIdx: index().on(t.tokenId),
  }),
);

/** One row per `VotingEscrow.LockPermanent` log. */
export const veLockPermanentEvent = onchainTable(
  "ve_lock_permanent_event",
  (p) => ({
    id: p.text().primaryKey(),
    owner: p.hex().notNull(),
    tokenId: p.bigint().notNull(),
    amount: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    ownerIdx: index().on(t.owner),
    tokenIdIdx: index().on(t.tokenId),
  }),
);

/** One row per `VotingEscrow.UnlockPermanent` log. */
export const veUnlockPermanentEvent = onchainTable(
  "ve_unlock_permanent_event",
  (p) => ({
    id: p.text().primaryKey(),
    owner: p.hex().notNull(),
    tokenId: p.bigint().notNull(),
    amount: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    ownerIdx: index().on(t.owner),
    tokenIdIdx: index().on(t.tokenId),
  }),
);

/** One row per `VotingEscrow.Merge` log. */
export const veMergeEvent = onchainTable(
  "ve_merge_event",
  (p) => ({
    id: p.text().primaryKey(),
    sender: p.hex().notNull(),
    from: p.bigint().notNull(),
    to: p.bigint().notNull(),
    amountFrom: p.bigint().notNull(),
    amountTo: p.bigint().notNull(),
    amountFinal: p.bigint().notNull(),
    locktime: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    senderIdx: index().on(t.sender),
    fromIdx: index().on(t.from),
  }),
);

/** One row per `VotingEscrow.Split` log. */
export const veSplitEvent = onchainTable(
  "ve_split_event",
  (p) => ({
    id: p.text().primaryKey(),
    from: p.bigint().notNull(),
    tokenId1: p.bigint().notNull(),
    tokenId2: p.bigint().notNull(),
    sender: p.hex().notNull(),
    splitAmount1: p.bigint().notNull(),
    splitAmount2: p.bigint().notNull(),
    locktime: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    senderIdx: index().on(t.sender),
    fromIdx: index().on(t.from),
  }),
);
```

- [ ] **Step 2: Commit**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
git add apps/amm-indexer/ponder.schema.ts
git commit -m "feat(amm-indexer): add Ponder schema tables for VotingEscrow events"
```

---

## Task 3: Register VotingEscrow in ponder.config.ts

**Files:**
- Modify: `apps/amm-indexer/ponder.config.ts`

- [ ] **Step 1: Add import**

In `apps/amm-indexer/ponder.config.ts`, find the existing import from `@giwater/shared`:

```typescript
import {
  DYNAMIC_SWAP_FEE_MODULE_ADDRESS,
  DynamicSwapFeeModuleAbi,
  GiwaUniversalRouterAbi,
  POOL_FACTORY_ADDRESS,
  POOL_REWARD_REGISTRY_ADDRESS,
  PoolFactoryAbi,
  PoolRewardRegistryAbi,
  UNIVERSAL_ROUTER_ADDRESS,
  VOTER_ADDRESS,
  VoterAbi,
} from "@giwater/shared";
```

Replace with:

```typescript
import {
  DYNAMIC_SWAP_FEE_MODULE_ADDRESS,
  DynamicSwapFeeModuleAbi,
  GiwaUniversalRouterAbi,
  POOL_FACTORY_ADDRESS,
  POOL_REWARD_REGISTRY_ADDRESS,
  PoolFactoryAbi,
  PoolRewardRegistryAbi,
  UNIVERSAL_ROUTER_ADDRESS,
  VOTER_ADDRESS,
  VoterAbi,
  VOTING_ESCROW_ADDRESS,
  VotingEscrowAbi,
} from "@giwater/shared";
```

- [ ] **Step 2: Add VotingEscrow to contracts object**

In the `contracts` object (after the `Voter` entry), add:

```typescript
  VotingEscrow: {
    chain: "mainnet" as const,
    abi: VotingEscrowAbi as Abi,
    address: VOTING_ESCROW_ADDRESS,
    startBlock: Number(
      process.env.PONDER_START_BLOCK_VOTING_ESCROW ?? START_BLOCK.poolFactory,
    ),
  },
```

- [ ] **Step 3: Verify config parses**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App/apps/amm-indexer
npx tsc --noEmit 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
git add apps/amm-indexer/ponder.config.ts
git commit -m "feat(amm-indexer): register VotingEscrow contract in ponder config"
```

---

## Task 4: Write 6 VE event handlers

**Files:**
- Create: `apps/amm-indexer/src/handlers/veDeposit.ts`
- Create: `apps/amm-indexer/src/handlers/veWithdraw.ts`
- Create: `apps/amm-indexer/src/handlers/veLockPermanent.ts`
- Create: `apps/amm-indexer/src/handlers/veUnlockPermanent.ts`
- Create: `apps/amm-indexer/src/handlers/veMerge.ts`
- Create: `apps/amm-indexer/src/handlers/veSplit.ts`

- [ ] **Step 1: Create `veDeposit.ts`**

```typescript
// apps/amm-indexer/src/handlers/veDeposit.ts
import type { VeDepositIndexerBrokerNotifyInput } from "@giwater/shared";
import { veDepositEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleVeDeposit({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "VotingEscrow:Deposit";
  const a = event.args ?? {};
  const provider = lcAddr(a.provider ?? a[0]);
  const tokenId = BigInt(a.tokenId ?? a[1] ?? 0);
  const depositType = String(Number(a.depositType ?? a[2] ?? 0));
  const value = BigInt(a.value ?? a[3] ?? 0);
  const locktime = BigInt(a.locktime ?? a[4] ?? 0);

  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} tokenId=${tokenId} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(veDepositEvent)
    .values({ id: event.id, provider, tokenId, depositType, value, locktime, ...baseCols })
    .onConflictDoNothing();

  const notify: VeDepositIndexerBrokerNotifyInput = {
    type: "VeDeposit",
    id: event.id,
    provider: provider as `0x${string}`,
    tokenId,
    depositType,
    value,
    locktime,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
```

- [ ] **Step 2: Create `veWithdraw.ts`**

```typescript
// apps/amm-indexer/src/handlers/veWithdraw.ts
import type { VeWithdrawIndexerBrokerNotifyInput } from "@giwater/shared";
import { veWithdrawEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleVeWithdraw({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "VotingEscrow:Withdraw";
  const a = event.args ?? {};
  const provider = lcAddr(a.provider ?? a[0]);
  const tokenId = BigInt(a.tokenId ?? a[1] ?? 0);
  const value = BigInt(a.value ?? a[2] ?? 0);

  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} tokenId=${tokenId} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(veWithdrawEvent)
    .values({ id: event.id, provider, tokenId, value, ...baseCols })
    .onConflictDoNothing();

  const notify: VeWithdrawIndexerBrokerNotifyInput = {
    type: "VeWithdraw",
    id: event.id,
    provider: provider as `0x${string}`,
    tokenId,
    value,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
```

- [ ] **Step 3: Create `veLockPermanent.ts`**

```typescript
// apps/amm-indexer/src/handlers/veLockPermanent.ts
import type { VeLockPermanentIndexerBrokerNotifyInput } from "@giwater/shared";
import { veLockPermanentEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleVeLockPermanent({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "VotingEscrow:LockPermanent";
  const a = event.args ?? {};
  const owner = lcAddr(a._owner ?? a[0]);
  const tokenId = BigInt(a._tokenId ?? a[1] ?? 0);
  const amount = BigInt(a.amount ?? a[2] ?? 0);

  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} tokenId=${tokenId} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(veLockPermanentEvent)
    .values({ id: event.id, owner, tokenId, amount, ...baseCols })
    .onConflictDoNothing();

  const notify: VeLockPermanentIndexerBrokerNotifyInput = {
    type: "VeLockPermanent",
    id: event.id,
    owner: owner as `0x${string}`,
    tokenId,
    amount,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
```

- [ ] **Step 4: Create `veUnlockPermanent.ts`**

```typescript
// apps/amm-indexer/src/handlers/veUnlockPermanent.ts
import type { VeUnlockPermanentIndexerBrokerNotifyInput } from "@giwater/shared";
import { veUnlockPermanentEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleVeUnlockPermanent({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "VotingEscrow:UnlockPermanent";
  const a = event.args ?? {};
  const owner = lcAddr(a._owner ?? a[0]);
  const tokenId = BigInt(a._tokenId ?? a[1] ?? 0);
  const amount = BigInt(a.amount ?? a[2] ?? 0);

  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} tokenId=${tokenId} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(veUnlockPermanentEvent)
    .values({ id: event.id, owner, tokenId, amount, ...baseCols })
    .onConflictDoNothing();

  const notify: VeUnlockPermanentIndexerBrokerNotifyInput = {
    type: "VeUnlockPermanent",
    id: event.id,
    owner: owner as `0x${string}`,
    tokenId,
    amount,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
```

- [ ] **Step 5: Create `veMerge.ts`**

```typescript
// apps/amm-indexer/src/handlers/veMerge.ts
import type { VeMergeIndexerBrokerNotifyInput } from "@giwater/shared";
import { veMergeEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleVeMerge({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "VotingEscrow:Merge";
  const a = event.args ?? {};
  const sender = lcAddr(a._sender ?? a[0]);
  const from = BigInt(a._from ?? a[1] ?? 0);
  const to = BigInt(a._to ?? a[2] ?? 0);
  const amountFrom = BigInt(a._amountFrom ?? a[3] ?? 0);
  const amountTo = BigInt(a._amountTo ?? a[4] ?? 0);
  const amountFinal = BigInt(a._amountFinal ?? a[5] ?? 0);
  const locktime = BigInt(a._locktime ?? a[6] ?? 0);

  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} from=${from} to=${to} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(veMergeEvent)
    .values({ id: event.id, sender, from, to, amountFrom, amountTo, amountFinal, locktime, ...baseCols })
    .onConflictDoNothing();

  const notify: VeMergeIndexerBrokerNotifyInput = {
    type: "VeMerge",
    id: event.id,
    sender: sender as `0x${string}`,
    from,
    to,
    amountFrom,
    amountTo,
    amountFinal,
    locktime,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
```

- [ ] **Step 6: Create `veSplit.ts`**

```typescript
// apps/amm-indexer/src/handlers/veSplit.ts
import type { VeSplitIndexerBrokerNotifyInput } from "@giwater/shared";
import { veSplitEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleVeSplit({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "VotingEscrow:Split";
  const a = event.args ?? {};
  const from = BigInt(a._from ?? a[0] ?? 0);
  const tokenId1 = BigInt(a._tokenId1 ?? a[1] ?? 0);
  const tokenId2 = BigInt(a._tokenId2 ?? a[2] ?? 0);
  const sender = lcAddr(a._sender ?? a[3]);
  const splitAmount1 = BigInt(a._splitAmount1 ?? a[4] ?? 0);
  const splitAmount2 = BigInt(a._splitAmount2 ?? a[5] ?? 0);
  const locktime = BigInt(a._locktime ?? a[6] ?? 0);

  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} from=${from} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(veSplitEvent)
    .values({ id: event.id, from, tokenId1, tokenId2, sender, splitAmount1, splitAmount2, locktime, ...baseCols })
    .onConflictDoNothing();

  const notify: VeSplitIndexerBrokerNotifyInput = {
    type: "VeSplit",
    id: event.id,
    from,
    tokenId1,
    tokenId2,
    sender: sender as `0x${string}`,
    splitAmount1,
    splitAmount2,
    locktime,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App/apps/amm-indexer
npx tsc --noEmit 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
git add apps/amm-indexer/src/handlers/veDeposit.ts \
        apps/amm-indexer/src/handlers/veWithdraw.ts \
        apps/amm-indexer/src/handlers/veLockPermanent.ts \
        apps/amm-indexer/src/handlers/veUnlockPermanent.ts \
        apps/amm-indexer/src/handlers/veMerge.ts \
        apps/amm-indexer/src/handlers/veSplit.ts
git commit -m "feat(amm-indexer): add VotingEscrow event handlers"
```

---

## Task 5: Register VE handlers in amm-indexer/src/index.ts

**Files:**
- Modify: `apps/amm-indexer/src/index.ts`

- [ ] **Step 1: Add imports**

At the top of `apps/amm-indexer/src/index.ts`, after the existing handler imports, add:

```typescript
import { handleVeDeposit } from "./handlers/veDeposit";
import { handleVeWithdraw } from "./handlers/veWithdraw";
import { handleVeLockPermanent } from "./handlers/veLockPermanent";
import { handleVeUnlockPermanent } from "./handlers/veUnlockPermanent";
import { handleVeMerge } from "./handlers/veMerge";
import { handleVeSplit } from "./handlers/veSplit";
```

- [ ] **Step 2: Register ponder.on handlers**

At the end of `apps/amm-indexer/src/index.ts` (before or after the conditional PoolRewardRegistry block), add:

```typescript
ponder.on("VotingEscrow:Deposit" as any, (args: any) =>
  handleVeDeposit({ ...args, source: "VotingEscrow:Deposit" }),
);
ponder.on("VotingEscrow:Withdraw" as any, (args: any) =>
  handleVeWithdraw({ ...args, source: "VotingEscrow:Withdraw" }),
);
ponder.on("VotingEscrow:LockPermanent" as any, (args: any) =>
  handleVeLockPermanent({ ...args, source: "VotingEscrow:LockPermanent" }),
);
ponder.on("VotingEscrow:UnlockPermanent" as any, (args: any) =>
  handleVeUnlockPermanent({ ...args, source: "VotingEscrow:UnlockPermanent" }),
);
ponder.on("VotingEscrow:Merge" as any, (args: any) =>
  handleVeMerge({ ...args, source: "VotingEscrow:Merge" }),
);
ponder.on("VotingEscrow:Split" as any, (args: any) =>
  handleVeSplit({ ...args, source: "VotingEscrow:Split" }),
);
```

- [ ] **Step 3: Commit**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
git add apps/amm-indexer/src/index.ts
git commit -m "feat(amm-indexer): register VotingEscrow event handlers in ponder"
```

---

## Task 6: Add SQL migration for broker VE tables

**Files:**
- Create: `apps/broker/migrations/002_ve_lock_tables.sql`

- [ ] **Step 1: Create migration file**

```sql
-- apps/broker/migrations/002_ve_lock_tables.sql

CREATE TABLE IF NOT EXISTS ve_lock_positions (
  "tokenId"      TEXT PRIMARY KEY,
  "owner"        TEXT NOT NULL,
  "amount"       TEXT NOT NULL DEFAULT '0',
  "lockEnd"      TEXT,
  "isPermanent"  BOOLEAN NOT NULL DEFAULT FALSE,
  "isActive"     BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ve_lock_positions_owner ON ve_lock_positions ("owner");
CREATE INDEX IF NOT EXISTS ve_lock_positions_owner_active ON ve_lock_positions ("owner", "isActive");

CREATE TABLE IF NOT EXISTS ve_lock_events (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tokenId"          TEXT NOT NULL,
  "owner"            TEXT NOT NULL,
  "eventType"        TEXT NOT NULL,
  "depositType"      TEXT,
  "value"            TEXT NOT NULL DEFAULT '0',
  "lockEnd"          TEXT,
  "fromTokenId"      TEXT,
  "toTokenId"        TEXT,
  "indexerEventId"   TEXT NOT NULL UNIQUE,
  "blockNumber"      TEXT NOT NULL,
  "blockTimestamp"   TEXT NOT NULL,
  "transactionHash"  TEXT NOT NULL,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ve_lock_events_token_id ON ve_lock_events ("tokenId", "createdAt");
CREATE INDEX IF NOT EXISTS ve_lock_events_owner ON ve_lock_events ("owner", "createdAt");
```

- [ ] **Step 2: Commit**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
git add apps/broker/migrations/002_ve_lock_tables.sql
git commit -m "feat(broker): add SQL migration for ve_lock_positions and ve_lock_events tables"
```

---

## Task 7: Add TypeORM entities

**Files:**
- Create: `apps/broker/src/models/ve-lock/ve-lock-position.entity.ts`
- Create: `apps/broker/src/models/ve-lock/ve-lock-event.entity.ts`

- [ ] **Step 1: Create `ve-lock-position.entity.ts`**

```typescript
// apps/broker/src/models/ve-lock/ve-lock-position.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 've_lock_positions' })
@Index('ve_lock_positions_owner_active', ['owner', 'isActive'])
export class VeLockPositionEntity {
  @PrimaryColumn({ type: 'text' })
  tokenId!: string;

  @Column({ type: 'text' })
  @Index()
  owner!: string;

  @Column({ type: 'text', default: '0' })
  amount!: string;

  @Column({ type: 'text', nullable: true })
  lockEnd!: string | null;

  @Column({ type: 'boolean', default: false })
  isPermanent!: boolean;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
```

- [ ] **Step 2: Create `ve-lock-event.entity.ts`**

```typescript
// apps/broker/src/models/ve-lock/ve-lock-event.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One row per VotingEscrow event per tokenId.
 * eventType: Deposit | Withdraw | LockPermanent | UnlockPermanent | Merge | Split
 * For Split: fromTokenId=tokenId1, toTokenId=tokenId2 (both new tokens).
 * For Merge: fromTokenId=_from (burned), toTokenId=_to (receiving).
 */
@Entity({ name: 've_lock_events' })
@Index('ve_lock_events_token_id_created', ['tokenId', 'createdAt'])
@Index('ve_lock_events_owner_created', ['owner', 'createdAt'])
export class VeLockEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  tokenId!: string;

  @Column({ type: 'text' })
  owner!: string;

  @Column({ type: 'text' })
  eventType!: string;

  @Column({ type: 'text', nullable: true })
  depositType!: string | null;

  @Column({ type: 'text', default: '0' })
  value!: string;

  @Column({ type: 'text', nullable: true })
  lockEnd!: string | null;

  @Column({ type: 'text', nullable: true })
  fromTokenId!: string | null;

  @Column({ type: 'text', nullable: true })
  toTokenId!: string | null;

  @Column({ type: 'text', unique: true })
  indexerEventId!: string;

  @Column({ type: 'text' })
  blockNumber!: string;

  @Column({ type: 'text' })
  blockTimestamp!: string;

  @Column({ type: 'text' })
  transactionHash!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
git add apps/broker/src/models/ve-lock/
git commit -m "feat(broker): add VeLockPositionEntity and VeLockEventEntity TypeORM entities"
```

---

## Task 8: Register entities in BrokerDbModule

**Files:**
- Modify: `apps/broker/src/broker-db/broker-db.module.ts`

- [ ] **Step 1: Add imports at top of broker-db.module.ts**

After the last entity import line (near `import { SwapBucketStateEntity }...`), add:

```typescript
import { VeLockPositionEntity } from '../models/ve-lock/ve-lock-position.entity';
import { VeLockEventEntity } from '../models/ve-lock/ve-lock-event.entity';
```

- [ ] **Step 2: Add entities to both `entities` arrays**

In `broker-db.module.ts` there are two arrays: one inside `TypeOrmModule.forRootAsync` and one inside `TypeOrmModule.forFeature`. Add `VeLockPositionEntity` and `VeLockEventEntity` to **both** arrays.

In the `forRootAsync` entities array, after `BrokerSwapHopEntity`:
```typescript
          VeLockPositionEntity,
          VeLockEventEntity,
```

In the `forFeature` entities array, after `BrokerSwapHopEntity`:
```typescript
      VeLockPositionEntity,
      VeLockEventEntity,
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App/apps/broker
npx tsc --noEmit 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
git add apps/broker/src/broker-db/broker-db.module.ts
git commit -m "feat(broker): register VeLockPositionEntity and VeLockEventEntity in BrokerDbModule"
```

---

## Task 9: Write VE lock aggregator functions

**Files:**
- Create: `apps/broker/src/aggregator/ve-lock-events.ts`

The aggregator uses raw SQL via `dataSource.query()` — same pattern as `gauge-stake-events.ts`. Each function upserts `ve_lock_positions` (current state) and inserts into `ve_lock_events` (history).

DepositType values (uint8 stored as string): `'0'`=DEPOSIT_FOR_TYPE, `'1'`=CREATE_LOCK_TYPE, `'2'`=INCREASE_LOCK_AMOUNT, `'3'`=INCREASE_UNLOCK_TIME.

- [ ] **Step 1: Create `ve-lock-events.ts`**

```typescript
// apps/broker/src/aggregator/ve-lock-events.ts
import type {
  VeDepositIndexerBrokerPayload,
  VeWithdrawIndexerBrokerPayload,
  VeLockPermanentIndexerBrokerPayload,
  VeUnlockPermanentIndexerBrokerPayload,
  VeMergeIndexerBrokerPayload,
  VeSplitIndexerBrokerPayload,
} from '@giwater/shared';
import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';

const logger = new Logger('VeLockAggregator');

const CREATE_LOCK_TYPE = '1';
const INCREASE_LOCK_AMOUNT = '2';
const INCREASE_UNLOCK_TIME = '3';

export async function aggregateVeDeposit(
  payload: VeDepositIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, provider, tokenId, depositType, value, locktime, blockNumber, blockTimestamp, transactionHash } = payload;
  const owner = provider.toLowerCase();

  await dataSource.query(
    `INSERT INTO ve_lock_events
       ("tokenId","owner","eventType","depositType","value","lockEnd","fromTokenId","toTokenId",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ($1,$2,'Deposit',$3,$4,$5,NULL,NULL,$6,$7,$8,$9)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [
      tokenId, owner, depositType, value,
      depositType === INCREASE_UNLOCK_TIME ? locktime : null,
      id, blockNumber, blockTimestamp, transactionHash.toLowerCase(),
    ],
  );

  if (depositType === CREATE_LOCK_TYPE) {
    await dataSource.query(
      `INSERT INTO ve_lock_positions ("tokenId","owner","amount","lockEnd","isPermanent","isActive")
       VALUES ($1,$2,$3,$4,false,true)
       ON CONFLICT ("tokenId") DO NOTHING`,
      [tokenId, owner, value, locktime],
    );
  } else if (depositType === INCREASE_LOCK_AMOUNT || depositType === '0') {
    await dataSource.query(
      `UPDATE ve_lock_positions
       SET amount = (CAST(amount AS NUMERIC) + CAST($1 AS NUMERIC))::TEXT, "updatedAt" = NOW()
       WHERE "tokenId" = $2`,
      [value, tokenId],
    );
  } else if (depositType === INCREASE_UNLOCK_TIME) {
    await dataSource.query(
      `UPDATE ve_lock_positions SET "lockEnd" = $1, "updatedAt" = NOW() WHERE "tokenId" = $2`,
      [locktime, tokenId],
    );
  }

  logger.debug(`VeDeposit tokenId=${tokenId} owner=${owner} depositType=${depositType}`);
}

export async function aggregateVeWithdraw(
  payload: VeWithdrawIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, provider, tokenId, value, blockNumber, blockTimestamp, transactionHash } = payload;
  const owner = provider.toLowerCase();

  await dataSource.query(
    `INSERT INTO ve_lock_events
       ("tokenId","owner","eventType","depositType","value","lockEnd","fromTokenId","toTokenId",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ($1,$2,'Withdraw',NULL,$3,NULL,NULL,NULL,$4,$5,$6,$7)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [tokenId, owner, value, id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  await dataSource.query(
    `UPDATE ve_lock_positions SET "isActive" = false, amount = '0', "updatedAt" = NOW() WHERE "tokenId" = $1`,
    [tokenId],
  );

  logger.debug(`VeWithdraw tokenId=${tokenId} owner=${owner}`);
}

export async function aggregateVeLockPermanent(
  payload: VeLockPermanentIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, owner, tokenId, amount, blockNumber, blockTimestamp, transactionHash } = payload;
  const ownerLc = owner.toLowerCase();

  await dataSource.query(
    `INSERT INTO ve_lock_events
       ("tokenId","owner","eventType","depositType","value","lockEnd","fromTokenId","toTokenId",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ($1,$2,'LockPermanent',NULL,$3,NULL,NULL,NULL,$4,$5,$6,$7)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [tokenId, ownerLc, amount, id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  await dataSource.query(
    `UPDATE ve_lock_positions SET "isPermanent" = true, "lockEnd" = NULL, "updatedAt" = NOW() WHERE "tokenId" = $1`,
    [tokenId],
  );

  logger.debug(`VeLockPermanent tokenId=${tokenId}`);
}

export async function aggregateVeUnlockPermanent(
  payload: VeUnlockPermanentIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, owner, tokenId, amount, blockNumber, blockTimestamp, transactionHash } = payload;
  const ownerLc = owner.toLowerCase();

  await dataSource.query(
    `INSERT INTO ve_lock_events
       ("tokenId","owner","eventType","depositType","value","lockEnd","fromTokenId","toTokenId",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ($1,$2,'UnlockPermanent',NULL,$3,NULL,NULL,NULL,$4,$5,$6,$7)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [tokenId, ownerLc, amount, id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  await dataSource.query(
    `UPDATE ve_lock_positions SET "isPermanent" = false, "updatedAt" = NOW() WHERE "tokenId" = $1`,
    [tokenId],
  );

  logger.debug(`VeUnlockPermanent tokenId=${tokenId}`);
}

export async function aggregateVeMerge(
  payload: VeMergeIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, sender, from, to, amountFinal, locktime, blockNumber, blockTimestamp, transactionHash } = payload;
  const ownerLc = sender.toLowerCase();

  // Event row: tokenId=from, fromTokenId=from (burned), toTokenId=to (receiving)
  await dataSource.query(
    `INSERT INTO ve_lock_events
       ("tokenId","owner","eventType","depositType","value","lockEnd","fromTokenId","toTokenId",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ($1,$2,'Merge',NULL,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [from, ownerLc, amountFinal, locktime, from, to, id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  await dataSource.query(
    `UPDATE ve_lock_positions SET "isActive" = false, amount = '0', "updatedAt" = NOW() WHERE "tokenId" = $1`,
    [from],
  );
  await dataSource.query(
    `UPDATE ve_lock_positions SET amount = $1, "lockEnd" = $2, "updatedAt" = NOW() WHERE "tokenId" = $3`,
    [amountFinal, locktime, to],
  );

  logger.debug(`VeMerge from=${from} to=${to} amountFinal=${amountFinal}`);
}

export async function aggregateVeSplit(
  payload: VeSplitIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, from, tokenId1, tokenId2, sender, splitAmount1, splitAmount2, locktime, blockNumber, blockTimestamp, transactionHash } = payload;
  const ownerLc = sender.toLowerCase();

  // Event row: tokenId=from, fromTokenId=tokenId1, toTokenId=tokenId2
  await dataSource.query(
    `INSERT INTO ve_lock_events
       ("tokenId","owner","eventType","depositType","value","lockEnd","fromTokenId","toTokenId",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ($1,$2,'Split',NULL,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [from, ownerLc, splitAmount1, locktime, tokenId1, tokenId2, id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  // Burn source
  await dataSource.query(
    `UPDATE ve_lock_positions SET "isActive" = false, amount = '0', "updatedAt" = NOW() WHERE "tokenId" = $1`,
    [from],
  );
  // Insert tokenId1
  await dataSource.query(
    `INSERT INTO ve_lock_positions ("tokenId","owner","amount","lockEnd","isPermanent","isActive")
     VALUES ($1,$2,$3,$4,false,true)
     ON CONFLICT ("tokenId") DO UPDATE SET amount=$3,"lockEnd"=$4,"isActive"=true,"updatedAt"=NOW()`,
    [tokenId1, ownerLc, splitAmount1, locktime],
  );
  // Insert tokenId2
  await dataSource.query(
    `INSERT INTO ve_lock_positions ("tokenId","owner","amount","lockEnd","isPermanent","isActive")
     VALUES ($1,$2,$3,$4,false,true)
     ON CONFLICT ("tokenId") DO UPDATE SET amount=$3,"lockEnd"=$4,"isActive"=true,"updatedAt"=NOW()`,
    [tokenId2, ownerLc, splitAmount2, locktime],
  );

  logger.debug(`VeSplit from=${from} tokenId1=${tokenId1} tokenId2=${tokenId2}`);
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
git add apps/broker/src/aggregator/ve-lock-events.ts
git commit -m "feat(broker): add VE lock aggregator functions"
```

---

## Task 10: Wire VE aggregator into aggregator/index.ts

**Files:**
- Modify: `apps/broker/src/aggregator/index.ts`

- [ ] **Step 1: Add import for VE payload types**

In `apps/broker/src/aggregator/index.ts`, add to the `@giwater/shared` import block:

```typescript
  VeDepositIndexerBrokerPayload,
  VeWithdrawIndexerBrokerPayload,
  VeLockPermanentIndexerBrokerPayload,
  VeUnlockPermanentIndexerBrokerPayload,
  VeMergeIndexerBrokerPayload,
  VeSplitIndexerBrokerPayload,
```

- [ ] **Step 2: Add import for VE aggregator functions**

After the existing `import { aggregateGaugeDeposit, ... } from './gauge-stake-events';`, add:

```typescript
import {
  aggregateVeDeposit,
  aggregateVeWithdraw,
  aggregateVeLockPermanent,
  aggregateVeUnlockPermanent,
  aggregateVeMerge,
  aggregateVeSplit,
} from './ve-lock-events';
```

- [ ] **Step 3: Add 6 cases to the switch statement**

In the `switch (type)` block, before the `default:` case, add:

```typescript
    case 'VeDeposit':
      await aggregateVeDeposit(
        record as unknown as VeDepositIndexerBrokerPayload,
        deps.dataSource,
      );
      return;
    case 'VeWithdraw':
      await aggregateVeWithdraw(
        record as unknown as VeWithdrawIndexerBrokerPayload,
        deps.dataSource,
      );
      return;
    case 'VeLockPermanent':
      await aggregateVeLockPermanent(
        record as unknown as VeLockPermanentIndexerBrokerPayload,
        deps.dataSource,
      );
      return;
    case 'VeUnlockPermanent':
      await aggregateVeUnlockPermanent(
        record as unknown as VeUnlockPermanentIndexerBrokerPayload,
        deps.dataSource,
      );
      return;
    case 'VeMerge':
      await aggregateVeMerge(
        record as unknown as VeMergeIndexerBrokerPayload,
        deps.dataSource,
      );
      return;
    case 'VeSplit':
      await aggregateVeSplit(
        record as unknown as VeSplitIndexerBrokerPayload,
        deps.dataSource,
      );
      return;
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App/apps/broker
npx tsc --noEmit 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
git add apps/broker/src/aggregator/index.ts
git commit -m "feat(broker): wire VE lock aggregator into event dispatch"
```

---

## Task 11: Write VeLockService

**Files:**
- Create: `apps/broker/src/ve-lock/ve-lock.service.ts`

- [ ] **Step 1: Create `ve-lock.service.ts`**

```typescript
// apps/broker/src/ve-lock/ve-lock.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VeLockEventEntity } from '../models/ve-lock/ve-lock-event.entity';
import { VeLockPositionEntity } from '../models/ve-lock/ve-lock-position.entity';

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/i;

@Injectable()
export class VeLockService {
  constructor(
    @InjectRepository(VeLockPositionEntity)
    private readonly positions: Repository<VeLockPositionEntity>,
    @InjectRepository(VeLockEventEntity)
    private readonly events: Repository<VeLockEventEntity>,
  ) {}

  async getPositionsByOwner(owner: string): Promise<VeLockPositionEntity[]> {
    if (!ADDR_RE.test(owner)) return [];
    return this.positions.find({
      where: { owner: owner.toLowerCase() },
      order: { createdAt: 'ASC' },
    });
  }

  async getPositionByTokenId(tokenId: string): Promise<VeLockPositionEntity | null> {
    return this.positions.findOne({ where: { tokenId } });
  }

  async getEventsByTokenId(tokenId: string): Promise<VeLockEventEntity[]> {
    return this.events.find({
      where: { tokenId },
      order: { createdAt: 'ASC' },
    });
  }

  async getEventsByOwner(owner: string): Promise<VeLockEventEntity[]> {
    if (!ADDR_RE.test(owner)) return [];
    return this.events.find({
      where: { owner: owner.toLowerCase() },
      order: { createdAt: 'ASC' },
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
git add apps/broker/src/ve-lock/ve-lock.service.ts
git commit -m "feat(broker): add VeLockService for querying lock positions and event history"
```

---

## Task 12: Write VeLockController and VeLockModule

**Files:**
- Create: `apps/broker/src/ve-lock/ve-lock.controller.ts`
- Create: `apps/broker/src/ve-lock/ve-lock.module.ts`

- [ ] **Step 1: Create `ve-lock.controller.ts`**

Note: `@Get('history')` must appear before `@Get(':tokenId')` so NestJS doesn't treat "history" as a tokenId param.

```typescript
// apps/broker/src/ve-lock/ve-lock.controller.ts
import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { VeLockService } from './ve-lock.service';

@ApiTags('ve-locks')
@Controller('ve-locks')
export class VeLockController {
  constructor(private readonly veLock: VeLockService) {}

  @Get()
  @ApiOperation({ summary: 'All veNFT positions for a wallet (active + inactive)' })
  @ApiQuery({ name: 'owner', required: true, description: 'Wallet address (0x…)' })
  @ApiOkResponse({ description: 've_lock_positions rows for the owner' })
  async getPositionsByOwner(@Query('owner') owner: string) {
    return this.veLock.getPositionsByOwner(owner);
  }

  @Get('history')
  @ApiOperation({ summary: 'Full VotingEscrow event history for a wallet' })
  @ApiQuery({ name: 'owner', required: true, description: 'Wallet address (0x…)' })
  @ApiOkResponse({ description: 've_lock_events rows for the owner across all tokenIds' })
  async getEventsByOwner(@Query('owner') owner: string) {
    return this.veLock.getEventsByOwner(owner);
  }

  @Get(':tokenId')
  @ApiOperation({ summary: 'Single veNFT position detail' })
  @ApiParam({ name: 'tokenId', description: 'veNFT token ID (decimal string)' })
  @ApiOkResponse({ description: 'Single ve_lock_positions row' })
  async getPosition(@Param('tokenId') tokenId: string) {
    const pos = await this.veLock.getPositionByTokenId(tokenId);
    if (!pos) throw new NotFoundException(`No position for tokenId=${tokenId}`);
    return pos;
  }

  @Get(':tokenId/history')
  @ApiOperation({ summary: 'VotingEscrow event history for one veNFT' })
  @ApiParam({ name: 'tokenId', description: 'veNFT token ID (decimal string)' })
  @ApiOkResponse({ description: 've_lock_events rows for the tokenId' })
  async getTokenHistory(@Param('tokenId') tokenId: string) {
    return this.veLock.getEventsByTokenId(tokenId);
  }
}
```

- [ ] **Step 2: Create `ve-lock.module.ts`**

```typescript
// apps/broker/src/ve-lock/ve-lock.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VeLockEventEntity } from '../models/ve-lock/ve-lock-event.entity';
import { VeLockPositionEntity } from '../models/ve-lock/ve-lock-position.entity';
import { VeLockController } from './ve-lock.controller';
import { VeLockService } from './ve-lock.service';

@Module({
  imports: [TypeOrmModule.forFeature([VeLockPositionEntity, VeLockEventEntity])],
  controllers: [VeLockController],
  providers: [VeLockService],
})
export class VeLockModule {}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
git add apps/broker/src/ve-lock/ve-lock.controller.ts apps/broker/src/ve-lock/ve-lock.module.ts
git commit -m "feat(broker): add VeLockController and VeLockModule"
```

---

## Task 13: Wire VeLockModule into AppModule

**Files:**
- Modify: `apps/broker/src/app.module.ts`

- [ ] **Step 1: Add import**

In `apps/broker/src/app.module.ts`, add after the existing module imports:

```typescript
import { VeLockModule } from './ve-lock/ve-lock.module';
```

- [ ] **Step 2: Add to imports array**

In the `@Module({ imports: [...] })` array, add:

```typescript
    VeLockModule,
```

- [ ] **Step 3: Verify full broker TypeScript**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App/apps/broker
npx tsc --noEmit 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
git add apps/broker/src/app.module.ts
git commit -m "feat(broker): wire VeLockModule into AppModule"
```

---

## Task 14: Smoke test

- [ ] **Step 1: Verify broker builds**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
pnpm --filter @giwater/broker build 2>&1 | tail -20
```

Expected: build succeeds with no type errors.

- [ ] **Step 2: Verify amm-indexer builds**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
pnpm --filter @giwater/amm-indexer build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Verify shared builds**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
pnpm --filter @giwater/shared build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 4: Check migration file is lexicographically after 001**

```bash
ls /Users/hyungsukkang/GiwaTer-Labs/Giwater-App/apps/broker/migrations/
```

Expected: `001_broker_schema_from_typeorm_entities.sql` and `002_ve_lock_tables.sql` listed in order.

- [ ] **Step 5: Final commit**

```bash
cd /Users/hyungsukkang/GiwaTer-Labs/Giwater-App
git add -A
git status
```

If clean, done. If there are any leftover changes, stage and commit them:

```bash
git commit -m "chore: finalize veNFT lock position tracking implementation"
```
