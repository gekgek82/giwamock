# Admin

## Overview

프로토콜 관리를 위한 어드민 대시보드. 시즌/포인트/토큰/풀 관리, 스마트 컨트랙트 조작, 인덱서/캐시 운영을 제공한다.

## Layout

`AdminLayoutClient` 컴포넌트로 감싸지며, 어드민 전용 사이드바와 네비게이션을 제공한다.

---

## Routes

### `/admin` - 대시보드

프로토콜 전체 개요를 보여주는 메인 대시보드.

**Components:** `SeasonOverview`, `QuickStats`, `LeaderboardPreview`, Blacklist Summary

**API:**
- `adminApi.getCurrentSeason()` - 활성 시즌 조회
- `adminApi.getLeaderboard({ limit: 10 })` - 상위 10명
- `adminApi.getBlacklist()` - 블랙리스트 전체 조회
- `adminApi.getDashboardStats()` - 전체 통계

---

### `/admin/tokens` - 토큰 관리

토큰 레지스트리 관리 및 아이콘 업로드.

**API:**
- `adminApi.getTokens()` / `createToken()` / `updateToken()` / `deleteToken()`
- `adminApi.uploadTokenIcon()` / `deleteTokenIcon()`

**기능:** 토큰 CRUD, 아이콘 업로드/삭제, 토큰 정보 표시

---

### `/admin/pools` - 풀 관리

풀 화이트리스트 관리.

**API:**
- `adminApi.getPools()` - 풀 목록 조회
- `adminApi.updatePoolWhitelist(address, isWhitelisted)` - 화이트리스트 토글

**기능:** 풀 목록, 화이트리스트/비화이트리스트 필터, 토큰 심볼/주소 검색

---

### `/admin/seasons` - 시즌 관리

포인트 배분 기간 설정 및 시즌 관리.

**API:**
- `adminApi.getSeasons()` / `createSeason()` / `updateSeasonStatus()` / `updateSeasonWeights()`

**기능:** 시즌 CRUD, 상태 변경 (pending → active → finished), 섹터 가중치 설정

---

### `/admin/points` - 포인트 관리

포인트 배분 트리거, 리더보드, 마이닝 레이트 조회.

**API:**
- `adminApi.getLeaderboard({ limit, offset })` - 페이징된 리더보드
- `adminApi.getMiningRates()` - 섹터별 마이닝 레이트
- `adminApi.triggerDistribution(date?)` - 배분 실행
- `adminApi.getPointBalance(address)` - 사용자 포인트 조회

**기능:** 리더보드 (20개씩 페이징), 마이닝 레이트 테이블, 사용자 포인트 검색, 배분 트리거

---

### `/admin/badges` - 배지 관리

사용자 배지 부여 및 조회.

**API:**
- `adminApi.getUserBadges(address)` - 지갑별 배지 조회
- `adminApi.grantBadge(data)` - 배지 부여

**배지 유형:** Early Bird (1.1x), KOL Partner (500% cap), Whale, OG

---

### `/admin/blacklist` - 블랙리스트 관리

규칙 위반 사용자 차단 및 몰수 포인트 추적.

**API:**
- `adminApi.getBlacklist()` / `addToBlacklist()` / `removeFromBlacklist()`
- `adminApi.getCurrentSeason()` - 현재 시즌 ID

**기능:** 블랙리스트 CRUD, 사유별 분류, 몰수 포인트 추적, 제거 확인 다이얼로그

---

### `/admin/indexer` - 인덱서 관리

블록체인 이벤트 인덱서 및 상태 테이블 재구축.

**API:**
- `adminApi.getSyncStatus()` / `getBackfillStatus()` / `getRebuildStatus()`
- `adminApi.rebuildLpPositions()` / `rebuildLockPositions()` / `rebuildVotePositions()` / `rebuildAll()`
- `adminApi.triggerSync()` / `resetSync(fromBlock)`

**기능:** 동기화 상태 모니터링, 백필 진행률, LP/Lock/Vote 포지션 재구축, 특정 블록으로 리셋

---

### `/admin/cache` - 캐시 관리

Redis 캐시 키 검사 및 관리.

**API:**
- `adminApi.getCacheKeys()` / `getCacheKeyInfo(key)` / `deleteCacheKey(key)` / `deleteCacheKeysByPattern(pattern)`

**기능:** 캐시 키 목록, glob 패턴 검색, 키 값 상세 조회, 단건/패턴 삭제

---

## 스마트 컨트랙트 관리

### `/admin/contracts` - 컨트랙트 개요

4개 핵심 컨트랙트 상태 및 권한 확인.

**표시 정보:** VotingEscrow (Team, Total Supply), Voter (Governor, Emergency Council), Minter (Team, Weekly Emission), PoolFactory (Pause 상태, Pool 수)

---

### `/admin/contracts/ter-token` - TER 토큰

TER 토큰 민터 설정 관리.

**컨트랙트 함수:** `setMinter(address)`
**읽기:** minter, name, symbol, decimals, totalSupply

---

### `/admin/contracts/voting-escrow` - VotingEscrow (veTER)

NFT 기반 투표 에스크로 관리.

**컨트랙트 함수:** `setTeam`, `setArtProxy`, `setVoter`, `setDistributor`, `setAllowedManager`, `toggleSplit`, `createManagedLockFor`

**읽기:** Team, Voter, Art Proxy, Distributor, Total Locked Supply, Total Voting Power, Permanent Lock Balance, Epoch

---

### `/admin/contracts/voter` - Voter

투표 및 게이지 시스템 관리.

**컨트랙트 함수:** `setGovernor`, `setEpochGovernor`, `setEmergencyCouncil`, `setMaxVotingNum`, `setMinter`, `setFactoryRegistry`, `whitelistToken`, `whitelistNFT`, `approveFactory`

**읽기:** Governor, Epoch Governor, Emergency Council, Minter, VotingEscrow, Factory Registry, Total Weight, Max Voting Number, Gauge Count

---

### `/admin/contracts/minter` - Minter

TER 토큰 발행 컨트롤러.

**컨트랙트 함수:** `setTeam` (2단계), `acceptTeam`, `setTeamRate` (최대 500 bps), `setRewardsDistributor`

**읽기:** Team, Pending Team, Team Rate, Rewards Distributor, Active Period, Weekly Emission, Tail Emission Rate

---

### `/admin/contracts/pool-factory` - Pool Factory

기본 AMM 풀 팩토리 설정.

**컨트랙트 함수:** `setVoter`, `setPauser`, `setFeeManager`, `setPauseState`, `setFee(isStable, fee)`, `setCustomFee(pool, fee)`

**읽기:** Voter, Pauser, Fee Manager, Pause Status, Stable/Volatile Fee, Max Fee, Pool Count

---

### `/admin/contracts/cl-factory` - CL Factory

집중 유동성 풀 팩토리 설정.

**컨트랙트 함수:** `setOwner`, `setSwapFeeModule`, `setUnstakedFeeModule`, `setDefaultUnstakedFee`, `enableTickSpacing`

**읽기:** Owner, Fee Modules, Default Unstaked Fee, Tick Spacing Config (1, 10, 50, 100, 200), CL Pool Count

---

### `/admin/contracts/rewards-distributor` - RewardsDistributor

veTER 리워드 분배 관리.

**컨트랙트 함수:** `setMinter(address)`

**읽기:** VotingEscrow, Token (TER), Minter, Start Time, Time Cursor, Last Token Time, Token Last Balance

---

### `/admin/contracts/factory-registry` - Factory Registry

승인된 풀 팩토리 관리.

**컨트랙트 함수:** `setOwner`, `setFallbackPoolFactory`, `approve` (Basic AMM), `approveCL` (Concentrated), `unapprove`

**읽기:** Owner, Fallback Pool Factory, Approved Factory Count

---

### `/admin/contracts/gauges` - Gauges

긴급 게이지 관리 (Emergency Council 권한 필요).

**컨트랙트 함수:** `killGauge(address)` - 에미션 중지, `reviveGauge(address)` - 에미션 복구

**읽기:** Emergency Council 권한 상태, Total Gauge Count, Voter Contract Address

---

## 공통 패턴

- 모든 admin 페이지는 `adminApi` 객체 또는 `wagmi` hooks를 통해 데이터 조회
- 위험한 작업 (삭제, 권한 이전)에는 확인 다이얼로그 필수
- `react-hot-toast`로 성공/에러 알림
- 반응형 그리드 레이아웃 (`grid-cols-1 lg:grid-cols-2`)
- 로딩 스켈레톤 및 스피너 애니메이션
