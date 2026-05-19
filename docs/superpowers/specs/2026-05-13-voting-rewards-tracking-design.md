# Voting & Reward Tracking Implementation Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Index veNFT voting activity and fee/bribe reward claims, expose current vote positions, event history, live claimable amounts, and claim history per wallet — and also backfill the ve-lock gateway/RPC gap from the previous sprint.

**Architecture:** Five-package pipeline: amm-indexer indexes on-chain events and publishes typed RabbitMQ payloads; @giwater/shared carries wire and notify-input types; broker aggregates events into DB state and exposes REST routes + GatewayRpcInvokeService handlers; gateway adds BrokerHttpParityController routes that proxy to broker via RabbitMQ RPC.

**Tech Stack:** Ponder (amm-indexer), NestJS + TypeORM + PostgreSQL (broker), amqp-connection-manager (gateway↔broker RPC), viem multicall (live on-chain claimable reads)

---

## Contracts & Events

### Voter contract (already registered in ponder.config.ts)
- `Voted(address indexed voter, address indexed pool, uint256 indexed tokenId, uint256 weight, uint256 totalWeight, uint256 timestamp)`
- `Abstained(address indexed voter, address indexed pool, uint256 indexed tokenId, uint256 weight, uint256 totalWeight, uint256 timestamp)`

### FeesVotingReward (factory: `GaugeCreated.feeVotingReward`)
- `ClaimRewards(address indexed from, address indexed reward, uint256 amount)`

### BribeVotingReward (factory: `GaugeCreated.bribeVotingReward`)
- `ClaimRewards(address indexed from, address indexed reward, uint256 amount)`

---

## Package Changes

### 1. amm-indexer

**New Ponder tables** (`ponder.schema.ts`):
- `voterVotedEvent` — voter, pool, tokenId, weight, totalWeight, epochTimestamp + base log columns
- `voterAbstainedEvent` — same shape
- `feeVotingRewardClaimEvent` — from, reward (token), amount, rewardContract + base log columns
- `bribeVotingRewardClaimEvent` — same shape

**New factory contract registrations** (`ponder.config.ts`):
```ts
FeeVotingReward: {
  factory: { address: VOTER_ADDRESS, event: GaugeCreated, parameter: "feeVotingReward" }
}
BribeVotingReward: {
  factory: { address: VOTER_ADDRESS, event: GaugeCreated, parameter: "bribeVotingReward" }
}
```
Use `VotingRewardAbi` (or `RewardAbi`) from `@giwater/shared`. The only event needed is `ClaimRewards`.

**New handlers** (`src/handlers/`):
- `voterVoted.ts` — handles `Voter:Voted`
- `voterAbstained.ts` — handles `Voter:Abstained`
- `feeVotingRewardClaim.ts` — handles `FeeVotingReward:ClaimRewards`
- `bribeVotingRewardClaim.ts` — handles `BribeVotingReward:ClaimRewards`

Each handler inserts into its Ponder table then calls `notifyBroker()`.

**Register in** `src/index.ts`:
```ts
ponder.on("Voter:Voted", handleVoterVoted)
ponder.on("Voter:Abstained", handleVoterAbstained)
ponder.on("FeeVotingReward:ClaimRewards", handleFeeVotingRewardClaim)
ponder.on("BribeVotingReward:ClaimRewards", handleBribeVotingRewardClaim)
```

### 2. @giwater/shared (`packages/shared/src/contract-events/indexer-broker-queue-payload.ts`)

Four new wire payload interfaces (BrokerJsonBigInt — bigint fields as strings):
- `VoterVotedIndexerBrokerPayload` — type: "VoterVoted", voter, pool, tokenId, weight, totalWeight, epochTimestamp + block fields
- `VoterAbstainedIndexerBrokerPayload` — same shape, type: "VoterAbstained"
- `FeeVotingRewardClaimIndexerBrokerPayload` — type: "FeeVotingRewardClaim", from, reward, amount, rewardContract + block fields
- `BribeVotingRewardClaimIndexerBrokerPayload` — type: "BribeVotingRewardClaim", same shape

Four corresponding notify input interfaces (native bigint for tokenId, weight, totalWeight, amount, epochTimestamp).

Add all four types to the `IndexerBrokerOnchainQueuePayload`, `IndexerBrokerOnchainWirePayloadWithoutTs`, and `IndexerBrokerNotifyPayload` union types.

### 3. broker

#### SQL migration: `apps/broker/migrations/003_voting_tables.sql`

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

CREATE TABLE IF NOT EXISTS voter_vote_events (
  "id"              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  "tokenId"         TEXT    NOT NULL,
  "pool"            TEXT    NOT NULL,
  "owner"           TEXT    NOT NULL,
  "eventType"       TEXT    NOT NULL, -- 'voted' | 'abstained'
  "weight"          TEXT    NOT NULL DEFAULT '0',
  "totalWeight"     TEXT    NOT NULL DEFAULT '0',
  "epochTimestamp"  TEXT,
  "indexerEventId"  TEXT    NOT NULL UNIQUE,
  "blockNumber"     TEXT    NOT NULL,
  "blockTimestamp"  TEXT    NOT NULL,
  "transactionHash" TEXT    NOT NULL,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voter_reward_claims (
  "id"              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  "claimType"       TEXT    NOT NULL, -- 'fee' | 'bribe'
  "rewardContract"  TEXT    NOT NULL,
  "rewardToken"     TEXT    NOT NULL,
  "from"            TEXT    NOT NULL,
  "amount"          TEXT    NOT NULL DEFAULT '0',
  "pool"            TEXT,              -- resolved from GaugeCreated lookup (nullable if not found)
  "indexerEventId"  TEXT    NOT NULL UNIQUE,
  "blockNumber"     TEXT    NOT NULL,
  "blockTimestamp"  TEXT    NOT NULL,
  "transactionHash" TEXT    NOT NULL,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### TypeORM entities

- `apps/broker/src/models/voting/voter-vote-position.entity.ts` — maps `voter_vote_positions`
- `apps/broker/src/models/voting/voter-vote-event.entity.ts` — maps `voter_vote_events`
- `apps/broker/src/models/voting/voter-reward-claim.entity.ts` — maps `voter_reward_claims`

Register all three in `broker-db.module.ts`.

#### Aggregator (`apps/broker/src/aggregator/voting-events.ts`)

Four functions called from `aggregator/index.ts`:

- `aggregateVoterVoted(payload)`:
  - Upsert `voter_vote_positions` (tokenId, pool) → set owner, weight, totalWeight, epochTimestamp, isActive=true, updatedAt=NOW()
  - Insert into `voter_vote_events` with eventType='voted'

- `aggregateVoterAbstained(payload)`:
  - Update `voter_vote_positions` → set weight='0', isActive=false, updatedAt=NOW()
  - Insert into `voter_vote_events` with eventType='abstained'

- `aggregateFeeVotingRewardClaim(payload)`:
  - Resolve `pool` by querying `indexed_events` WHERE type='VoterGaugeCreated' AND payload->>'feeVotingReward' = rewardContract (case-insensitive)
  - Insert into `voter_reward_claims` with claimType='fee'

- `aggregateBribeVotingRewardClaim(payload)`:
  - Same pool resolution but matching `payload->>'bribeVotingReward'`
  - Insert into `voter_reward_claims` with claimType='bribe'

#### VotingModule (`apps/broker/src/voting/`)

Files:
- `voting.module.ts`
- `voting.service.ts`
- `voting-claimable.service.ts` (on-chain reads)
- `voting.controller.ts`

**`VotingService`** — DB queries:
- `getPositionsByOwner(owner)` → SELECT from voter_vote_positions WHERE owner = $1 AND isActive = true
- `getVoteEventsByOwner(owner)` → SELECT from voter_vote_events WHERE owner = $1 ORDER BY blockTimestamp DESC
- `getClaimsByOwner(owner)` → SELECT from voter_reward_claims WHERE "from" = $1 ORDER BY blockTimestamp DESC

**`VotingClaimableService`** — live on-chain reads (same viem multicall pattern as StakingViewService):
- `getClaimableByTokenId(tokenId)`:
  1. Query `voter_vote_positions` for active pools this tokenId is voting on
  2. For each pool, query `indexed_events` for `feeVotingReward` and `bribeVotingReward` addresses
  3. For each reward contract, call `rewardsListLength()` then `rewards(i)` to enumerate reward tokens. Note: `rewards(uint256)` is a public array getter on `Reward.sol` but is NOT in the `IReward` interface — use a minimal inline ABI `[{ type: 'function', name: 'rewards', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] }]` for this call.
  4. Multicall `earned(rewardToken, tokenId)` on each contract × token pair
  5. Return array of `{ pool, rewardContract, claimType, rewardToken, earned }`

**`VotingController`**:
```
GET /voting/positions?owner=       → VotingService.getPositionsByOwner
GET /voting/events?owner=          → VotingService.getVoteEventsByOwner
GET /voting/claimable/:tokenId     → VotingClaimableService.getClaimableByTokenId
GET /voting/claims?owner=          → VotingService.getClaimsByOwner
```

Wire `VotingModule` into `AppModule`.

#### GatewayRpcInvokeService extension

Add `VotingService` and `VotingClaimableService` to constructor injection. Add route handlers in `invokeHttpLike` under `a === 'voting'`:

```
GET /voting/positions?owner=       → votingService.getPositionsByOwner(owner)
GET /voting/events?owner=          → votingService.getVoteEventsByOwner(owner)
GET /voting/claimable/:tokenId     → votingClaimableService.getClaimableByTokenId(tokenId)
GET /voting/claims?owner=          → votingService.getClaimsByOwner(owner)
```

Also add ve-lock backfill under `a === 've-locks'`:
```
GET /ve-locks?owner=               → veLockService.getPositionsByOwner(owner)
GET /ve-locks/history?owner=       → veLockService.getEventsByOwner(owner)
GET /ve-locks/:tokenId             → veLockService.getPositionByTokenId(tokenId)
GET /ve-locks/:tokenId/history     → veLockService.getEventsByTokenId(tokenId)
```

Inject `VeLockService` into `GatewayRpcInvokeService`.

### 4. gateway (`BrokerHttpParityController`)

Add voting parity routes (under `/portfolio/:walletAddress/`):
```
GET /portfolio/:w/vote-positions        → proxy GET /voting/positions?owner=:w
GET /portfolio/:w/vote-events           → proxy GET /voting/events?owner=:w
GET /portfolio/:w/vote-claimable/:tokenId → proxy GET /voting/claimable/:tokenId
GET /portfolio/:w/reward-claims         → proxy GET /voting/claims?owner=:w
```

Add ve-lock backfill routes:
```
GET /portfolio/:w/ve-locks              → proxy GET /ve-locks?owner=:w
GET /portfolio/:w/ve-locks/history      → proxy GET /ve-locks/history?owner=:w
GET /portfolio/:w/ve-locks/:tokenId     → proxy GET /ve-locks/:tokenId
GET /portfolio/:w/ve-locks/:tokenId/history → proxy GET /ve-locks/:tokenId/history
```

---

## Data Flow

```
On-chain event
  → amm-indexer Ponder handler
  → Ponder onchainTable (indexed)
  → notifyBroker() → RabbitMQ indexer→broker queue
  → broker IndexerEventsModule → aggregator/index.ts switch case
  → aggregator function → DB upsert (voter_vote_positions / voter_reward_claims)
  → broker REST controller (direct HTTP)
  → GatewayRpcInvokeService (RabbitMQ RPC from gateway)
  → gateway BrokerHttpParityController (public REST)
```

For live claimable:
```
GET /portfolio/:w/vote-claimable/:tokenId
  → gateway proxy → broker RPC → VotingClaimableService
  → DB lookup (which pools tokenId is voting on)
  → DB lookup (feeVotingReward/bribeVotingReward addresses per pool)
  → viem multicall (rewardsListLength + rewards + earned per contract)
  → response
```

---

## Error Handling

- Invalid address inputs: `BadRequestException` (ADDR_RE validation, same as VeLockService)
- tokenId not found or no active positions: return empty array (not 404)
- RPC node unavailable for live claimable: `ServiceUnavailableException`
- Broker RPC timeout from gateway: `HttpException(502)`

---

## Testing

For each broker service method:
- Valid owner with positions → returns non-empty array
- Valid owner with no positions → returns empty array
- Invalid address → throws BadRequestException
- Valid tokenId with active votes → calls claimable service and returns earned amounts

For aggregator:
- VoterVoted → upserts position row, inserts event row
- VoterAbstained → sets isActive=false on position, inserts event row
- FeeVotingRewardClaim → inserts claim row with claimType='fee', resolves pool
- BribeVotingRewardClaim → inserts claim row with claimType='bribe', resolves pool

For gateway:
- Each parity route → calls proxy with correct broker path and query params
