# Rewards & gauges (on-chain map)

Solidity for Giwater lives in the sibling repo **Giwater-Contracts** (same parent folder as **Giwater-App**; from this file that is `../../../Giwater-Contracts`). This folder is **documentation only** — there are no Solidity sources here.

## Which contract manages what?

| What you care about | Primary contracts | Notes |
| ------------------- | ----------------- | ----- |
| **TER (or emissions token) to LP stakers** per pool | **`Gauge`** (volatile/stable pools) or **`CLGauge`** (concentrated liquidity NFT positions) | Stakers earn **`rewardToken`** (TER post-TGE) via `deposit` / `getReward`. **`Voter`** calls `notifyRewardAmount` on each gauge when distributing weekly emissions; **`Minter`** feeds **`Voter`**. |
| **Pool trading fees → ve voters** (fee voting rewards) | **`FeesVotingReward`** (one per gauge), fed by the **gauge** | **`Gauge._claimFees` / `CLGauge._claimFees`** pull fees from the pool and `notifyRewardAmount` on the gauge’s **`feesVotingReward`**. veNFT holders claim via **`Voter.claimFees`** → `FeesVotingReward.getReward`. |
| **Bribes / extra incentives → ve voters** | **`BribeVotingReward`** (one per gauge) | Anyone can fund with whitelisted tokens; same epoch/checkpoint model as fees rewards. |
| **Managed veNFT products** (rebases, managed programs) | **`FreeManagedReward`**, **`LockedManagedReward`**, **`VotingEscrow`** | Separate from per-pool gauges; see contracts repo README. |
| **Discovering pools for indexers / apps** | **`PoolRewardRegistry`** | Emits **`PoolRegistered`** when factories register a pool. **Not** a gauge and **not** LP or ve reward accounting — naming is historical; use it for **pool discovery**, not “gauge reward math.” |

**Pre-TGE:** LP staking and rewards are often tracked with **`PreTGEStaking`** per pool; governance gauges and on-chain TER emissions activate after TGE (see `CLAUDE.md` in Giwater-Contracts).

## Solidity layout (Giwater-Contracts)

- Gauge LP emissions & fee push: `contracts/gauges/Gauge.sol`, `contracts/gauges/CLGauge.sol`
- Weekly emission distribution: `contracts/Voter.sol` (e.g. `_distribute` → `IGauge.notifyRewardAmount`)
- ve fee/bribe contracts: `contracts/rewards/` — detailed file-by-file guide: [`../../../Giwater-Contracts/contracts/rewards/README.md`](../../../Giwater-Contracts/contracts/rewards/README.md)

## App repos

- **ABIs / addresses:** `packages/shared` (`constants/contracts.ts`, `abis/json/`)
- **Indexing:** `apps/amm-indexer` (e.g. `Voter` gauge creation, optional `PoolRewardRegistry` pool registration)
- **Read APIs:** `apps/broker` (staking / reward metrics built from indexed events + RPC where applicable)
