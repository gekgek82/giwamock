# API Reference

## Base URL

```
http://localhost:3044
```

> **Note:** No global `/api` prefix. All routes are at root level.

## Configuration

| Setting | Value |
|---|---|
| Swagger Docs | `/api-docs` |
| CORS | All origins (GET, POST, PUT, DELETE) |
| Rate Limiting | 100 requests / 60s window |
| Validation | Global pipe (`transform`, `whitelist`, `forbidNonWhitelisted`) |

---

## Health Check

### GET /health

Health check with database and Redis connectivity.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "db": { "status": "ok" },
  "redis": { "status": "ok" }
}
```

### GET /health/liveness

Liveness probe (K8s).

**Response:**
```json
{ "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z" }
```

### GET /health/readiness

Readiness probe with database check.

---

## Public API

### Contracts

#### GET /contracts

Get contract addresses and registered token list. Cached for 10 minutes (`Cache-Control: public, max-age=600`).

**Response** `ContractAddressesResponseDto`:
```json
{
  "chainId": 91342,
  "contracts": {
    "terToken": "0x...",
    "votingEscrow": "0x...",
    "voter": "0x...",
    "minter": "0x...",
    "rewardsDistributor": "0x...",
    "poolFactory": "0x...",
    "clPoolFactory": "0x...",
    "factoryRegistry": "0x...",
    "gaugeFactory": "0x...",
    "clGaugeFactory": "0x...",
    "votingRewardsFactory": "0x...",
    "terGovernor": "0x...",
    "epochGovernor": "0x...",
    "router": "0x...",
    "swapRouter": "0x...",
    "nftPositionManager": "0x...",
    "veArtProxy": "0x..."
  },
  "tokens": [
    {
      "address": "0x...",
      "symbol": "TKA",
      "name": "Token A",
      "decimals": 18,
      "iconUrl": "https://..."
    }
  ],
  "popularTokens": [
    {
      "address": "0x...",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "iconUrl": "https://..."
    }
  ],
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### Tokens

#### GET /tokens/search

Search tokens by symbol, name, or address (partial match). If query starts with `0x`, searches by address; otherwise searches by symbol and name.

| Query Param | Type | Description |
|---|---|---|
| `q` | `string` (optional) | Search query. Returns all tokens if empty. |

**Response** `TokenSearchResponseDto`:
```json
{
  "tokens": [
    {
      "address": "0x...",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "iconUrl": "https://..."
    }
  ],
  "total": 1
}
```

#### POST /tokens/register

Register a new ERC20 token by verifying it on-chain. If the address is already registered, returns the existing token. If the address is not a valid ERC20 contract, returns an error.

**Request Body** `RegisterTokenDto`:
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678"
}
```

> `address` must match `/^0x[a-fA-F0-9]{40}$/`.

**Response** `RegisterTokenResponseDto`:
```json
{
  "success": true,
  "token": {
    "address": "0x...",
    "symbol": "TKA",
    "name": "Token A",
    "decimals": 18,
    "iconUrl": null
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Address is not a valid ERC20 token"
}
```

#### GET /tokens/prices

Get all token prices.

**Response** `TokenPricesResponseDto`:
```json
{
  "tokens": [
    {
      "address": "0x...",
      "symbol": "TER",
      "priceUSD": "0.50",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### GET /tokens/:tokenAddress/price

Get single token price.

| Param | Type | Description |
|---|---|---|
| `tokenAddress` | `string` | Token contract address (0x...) |

**Response** `TokenPriceResponseDto`:
```json
{
  "address": "0x...",
  "symbol": "TER",
  "priceUSD": "0.50",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### Stats

#### GET /stats

Get global protocol statistics.

**Response** `GlobalStatsResponseDto`:
```json
{
  "totalTVL": "1234567.89",
  "totalVolume24h": "123456.78",
  "totalVolume7d": "987654.32",
  "totalFees24h": "1234.56",
  "totalFees7d": "8765.43",
  "poolCount": 42,
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### Pools

#### GET /pools/stats

Get all pools statistics with pagination and sorting.

| Query Param | Type | Default | Description |
|---|---|---|---|
| `limit` | `number` | `100` | Max results (1-500) |
| `offset` | `number` | `0` | Pagination offset |
| `sortBy` | `string` | `tvl` | Sort field (`tvl`, `volume24h`, `fees24h`, `apr`) |
| `sortOrder` | `string` | `desc` | Sort order (`asc`, `desc`) |

**Response** `PoolsStatsResponseDto`:
```json
{
  "pools": [
    {
      "poolAddress": "0x...",
      "token0Address": "0x...",
      "token1Address": "0x...",
      "token0Symbol": "TKA",
      "token1Symbol": "TKB",
      "token0Decimals": 18,
      "token1Decimals": 18,
      "token0Name": "Token A",
      "token1Name": "Token B",
      "isStable": false,
      "tvl": "100000.00",
      "reserve0": "50000000000000000000000",
      "reserve1": "50000000000000000000000",
      "volume24h": "10000.00",
      "volume7d": "70000.00",
      "fees24h": "30.00",
      "fees7d": "210.00",
      "feesTotal": "5000.00",
      "txCount24h": 150,
      "apr24h": "10.95",
      "apr7d": "10.50",
      "feeBps": 30,
      "feePercent": "0.30",
      "gaugeAddress": "0x...",
      "hasGauge": true,
      "isGaugeAlive": true,
      "emissionApr": "25.00",
      "annualEmissionUsd": "50000.00",
      "rewardRate": "1000000000000000000",
      "periodFinish": 1700000000,
      "grade": 3,
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": { "total": 42, "limit": 100, "offset": 0 }
}
```

#### GET /pools/:poolAddress/stats

Get single pool statistics.

| Param | Type | Description |
|---|---|---|
| `poolAddress` | `string` | Pool contract address (0x...) |

**Response** `PoolStatsResponseDto` (same shape as single pool item above).

---

### Vote

#### GET /vote/epoch/current

Get current voting epoch information.

**Response** `EpochInfoDto`:
```json
{
  "epochNumber": 10,
  "startsAt": "2024-03-04T00:00:00.000Z",
  "endsAt": "2024-03-11T00:00:00.000Z",
  "endsInSeconds": 345600,
  "totalVotingPower": "1000000.00",
  "totalFees": "5000.00",
  "totalIncentives": "0.00",
  "totalRewards": "5000.00"
}
```

> `totalIncentives` is currently always `0` (not yet indexed).

#### GET /vote/pools

Get pools available for voting with vote stats.

| Query Param | Type | Default | Description |
|---|---|---|---|
| `sortBy` | `string` | `voteWeight` | Sort field (`voteWeight`, `tvl`, `fees`, `apr`) |
| `search` | `string` | - | Search by token symbol |
| `limit` | `number` | `100` | Max results (1-500) |
| `offset` | `number` | `0` | Pagination offset |

**Response** `VotePoolsResponseDto`:
```json
{
  "pools": [
    {
      "poolAddress": "0x...",
      "token0": { "address": "0x...", "symbol": "TKA", "name": "Token A", "decimals": 18, "iconUrl": null },
      "token1": { "address": "0x...", "symbol": "TKB", "name": "Token B", "decimals": 18, "iconUrl": null },
      "isStable": false,
      "feePercent": "0.30",
      "tvl": "100000.00",
      "gaugeAddress": "0x...",
      "voteWeight": "50000.00",
      "voteShare": "5.00",
      "fees7d": "210.00",
      "incentives": "0.00",
      "totalRewards": "210.00",
      "vAPR": "15.50"
    }
  ],
  "pagination": { "total": 42, "limit": 100, "offset": 0 }
}
```

> Only pools with active gauges (`hasGauge=true`, `isGaugeAlive=true`) are returned. `incentives` is currently always `0` (not yet indexed).

---

### Season

#### GET /season/current

Get current active season.

**Response** `SeasonResponseDto`:
```json
{
  "id": 1,
  "seasonNumber": 1,
  "name": "Season 1",
  "phase": "MAIN",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-03-31T23:59:59.000Z",
  "dailyCap": "100000",
  "status": "ACTIVE",
  "weights": [
    { "sector": "LP", "weight": "0.4" },
    { "sector": "TRADE", "weight": "0.3" },
    { "sector": "REFERRAL", "weight": "0.2" },
    { "sector": "EMISSION", "weight": "0.1" }
  ],
  "daysRemaining": 45,
  "progressPercent": 50
}
```

#### GET /season/:id

Get season by ID.

| Param | Type | Description |
|---|---|---|
| `id` | `number` | Season ID |

#### GET /season

Get all seasons. Returns `SeasonResponseDto[]`.

#### POST /season/event

Trigger a season event (wallet connect, vote, etc.).

**Request Body** `ProcessSeasonEventDto`:
```json
{
  "userAddress": "0x...",
  "eventType": "WALLET_CONNECT"
}
```

**Response:**
```json
{
  "success": true,
  "reward": {
    "amount": "100",
    "sector": "PARTICIPATION",
    "participationType": "WALLET_CONNECT"
  }
}
```

#### GET /season/eligibility/:userAddress

Check eligibility for current season.

| Param | Type | Description |
|---|---|---|
| `userAddress` | `string` | User wallet address |

**Response** `SeasonEligibilityResponseDto`.

#### GET /season/participation/:userAddress

Get user participation history across all seasons.

| Param | Type | Description |
|---|---|---|
| `userAddress` | `string` | User wallet address |

**Response** `SeasonParticipationResponseDto[]`.

---

### Point

#### GET /point/balance/:address

Get user point balance.

| Param / Query | Type | Description |
|---|---|---|
| `address` | `string` | User wallet address |
| `seasonId` | `number` (optional) | Season ID (default: current) |

**Response** `PointBalanceDto`:
```json
{
  "address": "0x...",
  "seasonId": 1,
  "seasonName": "Season 1",
  "totalPoints": "12345.67",
  "breakdown": {
    "lp": "5000.00",
    "trading": "3000.00",
    "referral": "2000.00",
    "emission": "2345.67"
  },
  "rank": 42,
  "percentile": 95.5,
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### GET /point/history/:address

Get user point history.

| Param / Query | Type | Default | Description |
|---|---|---|---|
| `address` | `string` | - | User wallet address |
| `seasonId` | `number` | current | Season filter |
| `sector` | `string` | - | Sector filter (`LP`, `TRADE`, `REFERRAL`, `EMISSION`) |
| `limit` | `number` | `50` | Max results (1-500) |
| `offset` | `number` | `0` | Pagination offset |

**Response** `PointHistoryResponseDto`:
```json
{
  "items": [
    {
      "id": 1,
      "sector": "LP",
      "amount": "100.50",
      "sourceType": "POOL",
      "sourceId": "0x...",
      "status": "CONFIRMED",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": { "total": 150, "limit": 50, "offset": 0 }
}
```

#### GET /point/leaderboard

Get point leaderboard.

| Query Param | Type | Default | Description |
|---|---|---|---|
| `seasonId` | `number` | current | Season ID |
| `limit` | `number` | `100` | Max results (1-500) |
| `offset` | `number` | `0` | Pagination offset |

**Response** `LeaderboardResponseDto`:
```json
{
  "entries": [
    {
      "rank": 1,
      "address": "0x...",
      "totalPoints": "99999.99",
      "lpPoints": "50000.00",
      "tradingPoints": "30000.00",
      "referralPoints": "19999.99"
    }
  ],
  "season": { "id": 1, "name": "Season 1" },
  "pagination": { "total": 1000, "limit": 100, "offset": 0 }
}
```

#### GET /point/mining-rate/:poolAddress

Get pool mining rate.

| Param | Type | Description |
|---|---|---|
| `poolAddress` | `string` | Pool contract address |

**Response** `MiningRateResponseDto`:
```json
{
  "poolAddress": "0x...",
  "baseRate": "10.50",
  "maxRate": "21.00",
  "unit": "Pt per $1k/Day",
  "tvl": "500000.00",
  "seasonAllocation": "40000"
}
```

#### GET /point/mining-rate/:poolAddress/user/:address

Get user mining rate for a specific pool.

| Param | Type | Description |
|---|---|---|
| `poolAddress` | `string` | Pool contract address |
| `address` | `string` | User wallet address |

**Response** `UserMiningRateResponseDto` (extends `MiningRateResponseDto`):
```json
{
  "poolAddress": "0x...",
  "baseRate": "10.50",
  "maxRate": "21.00",
  "unit": "Pt per $1k/Day",
  "tvl": "500000.00",
  "seasonAllocation": "40000",
  "userAddress": "0x...",
  "currentRate": "15.75",
  "multiplier": "1.50",
  "daysToMax": 30,
  "liquidityUsd": "10000.00",
  "estimatedDaily": "157.50"
}
```

#### GET /point/mining-rates

Get mining rates for all pools. Returns `MiningRateResponseDto[]`.

#### POST /point/faucet/:address

Claim free daily points (1000 points, once per day).

| Param | Type | Description |
|---|---|---|
| `address` | `string` | User wallet address |

**Response:**
```json
{
  "success": true,
  "amount": "1000",
  "totalPoints": "5000.00"
}
```

> Returns 400 if already claimed today.

#### GET /point/faucet/:address/status

Check if user can claim free daily points.

| Param | Type | Description |
|---|---|---|
| `address` | `string` | User wallet address |

**Response:**
```json
{
  "canClaim": true,
  "nextClaimAt": "2024-01-16T00:00:00.000Z"
}
```

---

### Referral

#### GET /referral/code/:address

Get or create referral code for a user.

| Param | Type | Description |
|---|---|---|
| `address` | `string` | User wallet address |

**Response** `ReferralCodeDto`:
```json
{
  "code": "ABC123",
  "referrerAddress": "0x...",
  "referralLink": "https://app.giwater.io/?ref=ABC123",
  "totalReferees": 10,
  "totalPointsEarned": "5000.00"
}
```

#### POST /referral/link

Create a referral link (connect referee to referrer).

**Request Body** `CreateReferralLinkDto`:
```json
{
  "referralCode": "ABC123",
  "refereeAddress": "0x..."
}
```

**Response** `ReferralLinkResponseDto`:
```json
{
  "success": true,
  "referrerAddress": "0x...",
  "refereeAddress": "0x..."
}
```

#### GET /referral/stats/:address

Get referral statistics.

| Param | Type | Description |
|---|---|---|
| `address` | `string` | Referrer wallet address |

**Response** `ReferralStatsDto`:
```json
{
  "address": "0x...",
  "code": "ABC123",
  "totalReferees": 10,
  "activeReferees": 7,
  "totalPointsEarned": "5000.00",
  "capApplied": false,
  "capRatio": 1.0,
  "referees": [
    {
      "address": "0x...",
      "joinedAt": "2024-01-15T00:00:00.000Z",
      "isActive": true,
      "pointsContributed": "500.00"
    }
  ]
}
```

#### GET /referral/rewards/:address

Get referral reward history.

| Param / Query | Type | Default | Description |
|---|---|---|---|
| `address` | `string` | - | Referrer wallet address |
| `limit` | `number` | - | Max results |
| `offset` | `number` | - | Pagination offset |

**Response** `ReferralRewardHistoryDto[]`:
```json
[
  {
    "id": 1,
    "refereeAddress": "0x...",
    "rewardType": "REFERRAL",
    "basePoints": "100.00",
    "rewardRate": "0.10",
    "rewardPoints": "10.00",
    "capApplied": false,
    "date": "2024-01-15"
  }
]
```

#### GET /referral/referrer/:address

Get the referrer for a user.

| Param | Type | Description |
|---|---|---|
| `address` | `string` | Referee wallet address |

**Response:**
```json
{ "referrer": "0x..." }
```

Returns `null` if no referrer exists.

---

### Portfolio

#### POST /portfolio/notify-transaction

Notify backend about a transaction for immediate indexing.

**Request Body** `NotifyTransactionDto`:
```json
{ "txHash": "0x1234...abcd" }
```

> `txHash` must match `/^0x[a-fA-F0-9]{64}$/`.

**Response** `NotifyTransactionResponseDto`:
```json
{ "processed": 1, "skipped": 0, "errors": 0 }
```

#### GET /portfolio/:walletAddress/overview

Get portfolio overview.

| Param | Type | Description |
|---|---|---|
| `walletAddress` | `string` | User wallet address (0x...) |

**Response** `PortfolioOverviewDto`:
```json
{
  "assetsByPool": {
    "activePools": 3,
    "totalDepositUsd": "50000.00",
    "avgNetApr": "15.50"
  },
  "pendingRewards": {
    "totalUnclaimedUsd": "250.00",
    "fee": {
      "totalUsd": "150.00",
      "breakdown": [
        {
          "poolAddress": "0x...",
          "token0Amount": "10.5",
          "token0Symbol": "TKA",
          "token1Amount": "20.3",
          "token1Symbol": "TKB",
          "usdValue": "50.00"
        }
      ]
    },
    "terPoint": { "amount": "1000", "usdValue": null },
    "vote": { "amount": "50.0", "symbol": "TER" }
  },
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### GET /portfolio/:walletAddress/positions/liquidity

Get liquidity positions.

| Param / Query | Type | Default | Description |
|---|---|---|---|
| `walletAddress` | `string` | - | User wallet address |
| `limit` | `number` | `50` | Max results (1-100) |
| `offset` | `number` | `0` | Pagination offset |

**Response** `LiquidityPositionsResponseDto`:
```json
{
  "positions": [
    {
      "id": "pos_1",
      "poolAddress": "0x...",
      "token0": { "address": "0x...", "symbol": "TKA", "decimals": 18 },
      "token1": { "address": "0x...", "symbol": "TKB", "decimals": 18 },
      "strategy": "Basic",
      "volatility": "Volatile",
      "volatilityValue": 0,
      "priceRange": null,
      "feePercent": "0.30",
      "deposited": {
        "token0Amount": "1000.0",
        "token1Amount": "2000.0",
        "usdValue": "5000.00"
      },
      "poolInventory": {
        "token0Amount": "1000.0",
        "token1Amount": "2000.0",
        "token0Symbol": "TKA",
        "token1Symbol": "TKB"
      },
      "stake": { "status": "working", "apr": "25.00", "isStaked": true },
      "rewards": {
        "terPoint": "500.0",
        "swapFees": {
          "token0Amount": "1.5",
          "token1Amount": "3.0",
          "usdValue": "10.00"
        }
      },
      "lpTokenBalance": "1500.000000000000000000",
      "poolShare": "0.15",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T00:00:00.000Z"
    }
  ],
  "pagination": { "total": 3, "limit": 50, "offset": 0 }
}
```

#### GET /portfolio/:walletAddress/positions/locks

Get lock positions.

| Param / Query | Type | Default | Description |
|---|---|---|---|
| `walletAddress` | `string` | - | User wallet address |
| `limit` | `number` | `50` | Max results (1-100) |
| `offset` | `number` | `0` | Pagination offset |

**Response** `LockPositionsResponseDto`:
```json
{
  "positions": [
    {
      "id": "lock_1",
      "tokenId": "42",
      "lockedAmount": "10000.0",
      "lockedSymbol": "TER",
      "votingPower": "5000.0",
      "lockDuration": {
        "weeks": 52,
        "startDate": "2024-01-01T00:00:00.000Z",
        "endDate": "2024-12-31T23:59:59.000Z"
      },
      "isExpired": false,
      "canWithdraw": false,
      "rewards": { "claimable": "100.0", "claimed": "50.0" },
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "summary": {
    "totalLocked": "10000.0",
    "totalVotingPower": "5000.0",
    "totalLocks": 1
  },
  "pagination": { "total": 1, "limit": 50, "offset": 0 }
}
```

#### GET /portfolio/:walletAddress/positions/votes

Get vote positions.

| Param / Query | Type | Default | Description |
|---|---|---|---|
| `walletAddress` | `string` | - | User wallet address |
| `epoch` | `number` | current | Specific epoch number |
| `limit` | `number` | `50` | Max results (1-100) |
| `offset` | `number` | `0` | Pagination offset |

**Response** `VotePositionsResponseDto`:
```json
{
  "positions": [
    {
      "id": "vote_1",
      "lockTokenId": "42",
      "poolAddress": "0x...",
      "poolName": "WETH-cbBTC",
      "token0": { "address": "0x...", "symbol": "WETH", "decimals": 18 },
      "token1": { "address": "0x...", "symbol": "cbBTC", "decimals": 8 },
      "strategy": "Concentrated",
      "volatility": "Volatile",
      "volatilityValue": 200,
      "poolType": "CL",
      "tickSpacing": 200,
      "estimatedApr": "1.0328",
      "lockedAmount": "7.12345",
      "lockedSymbol": "TER",
      "votingPower": "2500.0",
      "percentage": "50.00",
      "epoch": 10,
      "estimatedRewards": {
        "swapFee": {
          "token0": { "symbol": "WETH", "amount": "0", "usdValue": "0" },
          "token1": { "symbol": "cbBTC", "amount": "0", "usdValue": "0" },
          "usdValue": "50.0000"
        },
        "incentive": {
          "tokens": [],
          "usdValue": "25.0000"
        },
        "totalUsd": "75.00"
      },
      "votedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "summary": {
    "totalVotingPower": "5000.0",
    "usedVotingPower": "5000.0",
    "availableVotingPower": "0",
    "currentEpoch": 10,
    "epochEndsAt": "2024-01-08T00:00:00.000Z"
  },
  "pagination": { "total": 2, "limit": 50, "offset": 0 }
}
```

**Note (Phase 1):** Token-level `swapFee.token0/token1.amount` and `incentive.tokens[]` arrays are populated as empty/zero during Phase 1. Phase 2 will wire per-pool claimable rewards (bribes + fees) to fill these fields so the Vote tab can render exact token amounts instead of USD-only values.

#### GET /portfolio/:walletAddress/positions/points

Get point positions (earnings history).

| Param / Query | Type | Default | Description |
|---|---|---|---|
| `walletAddress` | `string` | - | User wallet address |
| `category` | `string` | - | Filter: `EVENT`, `LIQUIDITY_STAKING`, `SWAP` (omit for All) |
| `limit` | `number` | `50` | Max results (1-100) |
| `offset` | `number` | `0` | Pagination offset |

`status` is computed per row:
- `PENDING` — earned within the current epoch (not yet settled)
- `READY_TO_CLAIM` — earned in a finalized epoch, not yet claimed
- `CLAIMED` — has a `point_claims` row with status `submitted` or `confirmed`

`category` is derived from sector + event_type:
- `LP` → `LIQUIDITY_STAKING`
- `TRADE` → `SWAP`
- `REFERRAL` / `EMISSION` / any row with `event_type IS NOT NULL` → `EVENT`

**Response** `PointPositionsResponseDto`:
```json
{
  "summary": {
    "totalPoints": "12345.67",
    "claimablePoints": "7345.67",
    "claimedPoints": "5000.00",
    "onChainBalance": "5000.00",
    "lockedPoints": "0",
    "availablePoints": "7345.67",
    "vePoints": "0",
    "lockCount": 7,
    "pendingCount": 4,
    "readyToClaimCount": 3
  },
  "earnings": [
    {
      "id": "1023",
      "type": "liquidity_stake",
      "category": "LIQUIDITY_STAKING",
      "typeLabel": "Liquidity staking",
      "eventType": null,
      "amount": "12.123455",
      "status": "READY_TO_CLAIM",
      "earnedAt": "2025-12-30T17:59:30.000Z",
      "claimedAt": null,
      "claimTxHash": null
    }
  ],
  "pagination": { "total": 7, "limit": 50, "offset": 0 }
}
```

#### POST /portfolio/:walletAddress/positions/points/:earningId/claim

Claim a single point earning row (per-row claim). Creates a `point_claims` row
linked via `point_history_id`, then mints tPOINT on-chain via the backend
minter wallet. Subsequent requests for the same earning return 409.

| Param | Type | Description |
|---|---|---|
| `walletAddress` | `string` | User wallet address |
| `earningId` | `number` | `point_history.id` to claim |

**Response** `ClaimPointEarningResponseDto`:
```json
{ "txHash": "0x..." }
```

**Errors**
| Status | Cause |
|---|---|
| `400` | Earning is still pending (same epoch as now) |
| `404` | Earning not found or not owned by wallet |
| `409` | Earning already claimed or claim in progress |
| `503` | TerPoint minting temporarily unavailable |

#### GET /portfolio/:walletAddress/transactions

Get transaction history.

| Param / Query | Type | Default | Description |
|---|---|---|---|
| `walletAddress` | `string` | - | User wallet address |
| `type` | `string` | - | Filter by type: `SWAP`, `ADD_LIQUIDITY`, `REMOVE_LIQUIDITY`, `CLAIM`, `RECEIVED_VOTE_POWER`, `LIQUIDITY_STAKE`, `LIQUIDITY_UNSTAKE`, `LOCK`, `UNLOCK` |
| `limit` | `number` | `50` | Max results (1-100) |
| `offset` | `number` | `0` | Pagination offset |

**Response** `TransactionsResponseDto`:
```json
{
  "transactions": [
    {
      "id": "tx_1",
      "txHash": "0x...",
      "type": "SWAP",
      "timestamp": "2024-01-15T12:00:00.000Z",
      "usdValue": "500.00",
      "tokens": [
        { "symbol": "TKA", "amount": "100.0", "direction": "out" },
        { "symbol": "TKB", "amount": "200.0", "direction": "in" }
      ],
      "poolAddress": "0x...",
      "poolName": "TKA/TKB",
      "status": "confirmed",
      "blockNumber": 1234567
    }
  ],
  "pagination": { "total": 100, "limit": 50, "offset": 0, "totalPages": 2 }
}
```

#### POST /portfolio/:walletAddress/claim

Prepare claim transaction.

| Param | Type | Description |
|---|---|---|
| `walletAddress` | `string` | User wallet address |

**Request Body** `ClaimRequestDto`:
```json
{
  "claimType": "all",
  "positions": ["pos_1", "pos_2"]
}
```

> `claimType`: `all`, `fees`, `points`, `vote`. `positions` is optional.

**Response** `ClaimResponseDto`:
```json
{
  "transactions": [
    {
      "to": "0x...",
      "data": "0x...",
      "value": "0",
      "description": "Claim swap fees from TKA/TKB pool"
    }
  ],
  "estimatedGas": "250000",
  "rewards": {
    "fees": {
      "totalUsd": "150.00",
      "tokens": [
        { "symbol": "TKA", "amount": "10.5" },
        { "symbol": "TKB", "amount": "20.3" }
      ]
    },
    "points": { "amount": "1000", "txHash": "0x..." }
  }
}
```

> **`claimType: points` / `claimType: all`** — The points branch is a
> per-earning claim aggregator: it selects every unclaimed, settled
> `point_history` row for the wallet, writes one `PointClaim(pointHistoryId)`
> PENDING per row, performs a single on-chain `mint()` for the summed
> amount, then marks all rows CONFIRMED with a shared `tx_hash`. Returns
> `{ amount, txHash }` for display; per-row claim ids are not surfaced in
> this response (use the position/earning endpoints for per-row claims).

### Ops: rebuild `position_point_balances.claimed_lp_points` cache

The `claimed_lp_points` column on `position_point_balances` is a
write-through cache maintained exclusively by `ClaimService`. If it ever
drifts (e.g. due to a partial failure or a manual data edit), rebuild from
the authoritative `point_history ⊕ point_claims` join:

```sql
UPDATE position_point_balances ppb
SET claimed_lp_points = COALESCE(sub.claimed, '0')
FROM (
  SELECT ph.user_address, ph.pool_address, ph.token_id, ph.season_id,
         SUM(pc.amount::numeric)::text AS claimed
  FROM point_history ph
  JOIN point_claims pc
    ON pc.point_history_id = ph.id
   AND pc.status IN ('pending','submitted','confirmed')
  WHERE ph.sector = 'LP'
  GROUP BY ph.user_address, ph.pool_address, ph.token_id, ph.season_id
) sub
WHERE ppb.user_address = sub.user_address
  AND ppb.pool_address = sub.pool_address
  AND ppb.token_id = sub.token_id
  AND ppb.season_id = sub.season_id;
```

Run with the API paused or accept that concurrent claims in-flight will be
clobbered (pre-TGE: acceptable).

---

## Webhook

### POST /webhook/nodit

Receive Nodit blockchain events. Authenticated via HMAC-SHA256 signature (`x-nodit-signature` header).

**Request Body** `NoditWebhookPayloadDto`:
```json
{
  "eventType": "LOG",
  "network": "giwa-sepolia",
  "webhookId": "wh_123",
  "timestamp": 1700000000,
  "data": {
    "address": "0x...",
    "topics": ["0x..."],
    "data": "0x...",
    "blockNumber": "0x12d687",
    "transactionHash": "0x...",
    "logIndex": "0x0",
    "blockHash": "0x...",
    "removed": false
  }
}
```

**Response:**
```json
{ "success": true }
```

---

## Admin API

All admin endpoints are prefixed with `/admin/`.

### Cache

#### GET /admin/cache/keys

List all cache keys.

| Query Param | Type | Description |
|---|---|---|
| `pattern` | `string` (optional) | Filter pattern (e.g. `stats:*`, `price:*`) |

**Response** `CacheKeysResponseDto`:
```json
{ "keys": ["stats:global", "price:0x..."], "count": 2 }
```

#### GET /admin/cache/keys/:key

Get cache key value and metadata.

**Response** `CacheKeyInfoDto`:
```json
{
  "key": "stats:global",
  "value": "{...}",
  "ttl": 300,
  "type": "string"
}
```

#### DELETE /admin/cache/keys/:key

Delete a specific cache key.

**Response** `CacheDeleteResponseDto`:
```json
{ "deletedCount": 1 }
```

#### DELETE /admin/cache/keys

Delete cache keys by pattern.

| Query Param | Type | Description |
|---|---|---|
| `pattern` | `string` (optional) | Pattern to match keys for deletion |

**Response** `CacheDeleteResponseDto`:
```json
{ "deletedCount": 5 }
```

---

### Pool Admin

#### GET /admin/pool

Get all pools.

**Response** `PoolListResponse` (`AdminPoolInfo[]`): mirrors `spot_pairs` plus admin meta (`grade`, `isVotingEnabled`, …). Each pool includes **both** on-chain slot fields (`token0*`, `token1*`) and canonical **BASE/QUOTE** fields (`baseAddress`, `quoteSymbol`, …).

```json
{
  "pools": [
    {
      "address": "0x...",
      "token0Address": "0x...",
      "token1Address": "0x...",
      "token0Symbol": "USDC",
      "token1Symbol": "ETH",
      "token0Decimals": 6,
      "token1Decimals": 18,
      "token0Name": "USD Coin",
      "token1Name": "Ethereum",
      "baseAddress": "0x...",
      "quoteAddress": "0x...",
      "baseSymbol": "ETH",
      "quoteSymbol": "USDC",
      "baseName": "Ethereum",
      "quoteName": "USD Coin",
      "bDecimal": 18,
      "qDecimal": 6,
      "spotPairSymbol": "Ethereum/USD Coin",
      "spotPairType": "volatile",
      "listed": true,
      "exchange": "giwater",
      "feeSource": "",
      "dynamicFee": false,
      "listingDate": 1714060800,
      "poolType": "Basic",
      "isStable": false,
      "feeRate": 30,
      "tickSpacing": null,
      "isVotingEnabled": false,
      "grade": 3,
      "isGradeManualOverride": false,
      "factoryAddress": null,
      "createdAt": "2024-05-01T00:00:00.000Z",
      "updatedAt": "2024-05-15T00:00:00.000Z"
    }
  ],
  "total": 10
}
```

#### GET /admin/pool/:address

Get pool by address.

**Response** `PoolResponseDto` (same shape as single pool item above).

#### POST /spot-pairs/by-address/:address/listing

Set whether the pool appears in public listings (`spot_pairs.listed`). Documented on the broker Swagger UI (`/api/docs`) as the catalog list/unlist action.

**Request Body**:
```json
{ "listed": true }
```

**Response** `SpotPairRecordDto` (broker spot pair row).

> **Admin web note:** Next.js proxies `GET/PUT /api/admin/pool/*` to `{ADMIN_API_URL}/admin/pool/*`, but `spot-pairs/*` is mounted at the **broker root**, so `/api/admin/spot-pairs/...` is forwarded to `{ADMIN_API_URL}/spot-pairs/...`.

#### PUT /admin/pool/:address/listed (optional)

Same intent as `POST /spot-pairs/by-address/:address/listing` when implemented on a given broker build; prefer the `spot-pairs` route for parity with published Swagger.

#### POST /admin/pool/backfill-tick-spacing

Backfill tickSpacing for CL pools where it is null.

**Response:**
```json
{ "updated": 5, "failed": [] }
```

#### PUT /admin/pool/:address/whitelist

Update pool whitelist status.

**Request Body** `UpdatePoolWhitelistDto`:
```json
{ "isWhitelisted": true }
```

**Response** `PoolResponseDto`.

#### PUT /admin/pool/:address/grade

Update pool grade (manual override). Pools with manual override are excluded from auto-promotion.

**Request Body** `UpdatePoolGradeDto`:
```json
{ "grade": 1, "isManualOverride": true }
```

| grade | Level | Voting | Badge |
|-------|-------|--------|-------|
| 1 | Verified | Enabled | Green check |
| 2 | Rising | Disabled | Black check |
| 3 | Unknown | Disabled | None |

**Response** `PoolResponseDto`.

---

### Lock Admin

Served by broker `AdminLockController` and proxied through gateway at `/api/admin/lock/*`.

#### GET /admin/lock/stats

Lock position statistics. Optionally filtered by pool address.

**Query params:** `pool` (optional, pool address)

**Response** `AdminLockStatsDto`:
```json
{
  "pool": null,
  "totalLockedAmount": "1000000000000000000000",
  "activeLockCount": 42,
  "avgRemainingDays": 180,
  "pairStats": [
    {
      "pool": "0xabc...",
      "label": "ETH/USDC",
      "totalLockedAmount": "500000000000000000000"
    }
  ]
}
```

#### GET /admin/lock/events

Recent `ve_lock_events`. Optionally filtered by pool address.

**Query params:** `pool` (optional), `limit` (default 20), `offset` (default 0)

**Response** `AdminLockEventsDto`:
```json
{
  "events": [
    {
      "id": "uuid",
      "tokenId": "1",
      "owner": "0xabc...",
      "eventType": "Deposit",
      "depositType": "CREATE_LOCK",
      "value": "1000000000000000000",
      "lockEnd": "1735689600",
      "transactionHash": "0xdef...",
      "blockTimestamp": "1714060800"
    }
  ],
  "total": 100
}
```

#### GET /admin/lock/by-epoch

Total locked amount per epoch (bar chart data).

**Query params:** `pool` (optional), `epochs` (default 8)

**Response** `AdminLockByEpochDto`:
```json
{
  "epochs": [
    { "epochNumber": 1, "epochTimestamp": "1714060800", "totalLockedAmount": "5000000000000000000000" }
  ]
}
```

---

### Vote Admin

Served by broker `AdminVoteController` and proxied through gateway at `/api/admin/vote/*`.

#### GET /admin/vote/stats

Vote weight statistics. Optionally filtered by pool address.

**Query params:** `pool` (optional, pool address)

**Response** `AdminVoteStatsDto`:
```json
{
  "pool": null,
  "voteWeightBps": 10000,
  "uniqueVoterCount": 35,
  "currentEpoch": 5,
  "pairStats": [
    {
      "pool": "0xabc...",
      "label": "ETH/USDC",
      "voteWeightBps": 4500,
      "voterCount": 20
    }
  ]
}
```

#### GET /admin/vote/events

Recent `voter_vote_events`. Optionally filtered by pool address.

**Query params:** `pool` (optional), `limit` (default 20), `offset` (default 0)

**Response** `AdminVoteEventsDto`:
```json
{
  "events": [
    {
      "id": "uuid",
      "tokenId": "1",
      "pool": "0xabc...",
      "owner": "0xdef...",
      "eventType": "Voted",
      "weight": "1000000000000000000",
      "totalWeight": "10000000000000000000",
      "epochTimestamp": "1714060800",
      "transactionHash": "0x123...",
      "blockTimestamp": "1714060800"
    }
  ],
  "total": 80
}
```

#### GET /admin/vote/distribution

Vote weight distribution across pools for a given epoch (pie chart data).

**Query params:** `epoch` (optional, defaults to current epoch)

**Response** `AdminVoteDistributionDto`:
```json
{
  "epoch": 5,
  "buckets": [
    {
      "pool": "0xabc...",
      "label": "ETH/USDC",
      "totalWeight": "4500000000000000000000",
      "weightBps": 4500
    }
  ]
}
```

#### GET /admin/vote/by-epoch

Total vote weight per epoch (bar chart data).

**Query params:** `pool` (optional), `epochs` (default 8)

**Response** `AdminVoteByEpochDto`:
```json
{
  "epochs": [
    { "epochNumber": 1, "epochTimestamp": "1714060800", "totalWeight": "10000000000000000000000" }
  ]
}
```

---

### Season Admin

#### POST /admin/season

Create a new season.

**Request Body** `CreateSeasonDto`:
```json
{
  "seasonNumber": 2,
  "name": "Season 2",
  "phase": "MAIN",
  "startDate": "2024-04-01T00:00:00.000Z",
  "endDate": "2024-06-30T23:59:59.000Z",
  "dailyCap": "100000",
  "weights": [
    { "sector": "LP", "weight": 0.4 },
    { "sector": "TRADE", "weight": 0.3 },
    { "sector": "REFERRAL", "weight": 0.2 },
    { "sector": "EMISSION", "weight": 0.1 }
  ]
}
```

**Response** `SeasonResponseDto`.

#### PUT /admin/season/:id/weights

Update season weights.

**Request Body** `UpdateSeasonWeightsDto`:
```json
{
  "weights": [
    { "sector": "LP", "weight": 0.5 },
    { "sector": "TRADE", "weight": 0.2 },
    { "sector": "REFERRAL", "weight": 0.2 },
    { "sector": "EMISSION", "weight": 0.1 }
  ]
}
```

**Response** `SeasonResponseDto`.

#### PUT /admin/season/:id/status

Update season status.

**Request Body** `UpdateSeasonStatusDto`:
```json
{ "status": "ACTIVE" }
```

**Response** `SeasonResponseDto`.

#### PUT /admin/season/:id/activate

Activate a season (deactivates current active season).

| Param | Type | Description |
|---|---|---|
| `id` | `number` | Season ID |

**Response** `SeasonResponseDto`.

#### GET /admin/season/:id/participations

Get season participations (paginated).

| Param / Query | Type | Default | Description |
|---|---|---|---|
| `id` | `number` | - | Season ID |
| `limit` | `number` | `50` | Max results |
| `offset` | `number` | `0` | Pagination offset |

#### POST /admin/season/:id/award-badges

Award season legacy badges based on point rankings (GENESIS_DIAMOND, PLATINUM, GOLD, SILVER, BRONZE).

| Param | Type | Description |
|---|---|---|
| `id` | `number` | Season ID |

---

### Token Admin

#### GET /admin/token

Get all tokens.

**Response** `TokenListResponseDto`:
```json
{
  "tokens": [
    {
      "address": "0x...",
      "symbol": "TER",
      "name": "Ter Token",
      "decimals": 18,
      "priceUsd": "0.50",
      "iconUrl": "https://...",
      "isPopular": false,
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 5
}
```

#### GET /admin/token/:address

Get token by address.

**Response** `TokenResponseDto` (same shape as single token item above).

#### POST /admin/token

Create a new token.

**Request Body** `CreateTokenDto`:
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "symbol": "TKA",
  "name": "Token A",
  "decimals": 18,
  "priceUsd": "1.00"
}
```

**Response** `TokenResponseDto`.

#### PUT /admin/token/:address

Update a token.

**Request Body** `UpdateTokenDto`:
```json
{
  "symbol": "TKA",
  "name": "Token A Updated",
  "decimals": 18,
  "priceUsd": "1.50",
  "isPopular": true
}
```

All fields are optional.

**Response** `TokenResponseDto`.

#### DELETE /admin/token/:address

Delete a token.

**Response:**
```json
{ "message": "Token deleted successfully" }
```

#### POST /admin/token/:address/icon

Upload token icon. Multipart file upload (png/jpg/svg/webp, max 1MB).

**Response** `TokenResponseDto`.

#### DELETE /admin/token/:address/icon

Delete token icon.

**Response** `TokenResponseDto`.

---

### Point Admin

#### POST /admin/point/distribution/trigger

Manually trigger point distribution.

**Request Body** (optional):
```json
{ "date": "2024-01-15" }
```

**Response** `DistributionSummary`.

#### GET /admin/dashboard/stats

Get dashboard aggregate statistics.

| Query Param | Type | Description |
|---|---|---|
| `seasonId` | `number` (optional) | Season ID (default: current) |

**Response** `DashboardStatsDto`:
```json
{
  "totalDistributed": "1234567.89",
  "activeBadges": 5,
  "totalUsers": 1200,
  "calculatedAt": "2024-01-15T12:00:00.000Z"
}
```

---

### Indexer Admin

#### GET /admin/indexer/sync/status

Get event sync status.

**Response** `SyncStatusResponseDto`:
```json
{
  "lastBlock": 1234560,
  "currentBlock": 1234567,
  "isSynced": false,
  "blocksRemaining": 7
}
```

#### GET /admin/indexer/backfill/status

Get backfill queue status.

**Response** `BackfillStatusResponseDto`.

#### GET /admin/indexer/rebuild/status

Check if rebuild is in progress.

**Response:**
```json
{ "isRunning": false }
```

#### POST /admin/indexer/rebuild/lp-positions

Rebuild LP positions from events.

| Query Param | Type | Description |
|---|---|---|
| `batchSize` | `number` (optional) | Batch size for processing |

**Response** `RebuildResponseDto`.

#### POST /admin/indexer/rebuild/lock-positions

Rebuild lock positions from VE events.

| Query Param | Type | Description |
|---|---|---|
| `batchSize` | `number` (optional) | Batch size for processing |

**Response** `RebuildResponseDto`.

#### POST /admin/indexer/rebuild/vote-positions

Rebuild vote positions from Voter events.

| Query Param | Type | Description |
|---|---|---|
| `batchSize` | `number` (optional) | Batch size for processing |

**Response** `RebuildResponseDto`.

#### POST /admin/indexer/rebuild/all

Rebuild all state tables.

**Response** `RebuildAllResponseDto`.

#### POST /admin/indexer/sync/trigger

Manually trigger event sync.

**Response:**
```json
{ "success": true, "message": "Sync triggered" }
```

#### POST /admin/indexer/sync/reset

Reset sync to a specific block.

| Query Param | Type | Description |
|---|---|---|
| `fromBlock` | `number` (required) | Block number to reset to |

**Response:**
```json
{ "success": true, "message": "Sync reset to block 1234000" }
```

---

## tPOINT Lock API (Pre-TGE)

Offchain tPOINT lock and vote management. Active only during Pre-TGE phase.
All mutating endpoints require wallet signature for authentication.

### Lock Endpoints

#### `POST /tpoint-lock/lock`
Create a tPOINT lock position.

**Request Body:**
```json
{
  "walletAddress": "0x...",
  "amount": "1000000000000000000",
  "durationDays": 365,
  "signature": "0x...",
  "message": "Lock 1.0 tPOINT for 365 days"
}
```

#### `GET /tpoint-lock/locks/:walletAddress`
Get all active tPOINT lock positions for a wallet.

#### `GET /tpoint-lock/lock/:id`
Get a single tPOINT lock position by ID.

#### `DELETE /tpoint-lock/lock/:id`
Unlock an expired tPOINT lock position.

**Request Body:**
```json
{
  "walletAddress": "0x...",
  "signature": "0x...",
  "message": "..."
}
```

#### `GET /tpoint-lock/voting-power/:walletAddress`
Get total tPOINT voting power for a wallet.

#### `POST /tpoint-lock/merge`
Merge multiple tPOINT locks into a single base lock. The base lock keeps its
identity and absorbs the source locks; the source locks are deactivated. The
final lock period is the longest `lockEnd` across the base + source locks, and
the amount is the sum of all selected locks. Voting power is recalculated
against the new remaining duration. Any current-epoch votes attached to source
locks are deleted (the user must re-allocate from the base lock).

**Request Body:**
```json
{
  "walletAddress": "0x...",
  "baseLockId": 5,
  "sourceLockIds": [1, 2, 3],
  "signature": "0x...",
  "message": "Merge tPOINT locks base:5 sources:1,2,3"
}
```

The signed `message` must include both `base:{baseLockId}` and
`sources:{id1,id2,...}` (source ids ascending) to prevent signature reuse.

#### `POST /tpoint-lock/lock/:id/extend`
Extend the duration of an active tPOINT lock. The caller supplies the new total
lock duration in days from now (`newDurationDays`), which must strictly exceed
the current remaining duration and must not exceed 1456 days (4 years). The
lock's `lockEnd` is moved to `now + newDurationDays`, its `lockDays` is
recomputed from `lockStart`, and voting power is recalculated against the
refreshed remaining duration. Any current-epoch votes attached to this lock are
re-snapshot with the boosted voting power so vote weights stay aligned
immediately.

**Request Body:**
```json
{
  "walletAddress": "0x...",
  "newDurationDays": 1456,
  "autoMax": true,
  "signature": "0x...",
  "message": "Extend tPOINT lock lockId:1 newDurationDays:1456 autoMax:true"
}
```

`autoMax` records whether the user wants the lock pinned to `MAX_LOCK_DAYS` via
automatic renewal; it is persisted on the lock so UI affordances such as the
"Disable Auto-Max" badge render only when it is `true`. The signed `message`
must include `lockId:{id}`, `newDurationDays:{newDurationDays}`, and
`autoMax:{true|false}` to prevent signature reuse across locks, durations, or
renewal modes.

#### `POST /tpoint-lock/lock/:id/disable-auto-max`
Disable Auto-Max on an active tPOINT lock. The stored `lockEnd` is preserved
(no further renewal occurs), the `auto_max` flag is set to `false`, voting
power is recomputed against the current remaining duration, and any
current-epoch votes cast by this lock are re-snapshot with the refreshed power.
The lock is rejected if Auto-Max is already off, the lock is inactive, or the
lock has expired.

**Request Body:**
```json
{
  "walletAddress": "0x...",
  "signature": "0x...",
  "message": "Disable Auto-Max tPOINT lock lockId:1 action:disableAutoMax"
}
```

The signed `message` must include both `lockId:{id}` and the literal tag
`action:disableAutoMax` to prevent reuse across locks or actions.

#### `POST /tpoint-lock/lock/:id/poke`
Recompute this lock's voting power against the remaining duration (now until
`lockEnd`), then re-snapshot any votes this lock cast in the current epoch
using the refreshed power. This mirrors the on-chain `Voter.poke(tokenId)`
semantics for the pre-TGE offchain ledger: as time passes, the stored
`voting_power` on a lock becomes stale relative to its decayed value, and any
current-epoch votes cast earlier are still sized against that stale snapshot.
Poke re-aligns both in a single transaction.

**Request Body:**
```json
{
  "walletAddress": "0x...",
  "signature": "0x...",
  "message": "Poke tPOINT lock lockId:1 action:poke at 1713456789"
}
```

The signed `message` must include both `lockId:{id}` and the literal tag
`action:poke` to prevent reuse across locks or actions.

**Response:**
```json
{
  "lock": { /* TPointLockPosition */ },
  "previousVotingPower": "98.76543",
  "newVotingPower": "95.43210",
  "affectedVotes": 2,
  "currentEpoch": 2876
}
```

### Vote Endpoints

#### `POST /tpoint-lock/vote`
Vote with tPOINT lock.

**Request Body:**
```json
{
  "walletAddress": "0x...",
  "lockId": 1,
  "poolAddress": "0x...",
  "percentage": 50,
  "signature": "0x...",
  "message": "Vote lock #1 for pool 0x... at 50%"
}
```

#### `GET /tpoint-lock/votes/:walletAddress`
Get tPOINT votes for a wallet. Optional query: `epoch`.

#### `POST /tpoint-lock/vote/reset`
Reset tPOINT votes for a lock in the current epoch.

**Request Body:**
```json
{
  "walletAddress": "0x...",
  "lockId": 1,
  "signature": "0x...",
  "message": "Reset votes for lock #1"
}
```

---

## Public Banner API

### GET /banners/:page

Get active banners for a page. Page values: `SWAP`, `LIQUIDITY`, `LOCK`, `VOTE`.

**Response:**
```json
[
  {
    "id": 1,
    "imagePcUrl": "https://...",
    "imageMobileUrl": "https://...",
    "linkUrl": "https://example.com",
    "clickTarget": "NEW_TAB"
  }
]
```

### POST /banners/:id/impression

Record a banner impression. Fire-and-forget.

### POST /banners/:id/click

Record a banner click. Fire-and-forget.

---

## Admin Banner API

### GET /admin/banner

List all banners. Optional query param `?page=SWAP|LIQUIDITY|LOCK|VOTE`.

### GET /admin/banner/:id

Get a single banner with statistics.

### POST /admin/banner

Create a new banner. Max 5 non-ended banners per page.

**Body:**
```json
{
  "title": "Spring Campaign",
  "page": "SWAP",
  "linkUrl": "https://example.com",
  "clickTarget": "NEW_TAB",
  "startAt": "2026-04-01T00:00:00.000Z",
  "endAt": "2026-04-30T23:59:00.000Z"
}
```

### PUT /admin/banner/:id

Update a banner. Page cannot be changed after creation.

### DELETE /admin/banner/:id

Delete a banner and its S3 images.

### POST /admin/banner/:id/image/pc

Upload PC banner image. Multipart/form-data, max 5MB (PNG, JPEG, WebP).

### POST /admin/banner/:id/image/mobile

Upload mobile banner image (LOCK/VOTE only). Multipart/form-data, max 5MB.

### DELETE /admin/banner/:id/image/pc

Delete PC banner image.

### DELETE /admin/banner/:id/image/mobile

Delete mobile banner image.

---

### Event Admin

#### GET /admin/event

Get blockchain events with filtering and pagination.

| Query Param | Type | Default | Description |
|---|---|---|---|
| `category` | `string` (optional) | - | Event category filter |
| `eventType` | `string` (optional) | - | Event type filter |
| `limit` | `number` | `50` | Max results |
| `offset` | `number` | `0` | Pagination offset |

**Response** `EventListResponseDto`.

---

### Database Admin

#### GET /admin/database/tables

List all database tables with row counts.

**Response:**
```json
[
  { "name": "pool", "rowCount": 42 },
  { "name": "token", "rowCount": 15 }
]
```

#### POST /admin/database/query

Execute a read-only SQL query (SELECT, WITH, EXPLAIN only).

**Request Body:**
```json
{ "sql": "SELECT * FROM pool LIMIT 10" }
```

**Response:**
```json
{
  "columns": ["address", "token0_address", "token1_address"],
  "rows": [{ "address": "0x...", "token0_address": "0x...", "token1_address": "0x..." }],
  "rowCount": 10,
  "executionTimeMs": 5
}
```

---

### Referral Admin

#### GET /admin/referral/overview

Get referral system overview statistics.

#### GET /admin/referral/list

Get all referrers with stats (paginated, searchable, filterable).

| Query Param | Type | Default | Description |
|---|---|---|---|
| `limit` | `number` | `50` | Max results |
| `offset` | `number` | `0` | Pagination offset |
| `search` | `string` (optional) | - | Search by address or referral code |
| `tierFilter` | `string` (optional) | - | Filter: `ALL`, `GENERAL`, `KOL_TIER1`, `KOL_TIER2` |

#### GET /admin/referral/detail/:address

Get detailed referral info for a specific address.

| Param | Type | Description |
|---|---|---|
| `address` | `string` | Referrer wallet address |

#### PUT /admin/referral/tier/:address

Update KOL tier for a referrer.

| Param | Type | Description |
|---|---|---|
| `address` | `string` | Referrer wallet address |

**Request Body** `UpdateKolTierDto`:
```json
{ "badgeType": "KOL_TIER1" }
```

> `badgeType`: `KOL_TIER1`, `KOL_TIER2`, `NONE`

---

### Base Point Config Admin

#### GET /admin/base-point-config/current

Get the currently active base point config.

**Response** `BasePointConfig | null`.

#### GET /admin/base-point-config/history

Get base point config history (paginated).

| Query Param | Type | Default | Description |
|---|---|---|---|
| `limit` | `number` | `20` | Max results |
| `offset` | `number` | `0` | Pagination offset |

**Response:**
```json
{
  "items": [{ "id": 1, "...": "..." }],
  "total": 5
}
```

#### POST /admin/base-point-config

Create a new scheduled base point config.

**Request Body** `CreateBasePointConfigDto`.

**Response** `BasePointConfig`.

---

## GiwaTer Broker (HTTP)

Default base URL: `http://localhost:3045` (see broker `PORT`).

Swagger: `/api/docs`.

**`spot_pairs` liquidity:** `baseLiquidity` / `quoteLiquidity` hold running broker-side pool inventory (human units), incremented from indexed **liquidity add** events (and adjusted on swap hops for routing proxies). **`totalTvlUsd`** on `SpotPairRecordDto` is **`baseLiquidity * spot_tokens(base).priceUSD + quoteLiquidity * spot_tokens(quote).priceUSD`** when **both** legs have a positive `spot_tokens.priceUSD`; otherwise **`null`** (clients may fall back to quote-notional depth from `displayPrice`). **`totalSwapFeesUsd`** / **`daySwapFeesUsd`** accumulate swap fee token amounts in USD when the fee token is priced (day field resets with the same UTC-day boundary as volume). `dayBaseTvl` / `dayQuoteTvl` are **UTC-day** mint totals and reset when `metricsDayStartTs` rolls (same boundary as swap **day** volume). **`spot_pair_time_buckets` / `spot_token_time_buckets`** are OHLCV-style series: rows are **updated as indexer-sourced swap (and related) events** are applied on the broker, and **maintained or backfilled by scheduled broker jobs** (e.g. bucket gap rollups, gap repair, retention prune). They are not a substitute for the live `spot_pairs` snapshot when you need “current” pool depth for routing heuristics.

### GET /contracts

Returns **`{ "contracts": { ... } }`** where `contracts` is **`CONTRACT_ADDRESSES`** from `@giwater/shared`. It includes **every key** from the main API `ContractsAddressesDto` (`terToken`, `votingEscrow`, `voter`, `minter`, `rewardsDistributor`, `poolFactory`, `clPoolFactory`, `factoryRegistry`, `gaugeFactory`, `clGaugeFactory`, `votingRewardsFactory`, `terGovernor`, `epochGovernor`, `router`, `swapRouter`, `nftPositionManager`, `veArtProxy`, `terPoint`, `pointExchanger`, `permit2`, `universalRouter`, `wgiwa`) **plus** deployment extras: `poolImplementation`, `clPoolImplementation`, `clGaugeImplementation`, `managedRewardsFactory`, `dynamicSwapFeeModule`. Static JSON; no database.

**Gateway:** same path **`GET /contracts`** on the gateway (broker parity) or **`POST …/api/v1/broker/invoke`** with `method: GET`, `path: /contracts`.

### Administrative catalog mutations (broker HTTP only)

**Token/pair listing** and other catalog **writes** (`POST …/listing`) are implemented on the **broker** service only. The gateway does **not** expose matching first-class HTTP routes for these paths; public clients use **GET** parity (or `POST /api/v1/broker/invoke` for reads) on the gateway. For admin listing changes, call the **broker** base URL (e.g. internal network). The gateway’s generic **`POST /api/v1/broker/invoke`** can still forward a `method: 'POST'` listing request to the broker for tooling or automation if you choose to use it; for a public edge, restrict who can call `invoke` or use broker-direct for mutations.

### GET /swap-routes

Returns the **shortest hop-count** swap path between two tokens over pools indexed from `PoolCreated` / `CLPoolCreated` events. Each hop includes the **pair (pool) contract address**, **pool kind** (`volatile` | `stable` | `cl`), **fee metadata** from broker `spot_pairs`, and optional **price impact** when `amountIn` is provided (see below).

| Query | Required | Description |
|---|---|---|
| `from` | yes | Input token: `0x` + 40 hex **or** symbol resolved via broker `spot_tokens` |
| `to` | yes | Output token: address or symbol |
| `amountIn` | no | Integer **decimal string** of the input amount in **smallest units (wei)** of the **`from`** token. When set, each hop can include **`priceImpactPercent`** and **`feeOnInputWei`** estimated entirely from broker **`spot_pairs`** (see below). **No chain RPC is required.** |

**Response** (`SwapRouteResponseDto`):

- **`amountInWei`**: present only when `amountIn` was passed; echo of the query string.
- **`totalFeeUsd`**, **`averageFeeBps`**, **`routePriceImpactPercent`**: present only when `amountIn` was passed (same shape on gateway parity).
  - **`totalFeeUsd`**: sum over hops of (hop swap fee in token × USD/token for that hop’s `tokenIn`). **`null`** if any fee token cannot be priced by the broker USD resolver.
  - **`averageFeeBps`**: arithmetic mean of each hop’s **`feeBps`**. **`null`** when `hops` is empty.
  - **`routePriceImpactPercent`**: compounded route impact, **`1 − Π(1 − pᵢ/100)`** where each **`pᵢ`** is that hop’s **`priceImpactPercent`** (same definition as per-hop impact). **`null`** if any hop lacks **`priceImpactPercent`** (e.g. proxy reserves incomplete).

```json
{
  "fromToken": "0x1111...",
  "toToken": "0x2222...",
  "amountInWei": "1000000000000000000",
  "totalFeeUsd": 4.2,
  "averageFeeBps": 25,
  "routePriceImpactPercent": 4.94,
  "hops": [
    {
      "pairAddress": "0xaaaa...",
      "tokenIn": "0x1111...",
      "tokenOut": "0x3333...",
      "effectiveFeeBps": 30,
      "feeBps": 30,
      "feeSource": "factory_tier",
      "poolKind": "volatile",
      "priceImpactPercent": 0.05,
      "feeOnInputWei": "3000000000000000"
    },
    {
      "pairAddress": "0xbbbb...",
      "tokenIn": "0x3333...",
      "tokenOut": "0x2222...",
      "effectiveFeeBps": null,
      "feeBps": 30,
      "feeSource": "cl_module_dynamic",
      "poolKind": "cl",
      "priceImpactPercent": 0.12,
      "feeOnInputWei": "4000000000000000"
    }
  ]
}
```

Per-hop fields:

- **`effectiveFeeBps`**: raw static fee from **`spot_pairs`** when stored; **`null`** when unknown (e.g. CL full dynamic-fee mode). Does not replace an on-chain `getFee` quote at execution time.
- **`feeBps`**: **swap fee in basis points (bps)** always returned as a non-negative integer — the fee rate used for this hop in the API (same value as in **`feeOnInputWei`** / price-impact math when `amountIn` is set). When **`effectiveFeeBps`** is `null`, this uses factory tier defaults from **`broker_pool_factory_fee_defaults`** or **30** (volatile / CL) / **5** (stable).
- **`feeSource`**: `factory_tier` | `factory_custom` | `cl_module_fixed` | `cl_module_dynamic`; empty string if the pair row is missing.
- **`poolKind`**: `volatile` / `stable` for classic pools, `cl` for concentrated liquidity.
- **`priceImpactPercent`** (when `amountIn` is set): constant-product **estimate** using `spot_pairs.baseLiquidity` / `quoteLiquidity` as proxy reserves (indexed mint cumulative in base/quote units — **not** live on-chain reserves; burns not subtracted until remove events are indexed). Stable pools still use this CP shortcut (approximate). CL hops use the same proxy (very rough). **`null`** if TVL proxy is zero or base/quote orientation does not match the hop.
- **`feeOnInputWei`** (when `amountIn` is set): `floor(inputWei * feeBps / 10000)` for that hop; **`feeBps`** is documented above.

- `hops` is empty when `from` and `to` resolve to the same token.
- **404** when no route exists or symbols are unknown.
- Liquidity connectivity is stored as a **token–pool graph** (`swap_liquidity_edges`); the service runs BFS over that graph, then loads **`spot_pairs`** and edges in one batch per route to attach fee fields.

### GET /spot-tokens/by-address/:address

Returns a single **`spot_tokens`** row (`SpotTokenRecordDto` from `@giwater/shared`). Primary key **`id`** is the token contract address. Rows include **`listed`** (boolean): default **`false`** when the row is first created from swap materialization; use the listing POST to publish.

| Path | Required | Description |
|---|---|---|
| `address` | yes | Trimmed and lowercased before lookup |

| Query | Required | Default | Description |
|---|---|---|---|
| `listed` | no | `true` | When `true`, only return if `spot_tokens.listed === true`. When `false`, only if `listed === false`. |

- **404** when no row exists or the row does not match the requested `listed` filter.

### POST /spot-tokens/by-address/:address/listing

Sets **`spot_tokens.listed`**. Body: **`SetSpotListedDto`** — `{ "listed": true }` to list, `{ "listed": false }` to unlist.

**Gateway:** no dedicated parity URL for this path — **broker HTTP only** (see [Administrative catalog mutations](#administrative-catalog-mutations-broker-http-only)). Optional: `POST /api/v1/broker/invoke` with the same `method` / `path` / `body` if your deployment allows `invoke` for writes.

- **200** returns the updated `SpotTokenRecordDto`.
- **404** when the token row does not exist.
- **400** when `listed` is not a boolean.

### GET /spot-tokens/by-symbol/:symbol

Returns **`{ "items": SpotTokenRecordDto[] }`**. Match is **case-insensitive** on **`spot_tokens.symbol`**; multiple tokens may share a symbol.

| Path | Required | Description |
|---|---|---|
| `symbol` | yes | Exact symbol string (URL-encode characters such as `/` if needed) |

| Query | Required | Default | Description |
|---|---|---|---|
| `listed` | no | `true` | When `true`, only tokens with `listed === true`. When `false`, only `listed === false`. |

- **404** when `items` would be empty.

### GET /spot-tokens/leaderboard/day-change/:sort

### GET /spot-tokens/leaderboard/tvl/:sort

### GET /spot-tokens/leaderboard/volume/:sort

Paginated **`spot_tokens`** leaderboards. Response shape **`SpotTokenLeaderboardPageDto`**: `{ offset, limit, total, items: SpotTokenRecordDto[] }`.

| Path | Required | Description |
|---|---|---|
| `sort` | yes | `asc` or `desc` (case-insensitive) |

| Query | Required | Default | Max | Description |
|---|---|---|---|---|
| `offset` | no | `0` | — | Rows to skip |
| `limit` | no | `50` | `200` | Page size |
| `listed` | no | `true` | — | When `true`, only tokens with `listed === true`. When `false`, only `listed === false`. |

| Path prefix | Sort (then `id` ASC) |
|---|---|
| `.../day-change/...` | `dayPriceDifferencePercentage` in **`sort`** order |
| `.../tvl/...` | `dayTvlUSD`, then `dayTvl`, in **`sort`** order |
| `.../volume/...` | `dayVolumeUSD`, then `dayVolume`, in **`sort`** order |

- **400** when `sort` is not `asc` or `desc`.

Metrics follow whatever the broker last wrote on each row (UTC-day fields on `spot_tokens`).

### GET /spot-tokens/recently-created

Paginated tokens ordered by **`spot_tokens.listingDate`** descending, then **`id`** descending. Response shape **`SpotTokenLeaderboardPageDto`**: `{ offset, limit, total, items: SpotTokenRecordDto[] }`.

| Query | Required | Default | Max | Description |
|---|---|---|---|---|
| `offset` | no | `0` | — | Rows to skip |
| `limit` | no | `50` | `200` | Page size |
| `listed` | no | `true` | — | When `true`, only tokens with `listed === true`. When `false`, only `listed === false` (unlisted / pending curation). |

**Gateway:** mirrored under broker HTTP parity as **`GET /spot-tokens/recently-created`** (same query params) and via **`POST /api/v1/broker/invoke`** with `method: GET`, `path: /spot-tokens/recently-created`.

### GET /spot-pairs/by-address/:address/cl-dynamic-fee

Returns **`ClDynamicFeeReadModelDto`**: module-wide defaults (`defaultFeeCap`, `defaultScalingFactor`, `secondsAgo` as wire strings), per-pool CL curve (`baseFee`, `feeCap`, `scalingFactor` wires), and optionally the registered fee discount for a wallet when **`sender`** is passed (same ÷100 wire→bps convention as pool fees). Data is aggregated from indexed `DynamicSwapFeeModule` events; it does **not** substitute an on-chain **`getFee(pool)`** call (TWAP/slot0).

**Gateway:** the same path works via **`POST /api/v1/broker/invoke`** (`action: apiInvoke`) with `method: GET`, `path: /spot-pairs/by-address/<pool>/cl-dynamic-fee`, and optional `query.sender` — mirrored in **`GatewayRpcInvokeService`** (broker).

| Query | Required | Description |
|---|---|---|
| `sender` | no | If set, includes `discountWire` / `discountBps` for that address when registered |

### GET /spot-pairs/by-address/:address

Returns a single **`spot_pairs`** row (`SpotPairRecordDto`). Primary key **`id`** is the pair (pool) contract address. Rows include **`listed`** (boolean): default **`false`** on **`PoolCreated`** / **`CLPoolCreated`** aggregation (and on first swap-created pair rows); use the listing POST to publish.

| Path | Required | Description |
|---|---|---|
| `address` | yes | Trimmed and lowercased before lookup |

| Query | Required | Default | Description |
|---|---|---|---|
| `listed` | no | `true` | When `true`, only return if `spot_pairs.listed === true`. When `false`, only if `listed === false`. |

- **404** when no row exists or the row does not match the requested `listed` filter.

### POST /spot-pairs/by-address/:address/listing

Sets **`spot_pairs.listed`**. Body: **`SetSpotListedDto`** — `{ "listed": true | false }`.

When **`listed: true`**, the broker also sets **`spot_tokens.listed = true`** for **`token0`** and **`token1`** on that pair row, bumping each token’s **`listingDate`** when a matching token row exists. Rows that are not yet materialized in **`spot_tokens`** are skipped. Unlisting the pair (**`listed: false`**) does **not** flip token rows back to unlisted.

- **200** / **404** / **400** same semantics as token listing.

**Gateway:** no dedicated parity URL — **broker HTTP only** (see [Administrative catalog mutations](#administrative-catalog-mutations-broker-http-only)). Optional: `POST /api/v1/broker/invoke` as above.

### GET /spot-pairs/by-symbol/:symbol

Returns **`{ "items": SpotPairRecordDto[] }`**. Match is **case-insensitive** on **`spot_pairs.symbol`**.

| Path | Required | Description |
|---|---|---|
| `symbol` | yes | Pair symbol as stored (e.g. `BASE/QUOTE`; URL-encode `/` as `%2F` in path segments) |

| Query | Required | Default | Description |
|---|---|---|---|
| `listed` | no | `true` | When `true`, only pairs with `listed === true`. When `false`, only `listed === false`. |

- **404** when `items` would be empty.

### GET /spot-pairs/leaderboard/day-change/:sort

### GET /spot-pairs/leaderboard/tvl/:sort

### GET /spot-pairs/leaderboard/volume/:sort

Paginated **`spot_pairs`** leaderboards. Response shape **`SpotPairLeaderboardPageDto`**: `{ offset, limit, total, items: SpotPairRecordDto[] }`.

| Path | Required | Description |
|---|---|---|
| `sort` | yes | `asc` or `desc` (case-insensitive) |

| Query | Required | Default | Max | Description |
|---|---|---|---|---|
| `offset` | no | `0` | — | Rows to skip |
| `limit` | no | `50` | `200` | Page size |
| `listed` | no | `true` | — | When `true`, only pairs with `listed === true`. When `false`, only `listed === false`. |

| Path prefix | Sort (then `id` ASC) |
|---|---|
| `.../day-change/...` | `dayPriceDifferencePercentage` in **`sort`** order |
| `.../tvl/...` | **`dayBaseTvlUSD + dayQuoteTvlUSD`** (null as 0) in **`sort`** order |
| `.../volume/...` | **`dayBaseVolumeUSD + dayQuoteVolumeUSD`** (null as 0) in **`sort`** order |

- **400** when `sort` is not `asc` or `desc`.

### POST /spot-token-groups

Creates a row in **`spot_groups`**. DTO: `CreateSpotGroupDto` (`id` required; `name`, `description` optional).

- **201** with `SpotGroupRecordDto`.
- **409** if `id` already exists.

### POST /spot-token-groups/:groupId/tokens

Adds **`spot_group_tokens`** (`groupId`, `tokenId`). Body: `AddTokenToSpotGroupDto` (`tokenAddress` required, lowercased). `symbol` is filled from `spot_tokens` when that row exists.

- **200** with `SpotGroupTokenMemberDto`; idempotent if the pair `(groupId, tokenId)` already exists.
- **404** if the group id is unknown.

### POST /spot-pair-groups

Same as token-group create: inserts **`spot_groups`**. Use a distinct `id` namespace from token-oriented groups if both exist.

- **201** / **409** same semantics as `POST /spot-token-groups`.

### POST /spot-pair-groups/:groupId/pairs

Adds **`spot_group_pairs`** (`pairId`, `groupId`). Body: `AddPairToSpotGroupDto` (`pairAddress` required). `symbol`, `base`, `quote` are copied from **`spot_pairs`**; the pool row **must** exist.

- **200** with `SpotGroupPairMemberDto`; idempotent if membership already exists.
- **404** if the group id is unknown or the pair address is not in `spot_pairs`.

### Swap OHLCV buckets (internal)

`Swap` indexer events aggregate into `spot_pair_time_buckets` / `spot_token_time_buckets` for resolutions **`1m`**, **`1h`**, **`1d`**, **`1w`**, **`1mo`**. Monotonic **`bucketIndex`** (from 1 per stream) and **`swap_bucket_state`** align the live aggregator with the **minute cron** so empty intervals still get a datapoint (flat OHLC carry).

---

## Error Handling

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```
