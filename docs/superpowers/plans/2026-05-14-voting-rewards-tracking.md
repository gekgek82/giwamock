# Voting & Reward Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Index veNFT vote allocations and fee/bribe reward claims end-to-end: amm-indexer → RabbitMQ → broker DB → REST → gateway RPC parity; also backfills the ve-lock gateway/RPC gap from the previous sprint.

**Architecture:** amm-indexer adds 4 Ponder handlers + 2 factory contract registrations; @giwater/shared adds 4 wire + 4 notify-input payload types; broker adds a SQL migration, 3 TypeORM entities, 4 aggregator functions, and a VotingModule (service + claimable-service + controller); broker's GatewayRpcInvokeService is extended with /voting/* and /ve-locks/* routes; gateway's BrokerHttpParityController gets 8 new parity routes.

**Tech Stack:** Ponder (amm-indexer), NestJS + TypeORM + PostgreSQL (broker), amqp-connection-manager RabbitMQ RPC (gateway↔broker), viem multicall (live on-chain claimable), @giwater/shared (FeesVotingRewardAbi, BribeVotingRewardAbi already present)

---

## File Map

| File | Action |
|---|---|
| `packages/shared/src/contract-events/indexer-broker-queue-payload.ts` | Modify — add 4 wire + 4 notify-input types, extend 3 union types |
| `apps/amm-indexer/ponder.schema.ts` | Modify — add 4 onchainTable definitions |
| `apps/amm-indexer/ponder.config.ts` | Modify — add FeeVotingReward + BribeVotingReward factory contracts |
| `apps/amm-indexer/src/handlers/voterVoted.ts` | Create |
| `apps/amm-indexer/src/handlers/voterAbstained.ts` | Create |
| `apps/amm-indexer/src/handlers/feeVotingRewardClaim.ts` | Create |
| `apps/amm-indexer/src/handlers/bribeVotingRewardClaim.ts` | Create |
| `apps/amm-indexer/src/index.ts` | Modify — register 4 handlers |
| `apps/broker/migrations/003_voting_tables.sql` | Create |
| `apps/broker/src/models/voting/voter-vote-position.entity.ts` | Create |
| `apps/broker/src/models/voting/voter-vote-event.entity.ts` | Create |
| `apps/broker/src/models/voting/voter-reward-claim.entity.ts` | Create |
| `apps/broker/src/broker-db/broker-db.module.ts` | Modify — register 3 entities |
| `apps/broker/src/aggregator/voting-events.ts` | Create |
| `apps/broker/src/aggregator/index.ts` | Modify — add 4 switch cases |
| `apps/broker/src/voting/voting.service.ts` | Create |
| `apps/broker/src/voting/voting-claimable.service.ts` | Create |
| `apps/broker/src/voting/voting.controller.ts` | Create |
| `apps/broker/src/voting/voting.module.ts` | Create |
| `apps/broker/src/ve-lock/ve-lock.module.ts` | Modify — export VeLockService |
| `apps/broker/src/app.module.ts` | Modify — add VotingModule |
| `apps/broker/src/gateway-rpc/gateway-rpc-invoke.module.ts` | Modify — import VotingModule + VeLockModule |
| `apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts` | Modify — add /voting/* and /ve-locks/* route handlers |
| `apps/gateway/src/api/broker-http-parity.controller.ts` | Modify — add 8 parity routes |

---

### Task 1: Add voting payload types to @giwater/shared

**Files:**
- Modify: `packages/shared/src/contract-events/indexer-broker-queue-payload.ts`

Context: The file already has VE types (VeDeposit, VeMerge, etc.) and three union types to extend. Wire types extend `IndexerBrokerOnchainWireBase` (bigint fields as strings). Notify-input types extend `IndexerBrokerOnchainNotifyBase` (native bigint). Add new types after `VeSplitIndexerBrokerPayload` (line ~354) and after `VeSplitIndexerBrokerNotifyInput` (line ~735). Extend the three union types at lines ~385-390, ~426-431, and ~767-772.

- [ ] **Step 1: Add 4 wire payload interfaces after `VeSplitIndexerBrokerPayload`**

Find the line:
```typescript
/** `VotingEscrow.Split` — burn `from`, mint `tokenId1` and `tokenId2`. */
export interface VeSplitIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
```
After the closing `}` of `VeSplitIndexerBrokerPayload`, insert:

```typescript
/** `Voter.Voted` — veNFT casts votes on a pool for the current epoch. */
export interface VoterVotedIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'VoterVoted';
  voter: HexAddress;
  pool: HexAddress;
  tokenId: BrokerJsonBigInt;
  weight: BrokerJsonBigInt;
  totalWeight: BrokerJsonBigInt;
  epochTimestamp: BrokerJsonBigInt;
}

/** `Voter.Abstained` — veNFT resets votes on a pool (weight returns to 0). */
export interface VoterAbstainedIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'VoterAbstained';
  voter: HexAddress;
  pool: HexAddress;
  tokenId: BrokerJsonBigInt;
  weight: BrokerJsonBigInt;
  totalWeight: BrokerJsonBigInt;
  epochTimestamp: BrokerJsonBigInt;
}

/** `FeesVotingReward.ClaimRewards` — voter claims swap-fee rewards for a pool. */
export interface FeeVotingRewardClaimIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'FeeVotingRewardClaim';
  from: HexAddress;
  reward: HexAddress;
  amount: BrokerJsonBigInt;
  rewardContract: HexAddress;
}

/** `BribeVotingReward.ClaimRewards` — voter claims external-bribe rewards for a pool. */
export interface BribeVotingRewardClaimIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'BribeVotingRewardClaim';
  from: HexAddress;
  reward: HexAddress;
  amount: BrokerJsonBigInt;
  rewardContract: HexAddress;
}
```

- [ ] **Step 2: Extend `IndexerBrokerOnchainQueuePayload` union (after `VeSplitIndexerBrokerPayload`)**

Find:
```typescript
  | VeSplitIndexerBrokerPayload;
```
Replace with:
```typescript
  | VeSplitIndexerBrokerPayload
  | VoterVotedIndexerBrokerPayload
  | VoterAbstainedIndexerBrokerPayload
  | FeeVotingRewardClaimIndexerBrokerPayload
  | BribeVotingRewardClaimIndexerBrokerPayload;
```

- [ ] **Step 3: Extend `IndexerBrokerOnchainWirePayloadWithoutTs` union**

Find the `Omit<` block ending with:
```typescript
  | VeSplitIndexerBrokerPayload,
  'ts'
>;
```
Replace with:
```typescript
  | VeSplitIndexerBrokerPayload
  | VoterVotedIndexerBrokerPayload
  | VoterAbstainedIndexerBrokerPayload
  | FeeVotingRewardClaimIndexerBrokerPayload
  | BribeVotingRewardClaimIndexerBrokerPayload,
  'ts'
>;
```

- [ ] **Step 4: Add 4 notify-input interfaces after `VeSplitIndexerBrokerNotifyInput`**

Find the line:
```typescript
export interface VeSplitIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
```
After its closing `}`, insert:

```typescript
export interface VoterVotedIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'VoterVoted';
  voter: HexAddress;
  pool: HexAddress;
  tokenId: bigint;
  weight: bigint;
  totalWeight: bigint;
  epochTimestamp: bigint;
}

export interface VoterAbstainedIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'VoterAbstained';
  voter: HexAddress;
  pool: HexAddress;
  tokenId: bigint;
  weight: bigint;
  totalWeight: bigint;
  epochTimestamp: bigint;
}

export interface FeeVotingRewardClaimIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'FeeVotingRewardClaim';
  from: HexAddress;
  reward: HexAddress;
  amount: bigint;
  rewardContract: HexAddress;
}

export interface BribeVotingRewardClaimIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'BribeVotingRewardClaim';
  from: HexAddress;
  reward: HexAddress;
  amount: bigint;
  rewardContract: HexAddress;
}
```

- [ ] **Step 5: Extend `IndexerBrokerNotifyPayload` union (after `VeSplitIndexerBrokerNotifyInput`)**

Find:
```typescript
  | VeSplitIndexerBrokerNotifyInput;
```
Replace with:
```typescript
  | VeSplitIndexerBrokerNotifyInput
  | VoterVotedIndexerBrokerNotifyInput
  | VoterAbstainedIndexerBrokerNotifyInput
  | FeeVotingRewardClaimIndexerBrokerNotifyInput
  | BribeVotingRewardClaimIndexerBrokerNotifyInput;
```

- [ ] **Step 6: Build @giwater/shared and verify zero errors**

```bash
cd /path/to/Giwater-App
pnpm --filter @giwater/shared build
```
Expected: `⚡️ Build success`

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/contract-events/indexer-broker-queue-payload.ts
git commit -m "feat(shared): add VoterVoted/Abstained and fee/bribe claim payload types"
```

---

### Task 2: Add Ponder schema tables for voting events

**Files:**
- Modify: `apps/amm-indexer/ponder.schema.ts`

Context: Append 4 new `onchainTable` definitions at the end of the file. Follow the exact pattern of existing VE tables: `p.hex()` for addresses, `p.bigint()` for numeric values, `index()` for common query fields.

- [ ] **Step 1: Append 4 table definitions to ponder.schema.ts**

Add at the end of `apps/amm-indexer/ponder.schema.ts`:

```typescript
/** One row per `Voter.Voted` log. */
export const voterVotedEvent = onchainTable(
  "voter_voted_event",
  (p) => ({
    id: p.text().primaryKey(),
    voter: p.hex().notNull(),
    pool: p.hex().notNull(),
    tokenId: p.bigint().notNull(),
    weight: p.bigint().notNull(),
    totalWeight: p.bigint().notNull(),
    epochTimestamp: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    voterIdx: index().on(t.voter),
    tokenIdIdx: index().on(t.tokenId),
    poolIdx: index().on(t.pool),
  }),
);

/** One row per `Voter.Abstained` log. */
export const voterAbstainedEvent = onchainTable(
  "voter_abstained_event",
  (p) => ({
    id: p.text().primaryKey(),
    voter: p.hex().notNull(),
    pool: p.hex().notNull(),
    tokenId: p.bigint().notNull(),
    weight: p.bigint().notNull(),
    totalWeight: p.bigint().notNull(),
    epochTimestamp: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    voterIdx: index().on(t.voter),
    tokenIdIdx: index().on(t.tokenId),
  }),
);

/** One row per `FeesVotingReward.ClaimRewards` log. */
export const feeVotingRewardClaimEvent = onchainTable(
  "fee_voting_reward_claim_event",
  (p) => ({
    id: p.text().primaryKey(),
    from: p.hex().notNull(),
    reward: p.hex().notNull(),
    amount: p.bigint().notNull(),
    rewardContract: p.hex().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    fromIdx: index().on(t.from),
    rewardContractIdx: index().on(t.rewardContract),
  }),
);

/** One row per `BribeVotingReward.ClaimRewards` log. */
export const bribeVotingRewardClaimEvent = onchainTable(
  "bribe_voting_reward_claim_event",
  (p) => ({
    id: p.text().primaryKey(),
    from: p.hex().notNull(),
    reward: p.hex().notNull(),
    amount: p.bigint().notNull(),
    rewardContract: p.hex().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    fromIdx: index().on(t.from),
    rewardContractIdx: index().on(t.rewardContract),
  }),
);
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/amm-indexer && pnpm tsc --noEmit 2>&1 | grep -E "error TS" | grep -v "clGaugeDeposit\|clGaugeWithdraw\|gaugeDeposit\|gaugeWithdraw\|voterWhitelistPair"
```
Expected: no new errors (the 5 pre-existing errors are unrelated to this work)

- [ ] **Step 3: Commit**

```bash
git add apps/amm-indexer/ponder.schema.ts
git commit -m "feat(amm-indexer): add ponder schema tables for voter and reward claim events"
```

---

### Task 3: Register FeeVotingReward and BribeVotingReward factory contracts

**Files:**
- Modify: `apps/amm-indexer/ponder.config.ts`

Context: The file already imports `VoterAbi`, `VOTER_ADDRESS`, `FeesVotingRewardAbi`, and `BribeVotingRewardAbi` may need to be added. Both reward ABIs are in `@giwater/shared` (exported from `src/abis/index.ts`). Use the same factory pattern as `BasicGauge` and `CLGauge`.

- [ ] **Step 1: Add FeesVotingRewardAbi and BribeVotingRewardAbi to the import**

Find:
```typescript
import {
  CLGaugeAbi,
  DYNAMIC_SWAP_FEE_MODULE_ADDRESS,
  DynamicSwapFeeModuleAbi,
  GaugeAbi,
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
Replace with:
```typescript
import {
  BribeVotingRewardAbi,
  CLGaugeAbi,
  DYNAMIC_SWAP_FEE_MODULE_ADDRESS,
  DynamicSwapFeeModuleAbi,
  FeesVotingRewardAbi,
  GaugeAbi,
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

- [ ] **Step 2: Add FeeVotingReward and BribeVotingReward to contracts object**

Find the closing of the `contracts` object (after the `CLGauge` entry and before `export default createConfig`). Add:

```typescript
  FeeVotingReward: {
    chain: "mainnet" as const,
    abi: FeesVotingRewardAbi as Abi,
    factory: {
      address: VOTER_ADDRESS,
      event: getAbiItem({ abi: VoterAbi as Abi, name: "GaugeCreated" }) as any,
      parameter: "feeVotingReward",
    },
    startBlock: Number(
      process.env.PONDER_START_BLOCK_VOTER ?? START_BLOCK.poolFactory,
    ),
  },
  BribeVotingReward: {
    chain: "mainnet" as const,
    abi: BribeVotingRewardAbi as Abi,
    factory: {
      address: VOTER_ADDRESS,
      event: getAbiItem({ abi: VoterAbi as Abi, name: "GaugeCreated" }) as any,
      parameter: "bribeVotingReward",
    },
    startBlock: Number(
      process.env.PONDER_START_BLOCK_VOTER ?? START_BLOCK.poolFactory,
    ),
  },
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/amm-indexer && pnpm tsc --noEmit 2>&1 | grep "error TS" | grep "ponder.config"
```
Expected: no errors on ponder.config.ts

- [ ] **Step 4: Commit**

```bash
git add apps/amm-indexer/ponder.config.ts
git commit -m "feat(amm-indexer): register FeeVotingReward and BribeVotingReward factory contracts"
```

---

### Task 4: Write 4 voting event handlers

**Files:**
- Create: `apps/amm-indexer/src/handlers/voterVoted.ts`
- Create: `apps/amm-indexer/src/handlers/voterAbstained.ts`
- Create: `apps/amm-indexer/src/handlers/feeVotingRewardClaim.ts`
- Create: `apps/amm-indexer/src/handlers/bribeVotingRewardClaim.ts`

Context: Each handler follows the same pattern as `veDeposit.ts`: destructure `event.args`, call `baseLogColumns(event)`, insert into its Ponder table with `onConflictDoNothing()`, then call `notifyBroker()`. For reward claim handlers, the emitting contract address is `event.log.address` (the deployed FeeVotingReward/BribeVotingReward instance). The Voted/Abstained events have field `timestamp` (epoch start) — not the same as `blockTimestamp`.

- [ ] **Step 1: Create voterVoted.ts**

```typescript
import type { VoterVotedIndexerBrokerNotifyInput } from "@giwater/shared";
import { voterVotedEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleVoterVoted({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const a = event.args ?? {};
  const voter = lcAddr(a.voter ?? a[0]);
  const pool = lcAddr(a.pool ?? a[1]);
  const tokenId = BigInt(a.tokenId ?? a[2] ?? 0);
  const weight = BigInt(a.weight ?? a[3] ?? 0);
  const totalWeight = BigInt(a.totalWeight ?? a[4] ?? 0);
  const epochTimestamp = BigInt(a.timestamp ?? a[5] ?? 0);

  console.info(
    `[amm-indexer] Indexed Voter:Voted id=${event.id} tokenId=${tokenId} pool=${pool} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(voterVotedEvent)
    .values({ id: event.id, voter, pool, tokenId, weight, totalWeight, epochTimestamp, ...baseCols })
    .onConflictDoNothing();

  const notify: VoterVotedIndexerBrokerNotifyInput = {
    type: "VoterVoted",
    id: event.id,
    voter: voter as `0x${string}`,
    pool: pool as `0x${string}`,
    tokenId,
    weight,
    totalWeight,
    epochTimestamp,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
```

- [ ] **Step 2: Create voterAbstained.ts**

```typescript
import type { VoterAbstainedIndexerBrokerNotifyInput } from "@giwater/shared";
import { voterAbstainedEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleVoterAbstained({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const a = event.args ?? {};
  const voter = lcAddr(a.voter ?? a[0]);
  const pool = lcAddr(a.pool ?? a[1]);
  const tokenId = BigInt(a.tokenId ?? a[2] ?? 0);
  const weight = BigInt(a.weight ?? a[3] ?? 0);
  const totalWeight = BigInt(a.totalWeight ?? a[4] ?? 0);
  const epochTimestamp = BigInt(a.timestamp ?? a[5] ?? 0);

  console.info(
    `[amm-indexer] Indexed Voter:Abstained id=${event.id} tokenId=${tokenId} pool=${pool} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(voterAbstainedEvent)
    .values({ id: event.id, voter, pool, tokenId, weight, totalWeight, epochTimestamp, ...baseCols })
    .onConflictDoNothing();

  const notify: VoterAbstainedIndexerBrokerNotifyInput = {
    type: "VoterAbstained",
    id: event.id,
    voter: voter as `0x${string}`,
    pool: pool as `0x${string}`,
    tokenId,
    weight,
    totalWeight,
    epochTimestamp,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
```

- [ ] **Step 3: Create feeVotingRewardClaim.ts**

```typescript
import type { FeeVotingRewardClaimIndexerBrokerNotifyInput } from "@giwater/shared";
import { feeVotingRewardClaimEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleFeeVotingRewardClaim({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const a = event.args ?? {};
  const from = lcAddr(a.from ?? a[0]);
  const reward = lcAddr(a.reward ?? a[1]);
  const amount = BigInt(a.amount ?? a[2] ?? 0);
  const rewardContract = lcAddr(event.log?.address ?? "0x0000000000000000000000000000000000000000");

  console.info(
    `[amm-indexer] Indexed FeeVotingReward:ClaimRewards id=${event.id} from=${from} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(feeVotingRewardClaimEvent)
    .values({ id: event.id, from, reward, amount, rewardContract, ...baseCols })
    .onConflictDoNothing();

  const notify: FeeVotingRewardClaimIndexerBrokerNotifyInput = {
    type: "FeeVotingRewardClaim",
    id: event.id,
    from: from as `0x${string}`,
    reward: reward as `0x${string}`,
    amount,
    rewardContract: rewardContract as `0x${string}`,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
```

- [ ] **Step 4: Create bribeVotingRewardClaim.ts**

```typescript
import type { BribeVotingRewardClaimIndexerBrokerNotifyInput } from "@giwater/shared";
import { bribeVotingRewardClaimEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleBribeVotingRewardClaim({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const a = event.args ?? {};
  const from = lcAddr(a.from ?? a[0]);
  const reward = lcAddr(a.reward ?? a[1]);
  const amount = BigInt(a.amount ?? a[2] ?? 0);
  const rewardContract = lcAddr(event.log?.address ?? "0x0000000000000000000000000000000000000000");

  console.info(
    `[amm-indexer] Indexed BribeVotingReward:ClaimRewards id=${event.id} from=${from} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(bribeVotingRewardClaimEvent)
    .values({ id: event.id, from, reward, amount, rewardContract, ...baseCols })
    .onConflictDoNothing();

  const notify: BribeVotingRewardClaimIndexerBrokerNotifyInput = {
    type: "BribeVotingRewardClaim",
    id: event.id,
    from: from as `0x${string}`,
    reward: reward as `0x${string}`,
    amount,
    rewardContract: rewardContract as `0x${string}`,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
```

- [ ] **Step 5: Verify TypeScript (no new errors)**

```bash
cd apps/amm-indexer && pnpm tsc --noEmit 2>&1 | grep "error TS" | grep -v "clGaugeDeposit\|clGaugeWithdraw\|gaugeDeposit\|gaugeWithdraw\|voterWhitelistPair"
```
Expected: no output

- [ ] **Step 6: Commit**

```bash
git add apps/amm-indexer/src/handlers/voterVoted.ts \
        apps/amm-indexer/src/handlers/voterAbstained.ts \
        apps/amm-indexer/src/handlers/feeVotingRewardClaim.ts \
        apps/amm-indexer/src/handlers/bribeVotingRewardClaim.ts
git commit -m "feat(amm-indexer): add voting and reward claim event handlers"
```

---

### Task 5: Register voting handlers in amm-indexer/src/index.ts

**Files:**
- Modify: `apps/amm-indexer/src/index.ts`

Context: The existing pattern registers handlers as `ponder.on("Contract:Event" as any, (args: any) => handler({ ...args, source: "..." }))`. Add 4 imports and 4 registrations at the end of the file, following the same pattern.

- [ ] **Step 1: Add 4 imports after the VeSplit import block**

Find:
```typescript
import { handleVeSplit } from "./handlers/veSplit";
```
After that line, add:
```typescript
import { handleVoterVoted } from "./handlers/voterVoted";
import { handleVoterAbstained } from "./handlers/voterAbstained";
import { handleFeeVotingRewardClaim } from "./handlers/feeVotingRewardClaim";
import { handleBribeVotingRewardClaim } from "./handlers/bribeVotingRewardClaim";
```

- [ ] **Step 2: Register 4 handlers at the end of index.ts**

Find:
```typescript
ponder.on("VotingEscrow:Split" as any, (args: any) =>
  handleVeSplit({ ...args, source: "VotingEscrow:Split" }),
);
```
After that block, add:
```typescript
ponder.on("Voter:Voted" as any, (args: any) =>
  handleVoterVoted({ ...args, source: "Voter:Voted" }),
);
ponder.on("Voter:Abstained" as any, (args: any) =>
  handleVoterAbstained({ ...args, source: "Voter:Abstained" }),
);
ponder.on("FeeVotingReward:ClaimRewards" as any, (args: any) =>
  handleFeeVotingRewardClaim({ ...args, source: "FeeVotingReward:ClaimRewards" }),
);
ponder.on("BribeVotingReward:ClaimRewards" as any, (args: any) =>
  handleBribeVotingRewardClaim({ ...args, source: "BribeVotingReward:ClaimRewards" }),
);
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/amm-indexer && pnpm tsc --noEmit 2>&1 | grep "error TS" | grep -v "clGaugeDeposit\|clGaugeWithdraw\|gaugeDeposit\|gaugeWithdraw\|voterWhitelistPair"
```
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add apps/amm-indexer/src/index.ts
git commit -m "feat(amm-indexer): register voting and reward claim handlers"
```

---

### Task 6: Add SQL migration for voting tables

**Files:**
- Create: `apps/broker/migrations/003_voting_tables.sql`

Context: Migrations in this directory are applied lexicographically at broker boot by `runBrokerSqlMigrationsOnBoot`. The prefix `003_` ensures this runs after `001_` and `002_`. The `voter_vote_positions` table has a composite PK `("tokenId", "pool")` — TypeORM will map this with two `@PrimaryColumn` decorators.

- [ ] **Step 1: Create 003_voting_tables.sql**

```sql
CREATE TABLE IF NOT EXISTS voter_vote_positions (
  "tokenId"        TEXT    NOT NULL,
  "pool"           TEXT    NOT NULL,
  "owner"          TEXT    NOT NULL,
  "weight"         TEXT    NOT NULL DEFAULT '0',
  "totalWeight"    TEXT    NOT NULL DEFAULT '0',
  "epochTimestamp" TEXT,
  "isActive"       BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("tokenId", "pool")
);

CREATE INDEX IF NOT EXISTS voter_vote_positions_owner_active
  ON voter_vote_positions ("owner", "isActive");

CREATE TABLE IF NOT EXISTS voter_vote_events (
  "id"              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  "tokenId"         TEXT    NOT NULL,
  "pool"            TEXT    NOT NULL,
  "owner"           TEXT    NOT NULL,
  "eventType"       TEXT    NOT NULL,
  "weight"          TEXT    NOT NULL DEFAULT '0',
  "totalWeight"     TEXT    NOT NULL DEFAULT '0',
  "epochTimestamp"  TEXT,
  "indexerEventId"  TEXT    NOT NULL UNIQUE,
  "blockNumber"     TEXT    NOT NULL,
  "blockTimestamp"  TEXT    NOT NULL,
  "transactionHash" TEXT    NOT NULL,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS voter_vote_events_owner_created
  ON voter_vote_events ("owner", "createdAt");
CREATE INDEX IF NOT EXISTS voter_vote_events_token_pool
  ON voter_vote_events ("tokenId", "pool");

CREATE TABLE IF NOT EXISTS voter_reward_claims (
  "id"              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  "claimType"       TEXT    NOT NULL,
  "rewardContract"  TEXT    NOT NULL,
  "rewardToken"     TEXT    NOT NULL,
  "from"            TEXT    NOT NULL,
  "amount"          TEXT    NOT NULL DEFAULT '0',
  "pool"            TEXT,
  "indexerEventId"  TEXT    NOT NULL UNIQUE,
  "blockNumber"     TEXT    NOT NULL,
  "blockTimestamp"  TEXT    NOT NULL,
  "transactionHash" TEXT    NOT NULL,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS voter_reward_claims_from_created
  ON voter_reward_claims ("from", "createdAt");
CREATE INDEX IF NOT EXISTS voter_reward_claims_contract
  ON voter_reward_claims ("rewardContract");
```

- [ ] **Step 2: Commit**

```bash
git add apps/broker/migrations/003_voting_tables.sql
git commit -m "feat(broker): add SQL migration for voting and reward claim tables"
```

---

### Task 7: Add TypeORM entities for voting tables

**Files:**
- Create: `apps/broker/src/models/voting/voter-vote-position.entity.ts`
- Create: `apps/broker/src/models/voting/voter-vote-event.entity.ts`
- Create: `apps/broker/src/models/voting/voter-reward-claim.entity.ts`

Context: Follow the VeLockPositionEntity/VeLockEventEntity pattern exactly. `voter_vote_positions` has a composite PK — use two `@PrimaryColumn` decorators. `voter_reward_claims.from` is a reserved SQL word; use `{ name: 'from' }` in the column decorator.

- [ ] **Step 1: Create voter-vote-position.entity.ts**

```typescript
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'voter_vote_positions' })
@Index('voter_vote_positions_owner_active', ['owner', 'isActive'])
export class VoterVotePositionEntity {
  @PrimaryColumn({ type: 'text' })
  tokenId!: string;

  @PrimaryColumn({ type: 'text' })
  pool!: string;

  @Column({ type: 'text' })
  @Index()
  owner!: string;

  @Column({ type: 'text', default: '0' })
  weight!: string;

  @Column({ type: 'text', default: '0' })
  totalWeight!: string;

  @Column({ type: 'text', nullable: true })
  epochTimestamp!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
```

- [ ] **Step 2: Create voter-vote-event.entity.ts**

```typescript
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'voter_vote_events' })
@Index('voter_vote_events_owner_created', ['owner', 'createdAt'])
@Index('voter_vote_events_token_pool', ['tokenId', 'pool'])
export class VoterVoteEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  tokenId!: string;

  @Column({ type: 'text' })
  pool!: string;

  @Column({ type: 'text' })
  owner!: string;

  @Column({ type: 'text' })
  eventType!: string;

  @Column({ type: 'text', default: '0' })
  weight!: string;

  @Column({ type: 'text', default: '0' })
  totalWeight!: string;

  @Column({ type: 'text', nullable: true })
  epochTimestamp!: string | null;

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

- [ ] **Step 3: Create voter-reward-claim.entity.ts**

```typescript
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'voter_reward_claims' })
@Index('voter_reward_claims_from_created', ['from', 'createdAt'])
@Index('voter_reward_claims_contract', ['rewardContract'])
export class VoterRewardClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  claimType!: string;

  @Column({ type: 'text' })
  rewardContract!: string;

  @Column({ type: 'text' })
  rewardToken!: string;

  @Column({ name: 'from', type: 'text' })
  from!: string;

  @Column({ type: 'text', default: '0' })
  amount!: string;

  @Column({ type: 'text', nullable: true })
  pool!: string | null;

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

- [ ] **Step 4: Verify TypeScript**

```bash
cd apps/broker && pnpm tsc --noEmit 2>&1 | grep "error TS"
```
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add apps/broker/src/models/voting/
git commit -m "feat(broker): add VoterVotePosition, VoterVoteEvent, VoterRewardClaim TypeORM entities"
```

---

### Task 8: Register voting entities in broker-db.module.ts

**Files:**
- Modify: `apps/broker/src/broker-db/broker-db.module.ts`

Context: Two places to add entities: the `entities` array inside `forRootAsync.useFactory` (for the TypeORM connection), and the `TypeOrmModule.forFeature([...])` array (for DI injection). Follow the exact pattern of the VeLockPositionEntity/VeLockEventEntity additions.

- [ ] **Step 1: Add imports at the top of broker-db.module.ts**

Find:
```typescript
import { VeLockPositionEntity } from '../models/ve-lock/ve-lock-position.entity';
import { VeLockEventEntity } from '../models/ve-lock/ve-lock-event.entity';
```
After those lines, add:
```typescript
import { VoterVotePositionEntity } from '../models/voting/voter-vote-position.entity';
import { VoterVoteEventEntity } from '../models/voting/voter-vote-event.entity';
import { VoterRewardClaimEntity } from '../models/voting/voter-reward-claim.entity';
```

- [ ] **Step 2: Add to the forRootAsync entities array**

Find:
```typescript
            VeLockPositionEntity,
            VeLockEventEntity,
```
After those lines, add:
```typescript
            VoterVotePositionEntity,
            VoterVoteEventEntity,
            VoterRewardClaimEntity,
```

- [ ] **Step 3: Add to the forFeature array**

Find:
```typescript
      VeLockPositionEntity,
      VeLockEventEntity,
```
After those lines, add:
```typescript
      VoterVotePositionEntity,
      VoterVoteEventEntity,
      VoterRewardClaimEntity,
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd apps/broker && pnpm tsc --noEmit 2>&1 | grep "error TS"
```
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add apps/broker/src/broker-db/broker-db.module.ts
git commit -m "feat(broker): register voting entities in BrokerDbModule"
```

---

### Task 9: Write voting aggregator functions

**Files:**
- Create: `apps/broker/src/aggregator/voting-events.ts`

Context: Follow the pattern of `ve-lock-events.ts` exactly. Use raw `dataSource.query()` for all DB writes. The `voter_vote_positions` table has composite PK `("tokenId","pool")` — the upsert uses `ON CONFLICT ("tokenId","pool") DO UPDATE`. For reward claim aggregators, resolve `pool` by querying `indexed_events` (the broker's raw event store) for the matching `VoterGaugeCreated` record.

- [ ] **Step 1: Create voting-events.ts**

```typescript
import type {
  VoterVotedIndexerBrokerPayload,
  VoterAbstainedIndexerBrokerPayload,
  FeeVotingRewardClaimIndexerBrokerPayload,
  BribeVotingRewardClaimIndexerBrokerPayload,
} from '@giwater/shared';
import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';

const logger = new Logger('VotingAggregator');

export async function aggregateVoterVoted(
  payload: VoterVotedIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, voter, pool, tokenId, weight, totalWeight, epochTimestamp, blockNumber, blockTimestamp, transactionHash } = payload;
  const owner = voter.toLowerCase();
  const poolLc = pool.toLowerCase();

  await dataSource.query(
    `INSERT INTO voter_vote_positions ("tokenId","pool","owner","weight","totalWeight","epochTimestamp","isActive")
     VALUES ($1,$2,$3,$4,$5,$6,true)
     ON CONFLICT ("tokenId","pool") DO UPDATE
       SET owner=$3, weight=$4, "totalWeight"=$5, "epochTimestamp"=$6, "isActive"=true, "updatedAt"=NOW()`,
    [tokenId, poolLc, owner, weight, totalWeight, epochTimestamp],
  );

  await dataSource.query(
    `INSERT INTO voter_vote_events
       ("tokenId","pool","owner","eventType","weight","totalWeight","epochTimestamp",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ($1,$2,$3,'voted',$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [tokenId, poolLc, owner, weight, totalWeight, epochTimestamp, id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  logger.debug(`VoterVoted tokenId=${tokenId} pool=${poolLc} owner=${owner}`);
}

export async function aggregateVoterAbstained(
  payload: VoterAbstainedIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, voter, pool, tokenId, weight, totalWeight, epochTimestamp, blockNumber, blockTimestamp, transactionHash } = payload;
  const owner = voter.toLowerCase();
  const poolLc = pool.toLowerCase();

  await dataSource.query(
    `UPDATE voter_vote_positions SET weight='0', "isActive"=false, "updatedAt"=NOW()
     WHERE "tokenId"=$1 AND pool=$2`,
    [tokenId, poolLc],
  );

  await dataSource.query(
    `INSERT INTO voter_vote_events
       ("tokenId","pool","owner","eventType","weight","totalWeight","epochTimestamp",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ($1,$2,$3,'abstained',$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [tokenId, poolLc, owner, weight, totalWeight, epochTimestamp, id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  logger.debug(`VoterAbstained tokenId=${tokenId} pool=${poolLc}`);
}

export async function aggregateFeeVotingRewardClaim(
  payload: FeeVotingRewardClaimIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, from, reward, amount, rewardContract, blockNumber, blockTimestamp, transactionHash } = payload;

  const poolRows: { pool?: string }[] = await dataSource.query(
    `SELECT payload->>'pool' AS pool
     FROM indexed_events
     WHERE payload->>'type' = 'VoterGaugeCreated'
       AND LOWER(payload->>'feeVotingReward') = $1
     LIMIT 1`,
    [rewardContract.toLowerCase()],
  );
  const pool = poolRows[0]?.pool ?? null;

  await dataSource.query(
    `INSERT INTO voter_reward_claims
       ("claimType","rewardContract","rewardToken","from","amount","pool",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ('fee',$1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [rewardContract.toLowerCase(), reward.toLowerCase(), from.toLowerCase(), amount, pool,
     id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  logger.debug(`FeeVotingRewardClaim from=${from} reward=${reward} amount=${amount}`);
}

export async function aggregateBribeVotingRewardClaim(
  payload: BribeVotingRewardClaimIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, from, reward, amount, rewardContract, blockNumber, blockTimestamp, transactionHash } = payload;

  const poolRows: { pool?: string }[] = await dataSource.query(
    `SELECT payload->>'pool' AS pool
     FROM indexed_events
     WHERE payload->>'type' = 'VoterGaugeCreated'
       AND LOWER(payload->>'bribeVotingReward') = $1
     LIMIT 1`,
    [rewardContract.toLowerCase()],
  );
  const pool = poolRows[0]?.pool ?? null;

  await dataSource.query(
    `INSERT INTO voter_reward_claims
       ("claimType","rewardContract","rewardToken","from","amount","pool",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ('bribe',$1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [rewardContract.toLowerCase(), reward.toLowerCase(), from.toLowerCase(), amount, pool,
     id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  logger.debug(`BribeVotingRewardClaim from=${from} reward=${reward} amount=${amount}`);
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/broker && pnpm tsc --noEmit 2>&1 | grep "error TS"
```
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add apps/broker/src/aggregator/voting-events.ts
git commit -m "feat(broker): add voting aggregator functions"
```

---

### Task 10: Wire voting aggregator into aggregator/index.ts

**Files:**
- Modify: `apps/broker/src/aggregator/index.ts`

Context: Add 4 import statements and 4 switch cases. The switch block dispatches on `record.type`. Add these cases right before the `default:` case (after the `VeSplit` case).

- [ ] **Step 1: Add imports to aggregator/index.ts**

Find:
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
After that block, add:
```typescript
import {
  aggregateVoterVoted,
  aggregateVoterAbstained,
  aggregateFeeVotingRewardClaim,
  aggregateBribeVotingRewardClaim,
} from './voting-events';
import type {
  VoterVotedIndexerBrokerPayload,
  VoterAbstainedIndexerBrokerPayload,
  FeeVotingRewardClaimIndexerBrokerPayload,
  BribeVotingRewardClaimIndexerBrokerPayload,
} from '@giwater/shared';
```

- [ ] **Step 2: Add 4 switch cases before the `default:` case**

Find:
```typescript
    case 'VeSplit':
      await aggregateVeSplit(
        record as unknown as VeSplitIndexerBrokerPayload,
        deps.dataSource,
      );
      return;
    default:
```
Replace with:
```typescript
    case 'VeSplit':
      await aggregateVeSplit(
        record as unknown as VeSplitIndexerBrokerPayload,
        deps.dataSource,
      );
      return;
    case 'VoterVoted':
      await aggregateVoterVoted(
        record as unknown as VoterVotedIndexerBrokerPayload,
        deps.dataSource,
      );
      return;
    case 'VoterAbstained':
      await aggregateVoterAbstained(
        record as unknown as VoterAbstainedIndexerBrokerPayload,
        deps.dataSource,
      );
      return;
    case 'FeeVotingRewardClaim':
      await aggregateFeeVotingRewardClaim(
        record as unknown as FeeVotingRewardClaimIndexerBrokerPayload,
        deps.dataSource,
      );
      return;
    case 'BribeVotingRewardClaim':
      await aggregateBribeVotingRewardClaim(
        record as unknown as BribeVotingRewardClaimIndexerBrokerPayload,
        deps.dataSource,
      );
      return;
    default:
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/broker && pnpm tsc --noEmit 2>&1 | grep "error TS"
```
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add apps/broker/src/aggregator/index.ts
git commit -m "feat(broker): wire voting aggregator cases into aggregator index"
```

---

### Task 11: Write VotingService and VotingClaimableService

**Files:**
- Create: `apps/broker/src/voting/voting.service.ts`
- Create: `apps/broker/src/voting/voting-claimable.service.ts`

Context: `VotingService` uses TypeORM Repository for DB queries (same pattern as `VeLockService`). `VotingClaimableService` uses viem multicall for live on-chain reads (same pattern as `StakingViewService`). The `FeesVotingRewardAbi` and `BribeVotingRewardAbi` both have `rewardsListLength()`, `rewards(uint256)`, and `earned(address,uint256)` — no inline ABI needed.

- [ ] **Step 1: Create voting.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VoterVotePositionEntity } from '../models/voting/voter-vote-position.entity';
import { VoterVoteEventEntity } from '../models/voting/voter-vote-event.entity';
import { VoterRewardClaimEntity } from '../models/voting/voter-reward-claim.entity';

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/i;

@Injectable()
export class VotingService {
  constructor(
    @InjectRepository(VoterVotePositionEntity)
    private readonly positions: Repository<VoterVotePositionEntity>,
    @InjectRepository(VoterVoteEventEntity)
    private readonly voteEvents: Repository<VoterVoteEventEntity>,
    @InjectRepository(VoterRewardClaimEntity)
    private readonly claims: Repository<VoterRewardClaimEntity>,
  ) {}

  async getPositionsByOwner(owner: string): Promise<VoterVotePositionEntity[]> {
    if (!ADDR_RE.test(owner)) return [];
    return this.positions.find({
      where: { owner: owner.toLowerCase(), isActive: true },
      order: { createdAt: 'ASC' },
    });
  }

  async getVoteEventsByOwner(owner: string): Promise<VoterVoteEventEntity[]> {
    if (!ADDR_RE.test(owner)) return [];
    return this.voteEvents.find({
      where: { owner: owner.toLowerCase() },
      order: { blockTimestamp: 'DESC' },
    });
  }

  async getClaimsByOwner(owner: string): Promise<VoterRewardClaimEntity[]> {
    if (!ADDR_RE.test(owner)) return [];
    return this.claims.find({
      where: { from: owner.toLowerCase() },
      order: { blockTimestamp: 'DESC' },
    });
  }
}
```

- [ ] **Step 2: Create voting-claimable.service.ts**

```typescript
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BribeVotingRewardAbi, FeesVotingRewardAbi } from '@giwater/shared';
import {
  createPublicClient,
  defineChain,
  getAddress,
  http,
  type Abi,
  type Address,
} from 'viem';
import { VoterVotePositionEntity } from '../models/voting/voter-vote-position.entity';
import { IndexerIngestedEventEntity } from '../models/indexer-ingested-event.entity';

const feeRewardAbi = FeesVotingRewardAbi as Abi;
const bribeRewardAbi = BribeVotingRewardAbi as Abi;
const ADDR_RE = /^0x[a-fA-F0-9]{40}$/i;

function giwaChain(rpcUrl: string) {
  return defineChain({
    id: 91342,
    name: 'Giwa Sepolia',
    nativeCurrency: { name: 'GIWA', symbol: 'GIWA', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

@Injectable()
export class VotingClaimableService {
  constructor(
    @InjectRepository(VoterVotePositionEntity)
    private readonly positions: Repository<VoterVotePositionEntity>,
    @InjectRepository(IndexerIngestedEventEntity)
    private readonly indexerEvents: Repository<IndexerIngestedEventEntity>,
  ) {}

  private requireRpcUrl(): string {
    const url =
      process.env.GIWA_SEPOLIA_RPC_URL?.trim() ||
      process.env.PONDER_RPC_URL_1?.trim() ||
      '';
    if (!url) {
      throw new ServiceUnavailableException(
        'Set GIWA_SEPOLIA_RPC_URL or PONDER_RPC_URL_1 for on-chain reward reads',
      );
    }
    return url;
  }

  private publicClient() {
    const url = this.requireRpcUrl();
    return createPublicClient({ chain: giwaChain(url), transport: http(url) });
  }

  async getClaimableByTokenId(tokenIdInput: string): Promise<
    {
      pool: string;
      rewardContract: string;
      claimType: 'fee' | 'bribe';
      rewardToken: string;
      earned: string;
    }[]
  > {
    const tokenId = tokenIdInput.trim();
    if (!tokenId || isNaN(Number(tokenId))) {
      throw new BadRequestException('tokenId must be a decimal integer string');
    }

    const activePools = await this.positions.find({
      where: { tokenId, isActive: true },
    });
    if (activePools.length === 0) return [];

    const poolAddresses = activePools.map((p) => p.pool.toLowerCase());

    const rows: { pool: string; feeVotingReward: string; bribeVotingReward: string }[] =
      await this.indexerEvents.query(
        `SELECT payload->>'pool' AS pool,
                payload->>'feeVotingReward' AS "feeVotingReward",
                payload->>'bribeVotingReward' AS "bribeVotingReward"
         FROM indexed_events
         WHERE payload->>'type' = 'VoterGaugeCreated'
           AND LOWER(payload->>'pool') = ANY($1)`,
        [poolAddresses],
      );

    const client = this.publicClient();
    const results: {
      pool: string;
      rewardContract: string;
      claimType: 'fee' | 'bribe';
      rewardToken: string;
      earned: string;
    }[] = [];

    for (const row of rows) {
      const contracts: { address: Address; abi: Abi; claimType: 'fee' | 'bribe' }[] = [];
      if (ADDR_RE.test(row.feeVotingReward ?? '')) {
        contracts.push({
          address: getAddress(row.feeVotingReward) as Address,
          abi: feeRewardAbi,
          claimType: 'fee',
        });
      }
      if (ADDR_RE.test(row.bribeVotingReward ?? '')) {
        contracts.push({
          address: getAddress(row.bribeVotingReward) as Address,
          abi: bribeRewardAbi,
          claimType: 'bribe',
        });
      }

      for (const { address, abi, claimType } of contracts) {
        const [lenResult] = await client.multicall({
          contracts: [{ address, abi, functionName: 'rewardsListLength' }],
          allowFailure: true,
        });
        const len =
          lenResult.status === 'success' && typeof lenResult.result === 'bigint'
            ? Number(lenResult.result)
            : 0;
        if (len === 0) continue;

        const tokenCalls = Array.from({ length: len }, (_, i) => ({
          address,
          abi,
          functionName: 'rewards' as const,
          args: [BigInt(i)] as const,
        }));
        const tokenResults = await client.multicall({ contracts: tokenCalls, allowFailure: true });

        const rewardTokens: Address[] = tokenResults
          .filter((r) => r.status === 'success' && typeof r.result === 'string')
          .map((r) => getAddress(r.result as string) as Address);

        if (rewardTokens.length === 0) continue;

        const earnedCalls = rewardTokens.map((token) => ({
          address,
          abi,
          functionName: 'earned' as const,
          args: [token, BigInt(tokenId)] as const,
        }));
        const earnedResults = await client.multicall({ contracts: earnedCalls, allowFailure: true });

        rewardTokens.forEach((token, i) => {
          const r = earnedResults[i];
          const earned =
            r.status === 'success' && typeof r.result === 'bigint' ? r.result : 0n;
          results.push({
            pool: row.pool,
            rewardContract: address,
            claimType,
            rewardToken: token,
            earned: earned.toString(),
          });
        });
      }
    }

    return results;
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/broker && pnpm tsc --noEmit 2>&1 | grep "error TS"
```
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add apps/broker/src/voting/voting.service.ts \
        apps/broker/src/voting/voting-claimable.service.ts
git commit -m "feat(broker): add VotingService and VotingClaimableService"
```

---

### Task 12: Write VotingController and VotingModule; export VeLockService

**Files:**
- Create: `apps/broker/src/voting/voting.controller.ts`
- Create: `apps/broker/src/voting/voting.module.ts`
- Modify: `apps/broker/src/ve-lock/ve-lock.module.ts`

Context: `VotingController` follows the same NestJS controller pattern as `VeLockController` — query params for owner-based lookups, route param for tokenId. `VotingModule` must export both services so `GatewayRpcInvokeModule` can use them. `VeLockModule` needs `exports: [VeLockService]` added so `GatewayRpcInvokeModule` can use it too.

- [ ] **Step 1: Create voting.controller.ts**

```typescript
import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { VotingClaimableService } from './voting-claimable.service';
import { VotingService } from './voting.service';

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/i;

@Controller('voting')
export class VotingController {
  constructor(
    private readonly voting: VotingService,
    private readonly claimable: VotingClaimableService,
  ) {}

  @Get('positions')
  async getPositions(@Query('owner') owner: string) {
    if (!owner?.trim() || !ADDR_RE.test(owner.trim())) {
      throw new BadRequestException('owner must be a valid 0x address');
    }
    return this.voting.getPositionsByOwner(owner.trim());
  }

  @Get('events')
  async getVoteEvents(@Query('owner') owner: string) {
    if (!owner?.trim() || !ADDR_RE.test(owner.trim())) {
      throw new BadRequestException('owner must be a valid 0x address');
    }
    return this.voting.getVoteEventsByOwner(owner.trim());
  }

  @Get('claimable/:tokenId')
  async getClaimable(@Param('tokenId') tokenId: string) {
    if (!tokenId?.trim()) {
      throw new BadRequestException('tokenId is required');
    }
    return this.claimable.getClaimableByTokenId(tokenId.trim());
  }

  @Get('claims')
  async getClaims(@Query('owner') owner: string) {
    if (!owner?.trim() || !ADDR_RE.test(owner.trim())) {
      throw new BadRequestException('owner must be a valid 0x address');
    }
    return this.voting.getClaimsByOwner(owner.trim());
  }
}
```

- [ ] **Step 2: Create voting.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexerIngestedEventEntity } from '../models/indexer-ingested-event.entity';
import { VoterRewardClaimEntity } from '../models/voting/voter-reward-claim.entity';
import { VoterVoteEventEntity } from '../models/voting/voter-vote-event.entity';
import { VoterVotePositionEntity } from '../models/voting/voter-vote-position.entity';
import { VotingClaimableService } from './voting-claimable.service';
import { VotingController } from './voting.controller';
import { VotingService } from './voting.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VoterVotePositionEntity,
      VoterVoteEventEntity,
      VoterRewardClaimEntity,
      IndexerIngestedEventEntity,
    ]),
  ],
  controllers: [VotingController],
  providers: [VotingService, VotingClaimableService],
  exports: [VotingService, VotingClaimableService],
})
export class VotingModule {}
```

- [ ] **Step 3: Add exports to VeLockModule**

In `apps/broker/src/ve-lock/ve-lock.module.ts`, find:
```typescript
  providers: [VeLockService],
})
```
Replace with:
```typescript
  providers: [VeLockService],
  exports: [VeLockService],
})
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd apps/broker && pnpm tsc --noEmit 2>&1 | grep "error TS"
```
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add apps/broker/src/voting/voting.controller.ts \
        apps/broker/src/voting/voting.module.ts \
        apps/broker/src/ve-lock/ve-lock.module.ts
git commit -m "feat(broker): add VotingController, VotingModule; export VeLockService"
```

---

### Task 13: Wire VotingModule into broker AppModule

**Files:**
- Modify: `apps/broker/src/app.module.ts`

- [ ] **Step 1: Add VotingModule import and registration**

Find:
```typescript
import { VeLockModule } from './ve-lock/ve-lock.module';
```
After that line, add:
```typescript
import { VotingModule } from './voting/voting.module';
```

Find:
```typescript
    VeLockModule,
  ],
})
```
Replace with:
```typescript
    VeLockModule,
    VotingModule,
  ],
})
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/broker && pnpm tsc --noEmit 2>&1 | grep "error TS"
```
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add apps/broker/src/app.module.ts
git commit -m "feat(broker): wire VotingModule into AppModule"
```

---

### Task 14: Extend GatewayRpcInvokeService with /voting/* and /ve-locks/* routes

**Files:**
- Modify: `apps/broker/src/gateway-rpc/gateway-rpc-invoke.module.ts`
- Modify: `apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts`

Context: `GatewayRpcInvokeService` handles RabbitMQ RPC from the gateway by routing path-based calls. Add `VotingModule` and `VeLockModule` to `GatewayRpcInvokeModule`'s imports, then inject `VotingService`, `VotingClaimableService`, and `VeLockService` into `GatewayRpcInvokeService`. Add route handlers in `invokeHttpLike` under `a === 'voting'` and `a === 've-locks'`.

- [ ] **Step 1: Add VotingModule and VeLockModule to GatewayRpcInvokeModule**

Find the full content of `apps/broker/src/gateway-rpc/gateway-rpc-invoke.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { DynamicSwapFeeModule } from '../dynamic-fee/dynamic-swap-fee.module';
import { SpotCatalogModule } from '../spot-catalog/spot-catalog.module';
import { SwapLiquidityModule } from '../swap-liquidity/swap-liquidity.module';
import { BrokerSwapHopModule } from '../swap-hop/broker-swap-hop.module';
import { GatewayRpcInvokeService } from './gateway-rpc-invoke.service';

@Module({
  imports: [
    SpotCatalogModule,
    SwapLiquidityModule,
    DynamicSwapFeeModule,
    BrokerSwapHopModule,
  ],
  providers: [GatewayRpcInvokeService],
  exports: [GatewayRpcInvokeService],
})
export class GatewayRpcInvokeModule {}
```
Replace with:
```typescript
import { Module } from '@nestjs/common';
import { DynamicSwapFeeModule } from '../dynamic-fee/dynamic-swap-fee.module';
import { SpotCatalogModule } from '../spot-catalog/spot-catalog.module';
import { SwapLiquidityModule } from '../swap-liquidity/swap-liquidity.module';
import { BrokerSwapHopModule } from '../swap-hop/broker-swap-hop.module';
import { VeLockModule } from '../ve-lock/ve-lock.module';
import { VotingModule } from '../voting/voting.module';
import { GatewayRpcInvokeService } from './gateway-rpc-invoke.service';

@Module({
  imports: [
    SpotCatalogModule,
    SwapLiquidityModule,
    DynamicSwapFeeModule,
    BrokerSwapHopModule,
    VeLockModule,
    VotingModule,
  ],
  providers: [GatewayRpcInvokeService],
  exports: [GatewayRpcInvokeService],
})
export class GatewayRpcInvokeModule {}
```

- [ ] **Step 2: Add new service imports to gateway-rpc-invoke.service.ts**

Find the existing import block at the top. After the last service import (near `DynamicSwapFeeReadModelService`), add:
```typescript
import { VeLockService } from '../ve-lock/ve-lock.service';
import { VotingService } from '../voting/voting.service';
import { VotingClaimableService } from '../voting/voting-claimable.service';
```

- [ ] **Step 3: Add services to the constructor**

Find the constructor:
```typescript
  constructor(
    private readonly spotCatalog: SpotCatalogService,
    private readonly swapGraph: SwapLiquidityGraphService,
    private readonly swapRouteSpotPairQuote: SwapRouteSpotPairQuoteService,
    private readonly spotGroups: SpotGroupsService,
    private readonly indexerPersistence: IndexerEventPersistenceService,
    private readonly brokerSwapHopQuery: BrokerSwapHopQueryService,
    private readonly dynamicSwapFeeReadModel: DynamicSwapFeeReadModelService,
  ) {}
```
Replace with:
```typescript
  constructor(
    private readonly spotCatalog: SpotCatalogService,
    private readonly swapGraph: SwapLiquidityGraphService,
    private readonly swapRouteSpotPairQuote: SwapRouteSpotPairQuoteService,
    private readonly spotGroups: SpotGroupsService,
    private readonly indexerPersistence: IndexerEventPersistenceService,
    private readonly brokerSwapHopQuery: BrokerSwapHopQueryService,
    private readonly dynamicSwapFeeReadModel: DynamicSwapFeeReadModelService,
    private readonly veLock: VeLockService,
    private readonly voting: VotingService,
    private readonly votingClaimable: VotingClaimableService,
  ) {}
```

- [ ] **Step 4: Add /voting/* route handler block in invokeHttpLike**

Find the block:
```typescript
      this.logger.debug(`apiInvoke: no route for ${method} ${path}`);
      return {
        ok: false,
        statusCode: 501,
        error: `No RPC handler for ${method} ${path}`,
      };
```
Before that block, insert:

```typescript
      if (a === 'voting') {
        if (method === 'GET' && b === 'positions' && !c) {
          const owner = query.owner;
          if (!owner?.trim()) {
            return { ok: false, statusCode: 400, error: '`owner` query param required' };
          }
          return { ok: true, statusCode: 200, body: await this.voting.getPositionsByOwner(owner) };
        }
        if (method === 'GET' && b === 'events' && !c) {
          const owner = query.owner;
          if (!owner?.trim()) {
            return { ok: false, statusCode: 400, error: '`owner` query param required' };
          }
          return { ok: true, statusCode: 200, body: await this.voting.getVoteEventsByOwner(owner) };
        }
        if (method === 'GET' && b === 'claimable' && c) {
          return { ok: true, statusCode: 200, body: await this.votingClaimable.getClaimableByTokenId(c) };
        }
        if (method === 'GET' && b === 'claims' && !c) {
          const owner = query.owner;
          if (!owner?.trim()) {
            return { ok: false, statusCode: 400, error: '`owner` query param required' };
          }
          return { ok: true, statusCode: 200, body: await this.voting.getClaimsByOwner(owner) };
        }
        return { ok: false, statusCode: 404, error: `No route for ${method} ${path} under voting` };
      }

      if (a === 've-locks') {
        if (method === 'GET' && !b) {
          const owner = query.owner;
          if (!owner?.trim()) {
            return { ok: false, statusCode: 400, error: '`owner` query param required' };
          }
          return { ok: true, statusCode: 200, body: await this.veLock.getPositionsByOwner(owner) };
        }
        if (method === 'GET' && b === 'history' && !c) {
          const owner = query.owner;
          if (!owner?.trim()) {
            return { ok: false, statusCode: 400, error: '`owner` query param required' };
          }
          return { ok: true, statusCode: 200, body: await this.veLock.getEventsByOwner(owner) };
        }
        if (method === 'GET' && b && c === 'history') {
          return { ok: true, statusCode: 200, body: await this.veLock.getEventsByTokenId(b) };
        }
        if (method === 'GET' && b && !c) {
          const pos = await this.veLock.getPositionByTokenId(b);
          if (!pos) return { ok: false, statusCode: 404, error: 'tokenId not found' };
          return { ok: true, statusCode: 200, body: pos };
        }
        return { ok: false, statusCode: 404, error: `No route for ${method} ${path} under ve-locks` };
      }
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd apps/broker && pnpm tsc --noEmit 2>&1 | grep "error TS"
```
Expected: no output

- [ ] **Step 6: Commit**

```bash
git add apps/broker/src/gateway-rpc/gateway-rpc-invoke.module.ts \
        apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts
git commit -m "feat(broker): extend GatewayRpcInvokeService with /voting/* and /ve-locks/* RPC routes"
```

---

### Task 15: Add gateway parity controller routes

**Files:**
- Modify: `apps/gateway/src/api/broker-http-parity.controller.ts`

Context: The `BrokerHttpParityController` uses `this.proxy(method, path, query)` to send RabbitMQ RPC calls to broker. Add 4 voting routes and 4 ve-lock backfill routes, all under `/portfolio/:walletAddress/`. Place them after the existing `stake-positions` endpoint. Note: `vote-claimable/:tokenId` needs both `walletAddress` and `tokenId` path params; the tokenId is forwarded to broker as a path segment, not a query param.

- [ ] **Step 1: Add 8 new routes after the `stake-positions` endpoint**

Find:
```typescript
  @Get('portfolio/:walletAddress/stake-positions')
  @ApiOperation({ summary: 'Gauge staking positions for a wallet (from broker Deposit/Withdraw events)' })
  @ApiParam({ name: 'walletAddress' })
  async getWalletStakePositions(
    @Param('walletAddress') walletAddress: string,
  ): Promise<unknown> {
    if (!walletAddress?.trim()) {
      throw new BadRequestException('walletAddress is required');
    }
    return this.proxy('GET', `/accounts/${encodeURIComponent(walletAddress.trim())}/stake-positions`);
  }
```
After that block, add:

```typescript
  @Get('portfolio/:walletAddress/ve-locks')
  @ApiOperation({ summary: 'Active veNFT lock positions for a wallet' })
  @ApiParam({ name: 'walletAddress' })
  async getVeLocks(@Param('walletAddress') walletAddress: string): Promise<unknown> {
    if (!walletAddress?.trim()) throw new BadRequestException('walletAddress is required');
    return this.proxy('GET', '/ve-locks', { owner: walletAddress.trim() });
  }

  @Get('portfolio/:walletAddress/ve-locks/history')
  @ApiOperation({ summary: 'veNFT lock event history for a wallet' })
  @ApiParam({ name: 'walletAddress' })
  async getVeLocksHistory(@Param('walletAddress') walletAddress: string): Promise<unknown> {
    if (!walletAddress?.trim()) throw new BadRequestException('walletAddress is required');
    return this.proxy('GET', '/ve-locks/history', { owner: walletAddress.trim() });
  }

  @Get('portfolio/:walletAddress/ve-locks/:tokenId')
  @ApiOperation({ summary: 'Single veNFT lock position by tokenId' })
  @ApiParam({ name: 'walletAddress' })
  @ApiParam({ name: 'tokenId' })
  async getVeLockByTokenId(
    @Param('walletAddress') walletAddress: string,
    @Param('tokenId') tokenId: string,
  ): Promise<unknown> {
    if (!walletAddress?.trim()) throw new BadRequestException('walletAddress is required');
    if (!tokenId?.trim()) throw new BadRequestException('tokenId is required');
    return this.proxy('GET', `/ve-locks/${encodeURIComponent(tokenId.trim())}`);
  }

  @Get('portfolio/:walletAddress/ve-locks/:tokenId/history')
  @ApiOperation({ summary: 'Event history for a single veNFT tokenId' })
  @ApiParam({ name: 'walletAddress' })
  @ApiParam({ name: 'tokenId' })
  async getVeLockTokenHistory(
    @Param('walletAddress') walletAddress: string,
    @Param('tokenId') tokenId: string,
  ): Promise<unknown> {
    if (!walletAddress?.trim()) throw new BadRequestException('walletAddress is required');
    if (!tokenId?.trim()) throw new BadRequestException('tokenId is required');
    return this.proxy('GET', `/ve-locks/${encodeURIComponent(tokenId.trim())}/history`);
  }

  @Get('portfolio/:walletAddress/vote-positions')
  @ApiOperation({ summary: 'Active veNFT vote allocations for a wallet' })
  @ApiParam({ name: 'walletAddress' })
  async getVotePositions(@Param('walletAddress') walletAddress: string): Promise<unknown> {
    if (!walletAddress?.trim()) throw new BadRequestException('walletAddress is required');
    return this.proxy('GET', '/voting/positions', { owner: walletAddress.trim() });
  }

  @Get('portfolio/:walletAddress/vote-events')
  @ApiOperation({ summary: 'Voted/Abstained event history for a wallet' })
  @ApiParam({ name: 'walletAddress' })
  async getVoteEvents(@Param('walletAddress') walletAddress: string): Promise<unknown> {
    if (!walletAddress?.trim()) throw new BadRequestException('walletAddress is required');
    return this.proxy('GET', '/voting/events', { owner: walletAddress.trim() });
  }

  @Get('portfolio/:walletAddress/vote-claimable/:tokenId')
  @ApiOperation({ summary: 'Live on-chain fee and bribe claimable amounts for a veNFT tokenId' })
  @ApiParam({ name: 'walletAddress' })
  @ApiParam({ name: 'tokenId', description: 'veNFT tokenId as decimal integer string' })
  async getVoteClaimable(
    @Param('walletAddress') walletAddress: string,
    @Param('tokenId') tokenId: string,
  ): Promise<unknown> {
    if (!walletAddress?.trim()) throw new BadRequestException('walletAddress is required');
    if (!tokenId?.trim()) throw new BadRequestException('tokenId is required');
    return this.proxy('GET', `/voting/claimable/${encodeURIComponent(tokenId.trim())}`);
  }

  @Get('portfolio/:walletAddress/reward-claims')
  @ApiOperation({ summary: 'Fee and bribe reward claim history for a wallet' })
  @ApiParam({ name: 'walletAddress' })
  async getRewardClaims(@Param('walletAddress') walletAddress: string): Promise<unknown> {
    if (!walletAddress?.trim()) throw new BadRequestException('walletAddress is required');
    return this.proxy('GET', '/voting/claims', { owner: walletAddress.trim() });
  }
```

- [ ] **Step 2: Verify TypeScript (gateway)**

```bash
cd /path/to/Giwater-App && pnpm --filter @giwater/gateway build 2>&1 | tail -5
```
Or check directly:
```bash
cd apps/gateway && pnpm tsc --noEmit 2>&1 | grep "error TS"
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/gateway/src/api/broker-http-parity.controller.ts
git commit -m "feat(gateway): add vote-positions, vote-events, claimable, reward-claims and ve-lock parity routes"
```

---

### Task 16: Smoke test — build all packages

**Files:** None (verification only)

- [ ] **Step 1: Build @giwater/shared**

```bash
pnpm --filter @giwater/shared build
```
Expected: `⚡️ Build success`

- [ ] **Step 2: TypeScript check broker**

```bash
cd apps/broker && pnpm tsc --noEmit 2>&1 | grep "error TS"
```
Expected: no output

- [ ] **Step 3: TypeScript check amm-indexer (pre-existing errors are OK)**

```bash
cd apps/amm-indexer && pnpm tsc --noEmit 2>&1 | grep "error TS" | grep -v "clGaugeDeposit\|clGaugeWithdraw\|gaugeDeposit\|gaugeWithdraw\|voterWhitelistPair"
```
Expected: no output (only the 5 pre-existing unrelated errors remain)

- [ ] **Step 4: TypeScript check gateway**

```bash
cd apps/gateway && pnpm tsc --noEmit 2>&1 | grep "error TS"
```
Expected: no output

- [ ] **Step 5: Final commit if any stragglers**

```bash
git status
```
If clean: done. If uncommitted changes remain, commit them.
