# Giwater

NEXT_PUBLIC_MOCK_DATA=true NEXT_PUBLIC_PRE_TGE=true corepack pnpm --filter @giwater/web dev

A ve(3,3) decentralized exchange featuring concentrated liquidity, voting escrow governance, and a points-based incentive system.

## Tech Stack

| Layer      | Stack                                                         |
| ---------- | ------------------------------------------------------------- |
| Frontend   | Next.js 16, React 19, Tailwind CSS 4, wagmi, viem, RainbowKit |
| Backend    | NestJS 11, TypeORM, PostgreSQL, Redis                         |
| Blockchain | ethers.js, Solidity (ve(3,3) contracts)                       |
| Infra      | Turborepo, pnpm, Docker                                       |

## Project Structure

```
apps/
  web/         Next.js frontend
  api/         NestJS backend + blockchain indexer
packages/
  shared/      Shared types, DTOs, constants (@giwater/shared)
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+
- PostgreSQL
- Redis

### Setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### Development

```bash
pnpm dev          # Run all apps
pnpm dev:web      # Frontend only (port 3007)
pnpm dev:api      # Backend only (port 3044)
```

### Build

```bash
pnpm build
```

### Database Migrations

```bash
cd apps/api
pnpm migration:run
```

## Features

- **Swap** -- Token swaps via AMM pools with configurable slippage
- **Liquidity** -- Provide liquidity to volatile and concentrated liquidity pools
- **Vote & Lock** -- Lock TER tokens into veNFTs, vote on gauge emissions
- **Points** -- Earn points through LP positions, trading, referrals, and multipliers
- **Portfolio** -- Track positions, rewards, and transaction history
- **Admin** -- Dashboard for managing pools, tokens, seasons, indexer, and blacklists

## License

UNLICENSED
