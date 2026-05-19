# Architecture

This document describes the architecture of this project for AI agents and developers.

**Related:** [Gateway vs `apps/api` route map & migration phases](GATEWAY-VS-API-MIGRATION.md) — broker parity on the gateway vs Nest indexer/portfolio APIs still on port 3044.

## Overview

GiwaTer is a full-stack DeFi monorepo for liquidity management, point mining, and governance voting:

- **Frontend**: Next.js 16 with React 19 (wagmi/viem for Web3)
- **Backend**: NestJS 11 with TypeORM + PostgreSQL + Redis
- **Shared**: TypeScript types and constants (`@giwater/shared`)
- **Blockchain**: Smart contract integration via ethers.js (indexer) and wagmi (frontend)

## Project Structure

```
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── app/                # App Router pages
│   │   ├── components/         # React components
│   │   ├── contracts/          # Smart contract ABIs (38 files)
│   │   ├── context/            # React context providers
│   │   ├── hooks/              # Custom hooks (38 files)
│   │   ├── lib/                # API clients, config, store
│   │   ├── messages/           # i18n (en, ko)
│   │   ├── public/             # Static assets
│   │   └── types/              # Frontend-specific types
│   └── api/                    # NestJS backend (port 3044)
│       └── src/
│           ├── common/         # Decorators, filters, interceptors, middleware
│           ├── config/         # App & DB configuration
│           ├── database/       # Entities (26) & migrations (21)
│           ├── health/         # Health check module
│           └── modules/        # Feature modules (21)
├── packages/
│   └── shared/                 # Shared types and constants
│       └── src/
│           ├── types/          # TypeScript interfaces
│           └── constants/      # API routes, constants
├── docs/
│   ├── overview/               # Architecture & Point System spec
│   ├── kanban/                 # Task management (TODO/DOING/DONE)
│   └── pages/                  # Page-specific documentation
└── scripts/
    └── dev.sh                  # Development startup script
```

## Data Flow

```
[Browser] <──HTTP──> [Next.js] <──HTTP──> [NestJS] <──TypeORM──> [PostgreSQL]
     │                      │                         │                          │
     │                      │                    [Redis Cache]                   │
     │                      │                         │                          │
     └── wagmi/viem ──> [Blockchain RPC]  <── ethers (indexer) ─────────────────┘
                                                      │
                            +──── @giwater/shared ────+
                                 (types, constants)
```

## Backend Modules (21)

### Core Infrastructure

| Module              | Purpose                                                                              |
| ------------------- | ------------------------------------------------------------------------------------ |
| `health`            | Health check endpoint (`/api/health`)                                                |
| `cache`             | Redis caching layer (ioredis)                                                        |
| `scheduler`         | Cron tasks: event sync, LP sync, stats update, point distribution, multiplier update |
| `upload`            | S3 file upload (token/banner images)                                                 |
| `banner`            | Banner management (CRUD, image upload, impressions, clicks)                          |
| `base-point-config` | Base point configuration scheduling and management                                   |

### Blockchain Indexing

| Module    | Purpose                                                                                  |
| --------- | ---------------------------------------------------------------------------------------- |
| `indexer` | Blockchain event sync, backfill, event processing, pool creation tracking, state rebuild |
| `webhook` | Nodit webhook receiver for real-time blockchain events                                   |
| `nodit`   | Nodit service integration                                                                |

### DeFi Features

| Module        | Purpose                                                      |
| ------------- | ------------------------------------------------------------ |
| `pool`        | Pool management and queries                                  |
| `token`       | Token metadata management                                    |
| `portfolio`   | User positions: LP, lock, vote, points, claims, transactions |
| `stats`       | Global statistics and price aggregation                      |
| `vote`        | Voting epoch and pool vote data                              |
| `tpoint-lock` | Offchain tPOINT lock/vote system (pre-TGE)                   |

### Point System

| Module       | Purpose                                                |
| ------------ | ------------------------------------------------------ |
| `point`      | Point calculation, mining rates, faucet, queries       |
| `score`      | LP score, trading score, multiplier, score aggregation |
| `season`     | Season lifecycle, events, eligibility, participation   |
| `referral`   | Referral link management and scoring                   |
| `anti-abuse` | Blacklist, flash loan detection, sybil detection       |

### Administration

| Module  | Purpose                                                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `admin` | Admin controllers: indexer, points, pools, seasons, tokens, cache, database, events, banners, referrals, base-point-config         |
| `api`   | Public REST API (v1 controllers: pools, tokens, stats, points, portfolio, referral, season, contracts, banners, vote, tpoint-lock) |

## Database Entities (26)

### Pool & Token

- `Pool` - Pool information (addresses, token pairs, whitelist, factory, type, tickSpacing)
- `PoolStats` - Pool statistics and metrics (TVL, volume, fees, dynamic fee fields)
- `Token` - Token metadata (name, symbol, decimals, icon URL, isPopular, isWhitelisted)

### Blockchain

- `SyncStatus` - Blockchain sync progress tracking
- `BlockchainEvent` - Raw blockchain event storage

### Point System

- `SeasonConfig` - Season configuration (dates, daily emission)
- `SeasonWeight` - Season weight rules per pool
- `SeasonParticipation` - User participation tracking per season
- `PointBalance` - User aggregated point balances
- `PointHistory` - Point transaction history
- `PointClaim` - Point claim records
- `DailyEmission` - Daily point emission records
- `DailyScore` - Daily user score snapshots
- `UserMultiplier` - User multiplier values
- `BasePointConfig` - Base point configuration scheduling

### Positions

- `LpPosition` - Liquidity provider positions
- `LockPosition` - Token lock positions (veNFT)
- `VotePosition` - Governance vote positions
- `TPointLockPosition` - Offchain tPOINT lock positions (pre-TGE)
- `TPointVotePosition` - Offchain tPOINT vote positions (pre-TGE)

### Referral & Rewards

- `ReferralLink` - Referral link tracking
- `ReferralReward` - Referral reward records
- `UserBadge` - User achievement badges
- `Blacklist` - Anti-abuse blacklist entries

### Content

- `Banner` - Banner management (page, images, scheduling, analytics)

## Frontend Pages

### Public Pages

| Route               | Description                                  |
| ------------------- | -------------------------------------------- |
| `/`                 | Home / Dashboard                             |
| `/swap`             | Token swapping (Universal Router / Permit2)  |
| `/liquidity`        | Liquidity pool management                    |
| `/deposit`          | Token deposit to pools                       |
| `/portfolio`        | User portfolio (positions, rewards, history) |
| `/pool/launch`      | New pool creation (V2 + CL)                  |
| `/vote`             | Governance voting overview                   |
| `/vote/lock`        | Token locking (veNFT)                        |
| `/vote/allocate`    | Vote power allocation                        |
| `/legal/disclaimer` | Legal disclaimer                             |

### Admin Pages (`/admin`)

| Route                | Description                                                    |
| -------------------- | -------------------------------------------------------------- |
| `/admin`             | Dashboard (stats, leaderboard, season overview)                |
| `/admin/pools`       | Pool management (list + detail view)                           |
| `/admin/tokens`      | Token management                                               |
| `/admin/points`      | Point distribution, leaderboard, mining rates                  |
| `/admin/seasons`     | Season config and weight editing                               |
| `/admin/base-points` | Base point config scheduling                                   |
| `/admin/banners`     | Banner management (list, create, edit)                         |
| `/admin/referrals`   | Referral system management (overview, KOL tiers)               |
| `/admin/indexer`     | Sync controls, backfill, state rebuild                         |
| `/admin/events`      | Blockchain event viewer                                        |
| `/admin/database`    | Database admin (table viewer, SQL query)                       |
| `/admin/cache`       | Redis cache management                                         |
| `/admin/badges`      | Badge management                                               |
| `/admin/blacklist`   | Blacklist management                                           |
| `/admin/contracts/*` | 9 contract admin pages (CL Factory, Voter, VotingEscrow, etc.) |

## Frontend Hooks (38)

### Pool Hooks

`usePools`, `usePoolInfo`, `usePoolReserves`, `usePoolTVL`, `usePoolFee`, `usePoolFees`, `usePoolType`, `usePoolFactory`, `useCLPoolFactory`, `useCLPoolSlot0`

### Token Hooks

`useTokenBalance`, `useTokenAllowance`, `useTokenApprove`, `useTokenLookup`, `useTokenSearch`, `useTokenMint`, `useTokenPrices`, `useLpBalance`

### DeFi Hooks

`useSwapQuote`, `useSwapPath`, `usePermit2`, `useQuoteAddLiquidity`, `useQuoteRemoveLiquidity`, `useGauge`, `useEmissionAPR`

### Voting Hooks

`useVote`, `useVotePools`, `useVoteEpoch`, `useVotingEscrow`, `useTPointVote`

### Lock Hooks

`useCreateLock`, `useTPointLocks`, `useCreateTPointLock`

### Points & Rewards Hooks

`useUserPoints`, `useClaimPoints`

### Content Hooks

`useBanner`

### Utility Hooks

`useContractAddresses`, `useIndexerStats`

## Key Patterns

### API Communication

- Frontend API clients in `lib/`: `adminApi`, `portfolioApi`, `priceApi`, `indexerApi`
- Utility libs: `config`, `store`, `wagmi`, `tickMath`, `getContractErrorMessage`, `i18n`
- Public REST endpoints under `/api/v1/*`
- Admin endpoints under `/api/admin/*`
- Shared types ensure type safety across the stack
- API routes defined in `@giwater/shared/constants`

### Validation

- Backend uses class-validator for request validation
- DTOs defined per module in `dto/` directories

### Smart Contract Integration

- Frontend: wagmi + viem for wallet connection and contract calls
- Backend: ethers.js for blockchain event indexing
- 38 ABI files in `packages/shared/src/abis/`
- Contract addresses managed via `useContractAddresses` hook and `ContractsService`

### State Management

- Frontend: Zustand (`lib/store.ts`) + React Query (wagmi)
- Backend: Redis for caching, PostgreSQL for persistence

### Internationalization

- next-intl with locale files in `messages/` (English, Korean)
- `LocaleContext` for client-side language switching

### Configuration

- Backend: `@nestjs/config` with Joi validation (`config.validation.ts`)
- Frontend: Next.js environment variables (`NEXT_PUBLIC_*`)
- TypeORM config in `config/typeorm.config.ts`

### Scheduled Tasks

| Task                 | Purpose                                   |
| -------------------- | ----------------------------------------- |
| `event-sync`         | Periodic blockchain event synchronization |
| `lp-position-sync`   | LP position state updates                 |
| `stats-update`       | Pool and global statistics refresh        |
| `point-distribution` | Daily point emission and distribution     |
| `multiplier-update`  | User multiplier recalculation             |

## Dev Ports

- Frontend (web): http://localhost:3007
- Backend (api): http://localhost:3044
