# Blockchain Events - Block Sync 상세 보고서

> 이 문서는 giwater 프로젝트에서 블록체인 블록을 동기화할 때 어떤 이벤트들이 파싱·처리되고, 각 이벤트가 DB에 어떤 변화를 일으키는지를 설명합니다.

---

## 목차

1. [전체 아키텍처 흐름](#1-전체-아키텍처-흐름)
2. [동기화 프로세스 상세](#2-동기화-프로세스-상세)
3. [이벤트 카테고리별 파싱 상세](#3-이벤트-카테고리별-파싱-상세)
4. [이벤트별 DB 변경 상세](#4-이벤트별-db-변경-상세)
5. [관련 DB 테이블 스키마 요약](#5-관련-db-테이블-스키마-요약)

---

## 1. 전체 아키텍처 흐름

```
블록체인 (Nodit RPC)
       │
       ▼
┌─────────────────────┐    30초 간격 폴링
│   EventSyncService  │◄── (SYNC_CONFIG.POLLING_INTERVAL_MS)
│  (event-sync.service)│
└─────────┬───────────┘
          │
          │  토픽 기반 getLogs() 호출 (9개 카테고리)
          │
          ▼
┌─────────────────────────┐
│  EventProcessorService  │  이벤트 파싱 + blockchain_events 테이블 저장
│  (event-processor.service)│
└─────────┬───────────────┘
          │
          │  저장된 이벤트를 상태 테이블에 반영
          │
          ▼
┌─────────────────────────┐
│  PositionStateService   │  lp_positions / lock_positions / vote_positions / user_multipliers 갱신
│  (position-state.service)│
└─────────────────────────┘
```

**별도 동기화 흐름 (PoolCreated):**

```
PoolFactory / CLPoolFactory
       │
       ▼
┌──────────────────────────┐
│  PoolCreatedSyncService  │  PoolCreated 이벤트 감지 → pools 테이블 INSERT → 백필 큐 등록
└──────────────────────────┘
```

---

## 2. 동기화 프로세스 상세

### 2.1 EventSyncService (메인 이벤트 동기화)

- **파일:** `apps/api/src/modules/indexer/services/event-sync.service.ts`
- **폴링 주기:** 30초 (SYNC_CONFIG.POLLING_INTERVAL_MS)
- **배치 크기:** 2,000 블록 (SYNC_CONFIG.BLOCK_BATCH_SIZE)
- **요청 간 딜레이:** 200ms (SYNC_CONFIG.REQUEST_DELAY_MS)

**동기화 순서 (9단계):**

| 순서 | 카테고리 | 대상 컨트랙트 | 검증 방식 |
|------|---------|-------------|----------|
| 1 | POOL (Basic AMM) | 등록된 풀 주소 | Pool Registry 검증 |
| 2 | CL_POOL (Concentrated Liquidity) | 등록된 CL 풀 주소 | Pool Registry 검증 |
| 3 | GAUGE (Basic Gauge) | Gauge 컨트랙트 | Pool Registry 검증 |
| 4 | CL_GAUGE (CL Gauge) | CL Gauge 컨트랙트 | Pool Registry 검증 |
| 5 | VE (VotingEscrow) | VotingEscrow 컨트랙트 | 컨트랙트 주소 필터 |
| 6 | VOTER | Voter 컨트랙트 | 컨트랙트 주소 필터 |
| 7 | NFT_POSITION | NftPositionManager | 컨트랙트 주소 필터 |
| 8 | MINTER | Minter 컨트랙트 | 컨트랙트 주소 필터 |
| 9 | REWARDS_DISTRIBUTOR | RewardsDistributor | 컨트랙트 주소 필터 |

**풀 이벤트 (1-4):** 토픽으로 필터링 후, `PoolValidatorService`로 컨트랙트 주소가 등록된 풀인지 3단계 검증 (캐시 → DB → 온체인)

**싱글턴 컨트랙트 이벤트 (5-9):** 특정 컨트랙트 주소 + 토픽으로 직접 필터링

### 2.2 이벤트 처리 파이프라인

1. **중복 검사:** `txHash + logIndex` 고유 조합으로 중복 이벤트 스킵
2. **이벤트 파싱:** topic hash → category/eventType 매핑 → ABI 디코딩
3. **USD 환산:** Swap/Mint/Burn/Fees 이벤트에 대해 PriceService로 amountUsd 계산
4. **라우터 주소 해석:** sender가 Router 컨트랙트인 경우 `tx.from`에서 실제 유저 주소 추출
5. **DB 저장:** `blockchain_events` 테이블에 INSERT
6. **상태 테이블 갱신:** `PositionStateService.processEventForStateUpdate()` 호출

### 2.3 PoolCreatedSyncService (풀 생성 감지)

- **파일:** `apps/api/src/modules/indexer/services/pool-created-sync.service.ts`
- PoolFactory와 CLPoolFactory의 `PoolCreated` 이벤트를 별도로 모니터링
- 새 풀 발견 시: pools 테이블에 레코드 생성 → PoolValidator 캐시에 추가 → 백필 큐에 등록

---

## 3. 이벤트 카테고리별 파싱 상세

### 3.1 POOL (Basic AMM) 이벤트

| 이벤트 | Topic Hash | ABI Signature |
|--------|-----------|---------------|
| **Mint** | `0x4c209b5f...` | `Mint(address indexed sender, uint256 amount0, uint256 amount1)` |
| **Burn** | `0x5d624aa9...` | `Burn(address indexed sender, address indexed to, uint256 amount0, uint256 amount1)` |
| **Swap** | `0xb3e27736...` | `Swap(address indexed sender, address indexed to, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out)` |
| **Sync** | `0xcf2aa508...` | `Sync(uint256 reserve0, uint256 reserve1)` |
| **Fees** | `0x112c2569...` | `Fees(address indexed sender, uint256 amount0, uint256 amount1)` |
| **Claim** | `0x865ca08d...` | `Claim(address indexed sender, address indexed recipient, uint256 amount0, uint256 amount1)` |

### 3.2 CL_POOL (Concentrated Liquidity) 이벤트

| 이벤트 | Topic Hash | ABI Signature |
|--------|-----------|---------------|
| **Initialize** | `0x98636036...` | `Initialize(uint160 sqrtPriceX96, int24 tick)` |
| **Mint** | `0x7a53080b...` | `Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)` |
| **Burn** | `0x0c396cd9...` | `Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)` |
| **Swap** | `0xc42079f9...` | `Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)` |
| **Collect** | `0x70935338...` | `Collect(address indexed owner, address recipient, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount0, uint128 amount1)` |
| **Flash** | `0xbdbdb71d...` | `Flash(address indexed sender, address indexed recipient, uint256 amount0, uint256 amount1, uint256 paid0, uint256 paid1)` |

### 3.3 GAUGE (Basic Gauge) 이벤트

| 이벤트 | Topic Hash | ABI Signature |
|--------|-----------|---------------|
| **Deposit** | `0x5548c837...` | `Deposit(address indexed from, address indexed to, uint256 amount)` |
| **Withdraw** | `0x884edad9...` | `Withdraw(address indexed from, uint256 amount)` |
| **NotifyReward** | `0x09566775...` | `NotifyReward(address indexed from, uint256 amount)` |
| **ClaimRewards** | `0x1f89f963...` | `ClaimRewards(address indexed from, uint256 amount)` |

### 3.4 CL_GAUGE (CL Gauge) 이벤트

| 이벤트 | Topic Hash | ABI Signature |
|--------|-----------|---------------|
| **Deposit** | `0x1c8ab8c7...` | `Deposit(address indexed user, uint256 indexed tokenId, uint128 indexed liquidityToStake)` |
| **Withdraw** | `0x8903a5b5...` | `Withdraw(address indexed user, uint256 indexed tokenId, uint128 indexed liquidityToStake)` |
| **ClaimFees** | `0xbc567d6c...` | `ClaimFees(address indexed from, uint256 claimed0, uint256 claimed1)` |

### 3.5 VE (VotingEscrow) 이벤트

| 이벤트 | Topic Hash | ABI Signature |
|--------|-----------|---------------|
| **Deposit** | `0x8835c22a...` | `Deposit(address indexed provider, uint256 indexed tokenId, uint8 indexed depositType, uint256 value, uint256 locktime, uint256 ts)` |
| **Withdraw** | `0x02f25270...` | `Withdraw(address indexed provider, uint256 indexed tokenId, uint256 value, uint256 ts)` |
| **Supply** | `0x5e2aa66e...` | `Supply(uint256 prevSupply, uint256 supply)` |
| **Merge** | `0x986e3c95...` | `Merge(address indexed provider, uint256 indexed from, uint256 indexed to, uint256 amountFrom, uint256 amountTo, uint256 ts)` |
| **Split** | `0x8303de81...` | `Split(uint256 indexed from, uint256 indexed tokenId1, uint256 indexed tokenId2, uint256 splitAmount1, uint256 splitAmount2, uint256 ts)` |
| **LockPermanent** | `0x793cb7a3...` | `LockPermanent(address indexed owner, uint256 indexed tokenId, uint256 amount, uint256 ts)` |
| **UnlockPermanent** | `0x668d293c...` | `UnlockPermanent(address indexed owner, uint256 indexed tokenId, uint256 amount, uint256 ts)` |
| **DelegateChanged** | `0xf1aa2a9e...` | `DelegateChanged(address indexed delegator, uint256 indexed fromDelegate, uint256 indexed toDelegate)` |

### 3.6 VOTER 이벤트

| 이벤트 | Topic Hash | ABI Signature |
|--------|-----------|---------------|
| **GaugeCreated** | `0xef9f7d1f...` | `GaugeCreated(address indexed poolFactory, address indexed votingRewardsFactory, address indexed gaugeFactory, address pool, address bribeVotingReward, address feesVotingReward, address gauge, address creator)` |
| **GaugeKilled** | `0x04a5d3f5...` | `GaugeKilled(address indexed gauge)` |
| **GaugeRevived** | `0xed18e9fa...` | `GaugeRevived(address indexed gauge)` |
| **Voted** | `0x452d440e...` | `Voted(address indexed voter, address indexed pool, uint256 indexed tokenId, uint256 weight, uint256 totalWeight, uint256 timestamp)` |
| **Abstained** | `0xadab6309...` | `Abstained(address indexed voter, address indexed pool, uint256 indexed tokenId, uint256 weight, uint256 totalWeight, uint256 timestamp)` |
| **NotifyReward** | `0xf70d5c69...` | `NotifyReward(address indexed sender, address indexed reward, uint256 amount)` |
| **DistributeReward** | `0x4fa9693c...` | `DistributeReward(address indexed sender, address indexed gauge, uint256 amount)` |
| **WhitelistToken** | `0x44948130...` | - |
| **WhitelistNFT** | `0x8a6ff732...` | - |

### 3.7 NFT_POSITION (CL NFT Position Manager) 이벤트

| 이벤트 | Topic Hash | ABI Signature |
|--------|-----------|---------------|
| **IncreaseLiquidity** | `0x3067048b...` | `IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)` |
| **DecreaseLiquidity** | `0x26f6a048...` | `DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)` |
| **Collect** | `0x40d0efd1...` | `Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1)` |

### 3.8 MINTER 이벤트

| 이벤트 | Topic Hash | ABI Signature |
|--------|-----------|---------------|
| **Mint** | `0xcd212782...` | `Mint(address indexed sender, uint256 weekly, uint256 circulatingSupply, bool indexed tail)` |
| **Nudge** | `0x89f7f67b...` | `Nudge(uint256 indexed period, uint256 oldRate, uint256 newRate)` |

### 3.9 REWARDS_DISTRIBUTOR 이벤트

| 이벤트 | Topic Hash | ABI Signature |
|--------|-----------|---------------|
| **CheckpointToken** | `0xce749457...` | `CheckpointToken(uint256 time, uint256 tokens)` |
| **Claimed** | `0xcae2990a...` | `Claimed(uint256 indexed tokenId, uint256 indexed epochStart, uint256 indexed epochEnd, uint256 amount)` |

### 3.10 FACTORY 이벤트

| 이벤트 | Topic Hash | ABI Signature |
|--------|-----------|---------------|
| **PoolCreated (CL)** | `0xab0d57f0...` | `PoolCreated(address indexed token0, address indexed token1, int24 indexed tickSpacing, address pool)` |
| **PoolCreated (Basic)** | `0x2128d88d...` | `PoolCreated(address indexed token0, address indexed token1, bool indexed stable, address pool, uint256)` |

---

## 4. 이벤트별 DB 변경 상세

모든 이벤트는 먼저 `blockchain_events` 테이블에 INSERT됩니다. 그 후 이벤트 종류에 따라 추가 상태 테이블이 갱신됩니다.

### 4.1 공통: `blockchain_events` 테이블 INSERT

모든 이벤트는 아래 필드가 기록됩니다:

| 필드 | 설명 |
|-----|------|
| `tx_hash` + `log_index` | 고유 키 (중복 방지) |
| `block_number`, `block_timestamp` | 블록 정보 |
| `category`, `event_type`, `pool_type` | 이벤트 분류 |
| `topic_hash`, `contract_address` | 토픽/컨트랙트 |
| `pool_address`, `user_address`, `recipient_address` | 관련 주소 |
| `amount0`, `amount1`, `liquidity`, `amount_usd` | 금액 데이터 |
| `tick_lower`, `tick_upper`, `sqrt_price_x96`, `tick` | CL 전용 |
| `token_id`, `deposit_type`, `locktime` | VE/NFT 전용 |
| `weight`, `total_weight` | Voter 전용 |
| `amount0_in`, `amount1_in`, `amount0_out`, `amount1_out` | Swap 전용 |
| `raw_data` | 원본 디코딩 데이터 (JSONB) |

### 4.2 Pool Mint (Basic AMM) → `lp_positions` + `user_multipliers`

**이벤트:** `POOL.MINT`

```
blockchain_events INSERT
  └─► 기존 position 있음?
       ├─ YES → lp_positions UPDATE (liquidity 증가, liquidityUsd 증가)
       └─ NO  → lp_positions INSERT (새 포지션 생성)
                 └─► user_multipliers INSERT (multiplier=1.0, weightedAgeDays=0)
```

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | 전체 이벤트 데이터 + amountUsd 계산 |
| `lp_positions` | UPSERT | `liquidity` (누적), `liquidityUsd`, `isActive=true`, `depositAt` |
| `user_multipliers` | INSERT (신규만) | `multiplier=1.0`, `depositStart`, `weightedAgeDays=0` |

### 4.3 Pool Burn (Basic AMM) → `lp_positions`

**이벤트:** `POOL.BURN`

```
blockchain_events INSERT
  └─► lp_positions 조회 (userAddress + poolAddress + tokenId IS NULL + isActive=true)
       ├─ 전액 인출 → UPDATE (liquidity=0, liquidityUsd=0, isActive=false, withdrawAt 설정)
       └─ 부분 인출 → UPDATE (liquidity 감소, liquidityUsd 비율 감소)
```

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | 전체 이벤트 데이터 + amountUsd 계산 |
| `lp_positions` | UPDATE | `liquidity`, `liquidityUsd`, `isActive`, `withdrawAt` |

### 4.4 Pool Swap → `blockchain_events` only

**이벤트:** `POOL.SWAP`

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `amount0In`, `amount1In`, `amount0Out`, `amount1Out`, `amountUsd` (거래량 USD) |

> Swap은 상태 테이블을 직접 변경하지 않습니다. amountUsd는 max(token0 volume, token1 volume)으로 계산됩니다.

### 4.5 Pool Sync → `blockchain_events` only

**이벤트:** `POOL.SYNC`

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `amount0` (reserve0), `amount1` (reserve1) |

> 리저브 변경을 기록만 합니다. pool_stats 갱신은 별도 통계 태스크에서 처리합니다.

### 4.6 Pool Fees → `blockchain_events` only

**이벤트:** `POOL.FEES`

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `amount0`, `amount1`, `amountUsd` (수수료 USD) |

### 4.7 Pool Claim → `blockchain_events` only

**이벤트:** `POOL.CLAIM`

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `userAddress`, `recipientAddress`, `amount0`, `amount1` |

### 4.8 CL Pool Initialize → `blockchain_events` only

**이벤트:** `CL_POOL.INITIALIZE`

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `sqrtPriceX96`, `tick` |

### 4.9 CL Pool Mint → `blockchain_events` only

**이벤트:** `CL_POOL.MINT`

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `userAddress` (owner), `tickLower`, `tickUpper`, `liquidity`, `amount0`, `amount1` |

> CL 풀의 실제 포지션 추적은 NFT Position Manager 이벤트(IncreaseLiquidity/DecreaseLiquidity)를 통해 이루어집니다.

### 4.10 CL Pool Burn / Swap / Collect / Flash → `blockchain_events` only

CL Pool의 Burn, Swap, Collect, Flash 이벤트는 모두 `blockchain_events`에만 기록됩니다.

### 4.11 IncreaseLiquidity (NFT Position) → `lp_positions` + `user_multipliers`

**이벤트:** `NFT_POSITION.INCREASE_LIQUIDITY`

```
blockchain_events INSERT
  └─► tokenId로 lp_positions 조회
       ├─ 기존 position 있음 → UPDATE (liquidity 증가, liquidityUsd 증가)
       └─ 기존 position 없음 → INSERT (새 CL 포지션 생성)
                                └─► user_multipliers INSERT (신규)
```

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `tokenId`, `liquidity`, `amount0`, `amount1` |
| `lp_positions` | UPSERT | `tokenId`, `liquidity`, `liquidityUsd`, `tickLower`, `tickUpper`, `isActive=true` |
| `user_multipliers` | INSERT (신규만) | `multiplier=1.0`, `depositStart`, `weightedAgeDays=0` |

### 4.12 DecreaseLiquidity (NFT Position) → `lp_positions`

**이벤트:** `NFT_POSITION.DECREASE_LIQUIDITY`

```
blockchain_events INSERT
  └─► tokenId로 lp_positions 조회
       ├─ 전액 인출 → UPDATE (liquidity=0, isActive=false, withdrawAt 설정)
       └─ 부분 인출 → UPDATE (liquidity 감소, liquidityUsd 비율 감소)
```

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `tokenId`, `liquidity`, `amount0`, `amount1` |
| `lp_positions` | UPDATE | `liquidity`, `liquidityUsd`, `isActive`, `withdrawAt` |

### 4.13 NFT Collect → `blockchain_events` only

**이벤트:** `NFT_POSITION.NFT_COLLECT`

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `tokenId`, `recipientAddress`, `amount0`, `amount1` |

### 4.14 VE Deposit → `lock_positions`

**이벤트:** `VE.DEPOSIT`

```
blockchain_events INSERT
  └─► tokenId로 lock_positions 조회
       ├─ 기존 position 있음
       │    ├─ depositType = INCREASE_LOCK_AMOUNT → lockedAmount 증가
       │    ├─ depositType = DEPOSIT_FOR_TYPE → lockedAmount 증가
       │    └─ depositType = INCREASE_UNLOCK_TIME → lockEnd 변경, lockWeeks 재계산
       │    └─► votingPower 재계산
       └─ 기존 position 없음 → INSERT (새 lock 포지션)
```

**depositType 값:**
- `0` (DEPOSIT_FOR_TYPE): 기존 lock에 토큰 추가
- `1` (CREATE_LOCK_TYPE): 새 lock 생성
- `2` (INCREASE_LOCK_AMOUNT): lock 금액 증가
- `3` (INCREASE_UNLOCK_TIME): lock 기간 연장

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `userAddress`, `tokenId`, `depositType`, `amount0` (value), `locktime` |
| `lock_positions` | UPSERT | `lockedAmount`, `lockEnd`, `lockWeeks`, `votingPower`, `isActive=true`, `isExpired=false` |

### 4.15 VE Withdraw → `lock_positions`

**이벤트:** `VE.WITHDRAW`

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `userAddress`, `tokenId`, `amount0` (value) |
| `lock_positions` | UPDATE | `isActive=false`, `isExpired=true`, `lockedAmount=0`, `votingPower=0` |

### 4.16 VE Merge → `lock_positions`

**이벤트:** `VE.MERGE`

```
blockchain_events INSERT
  └─► target tokenId의 lock_positions UPDATE
       └─ lockedAmount = amountFrom + amountTo, votingPower 재계산
```

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `userAddress`, `tokenId` (target), `amount0` (from), `amount1` (to) |
| `lock_positions` | UPDATE (target) | `lockedAmount` (합산), `votingPower` (재계산) |

### 4.17 VE Split → `lock_positions`

**이벤트:** `VE.SPLIT`

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `tokenId` (token1), `amount0` (splitAmount1), `amount1` (splitAmount2) |
| `lock_positions` | UPDATE (원본) | `lockedAmount=splitAmount1`, `votingPower` (재계산) |

### 4.18 VE Supply / LockPermanent / UnlockPermanent / DelegateChanged → `blockchain_events` only

이 이벤트들은 `blockchain_events`에만 기록됩니다.

### 4.19 Voted → `vote_positions`

**이벤트:** `VOTER.VOTED`

```
blockchain_events INSERT
  └─► epoch 계산 (주 단위)
       └─► lockTokenId + poolAddress + epoch로 vote_positions 조회
            ├─ 있음 → UPDATE (votingPower, percentage, votedAt 갱신)
            └─ 없음 → INSERT (새 투표 포지션)
```

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `userAddress`, `poolAddress`, `tokenId`, `weight`, `totalWeight` |
| `vote_positions` | UPSERT | `votingPower`, `percentage`, `epoch`, `votedAt`, `txHash`, `blockNumber` |

**percentage 계산:** `(weight / totalWeight) * 100`

### 4.20 Abstained → `vote_positions`

**이벤트:** `VOTER.ABSTAINED`

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `userAddress`, `poolAddress`, `tokenId`, `weight`, `totalWeight` |
| `vote_positions` | UPDATE (해당 epoch) | `votingPower=0`, `percentage=0` |

### 4.21 GaugeCreated → `blockchain_events` only

**이벤트:** `VOTER.GAUGE_CREATED`

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `poolAddress`, `userAddress` (creator), `rawData` (gauge, bribeVotingReward 등) |

### 4.22 Gauge Deposit / Withdraw → `blockchain_events` only (+ 로깅)

**이벤트:** `GAUGE.DEPOSIT`, `GAUGE.WITHDRAW`

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `userAddress`, `recipientAddress`, `liquidity` |

> 현재는 모니터링 로그만 기록합니다. 향후 스테이킹 상태 추적에 활용될 수 있습니다.

### 4.23 Gauge NotifyReward / ClaimRewards → `blockchain_events` only

**이벤트:** `GAUGE.NOTIFY_REWARD`, `GAUGE.CLAIM_REWARDS`

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | `userAddress`, `amount0` (reward amount) |

### 4.24 CL Gauge Deposit / Withdraw / ClaimFees → `blockchain_events` only (+ 로깅)

CL Gauge 이벤트도 `blockchain_events`에만 기록되며, deposit/withdraw는 모니터링 로그가 추가됩니다.

### 4.25 Minter Mint / Nudge → `blockchain_events` only

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | Mint: `userAddress`, `amount0` (weekly), `amount1` (circulatingSupply) / Nudge: `amount0` (oldRate), `amount1` (newRate) |

### 4.26 CheckpointToken / Claimed (Rewards Distributor) → `blockchain_events` only

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `blockchain_events` | INSERT | CheckpointToken: `amount0` (tokens) / Claimed: `tokenId`, `amount0` (amount) |

### 4.27 PoolCreated (Factory) → `pools` + `sync_status`

**별도 서비스 (PoolCreatedSyncService)에서 처리:**

```
PoolCreated 이벤트 감지
  └─► pools 테이블에 이미 있는가?
       ├─ YES → pools UPDATE (createdBlock, factoryAddress 보완)
       └─ NO  → poolService.createPool() → pools INSERT
                 └─► PoolValidator 캐시 추가
                 └─► BackfillService 큐에 등록
```

| 테이블 | 작업 | 변경 필드 |
|--------|------|----------|
| `pools` | INSERT 또는 UPDATE | `address`, `createdBlock`, `factoryAddress`, `isBackfilled` |
| `sync_status` | UPSERT | `lastBlock` (처리한 마지막 블록) |

---

## 5. 관련 DB 테이블 스키마 요약

### `blockchain_events`
> 모든 블록체인 이벤트의 원본 로그 저장소
- PK: `id` (auto increment)
- 고유 키: `(tx_hash, log_index)`
- 인덱스: `(category, event_type, block_timestamp)`, `(pool_address, block_timestamp)`, `(user_address, block_timestamp)`

### `lp_positions`
> 유동성 포지션 (Basic AMM + CL) 현재 상태
- PK: `id`
- 고유 키: `token_id` (CL만, WHERE token_id IS NOT NULL)
- Basic AMM: `user_address + pool_address + token_id IS NULL`로 식별
- CL: `token_id`로 식별
- 주요 필드: `liquidity`, `liquidityUsd`, `tickLower`, `tickUpper`, `isActive`, `isInRange`, `depositAt`, `withdrawAt`

### `lock_positions`
> veToken Lock 포지션 현재 상태
- PK: `id`
- 고유 키: `token_id`
- 주요 필드: `lockedAmount`, `votingPower`, `lockStart`, `lockEnd`, `lockWeeks`, `isActive`, `isExpired`

### `vote_positions`
> 투표 포지션 (에포크별)
- PK: `id`
- 고유 키: `(lock_token_id, pool_address, epoch)`
- 주요 필드: `votingPower`, `percentage`, `epoch`, `votedAt`

### `user_multipliers`
> 시간 기반 채굴 보상 배율 (1.0x ~ 2.0x)
- PK: `id`
- 고유 키: `(user_address, pool_address)`
- 주요 필드: `multiplier`, `depositStart`, `weightedAgeDays`, `lastDilutionAt`

### `sync_status`
> 각 동기화 유형의 진행 상태
- PK: `id`
- 고유 키: `sync_type`
- sync_type 종류: `events`, `pool_created`, `cl_pool_created`
- 주요 필드: `lastBlock`, `isSyncing`

### `pools`
> 등록된 AMM 풀 정보
- PK: `address`
- PoolCreated 이벤트 시 생성/갱신
- 주요 필드: `token0Address`, `token1Address`, `createdBlock`, `factoryAddress`, `isBackfilled`
