# Lock & Vote 백엔드 API + 이벤트 인덱싱

- **Status**: DONE
- **Priority**: High
- **Created**: 2026-03-04
- **Completed**: 2026-03-04

## Description

Lock & Vote 기능에 필요한 백엔드 API 모듈과 이벤트 인덱싱 파이프라인을 구축한다. Vote 모듈(epoch/pools 엔드포인트), VE/Voter 이벤트 수신 및 position state 업데이트, Portfolio API(lock/vote 포지션 읽기)를 포함한다.

## 구현 내용

### Vote API 모듈

- `VoteService`: epoch 정보 + pool 투표 통계 집계
  - `getCurrentEpoch()`: Voter.totalWeight() RPC 호출 + PoolStats 수수료 집계
  - `getVotePools(query)`: gauge 활성 pool 목록 + 개별 Voter.weights() 조회
- `VoteController`: `GET /vote/epoch/current`, `GET /vote/pools`
- `EpochInfoDto`, `VotePoolDto`, `VotePoolsQueryDto` DTO 정의

### 이벤트 인덱싱 (기존 구현, 확인 완료)

- VotingEscrow 이벤트: DEPOSIT, WITHDRAW, MERGE, SPLIT, LOCK_PERMANENT 등
- Voter 이벤트: VOTED, ABSTAINED, GAUGE_CREATED, DISTRIBUTE_REWARD 등
- `PositionStateService`: 이벤트 → `lock_positions`, `vote_positions` 테이블 업데이트
- 30초 주기 폴링 동기화 (`EventSyncService`)

### Portfolio API (기존 구현, 확인 완료)

- `GET /portfolio/:addr/positions/locks` → `LockPositionService`
- `GET /portfolio/:addr/positions/votes` → `VotePositionService`
- `GET /portfolio/:addr/positions/points` → `PointPositionService`

### Gauge Emission 갱신 (기존 구현, 확인 완료)

- `StatsService.getGaugeInfo()`: rewardRate, periodFinish, emissionApr 계산
- 2분 주기 갱신 (`stats-update.task.ts`)

## 수정/생성 파일

- `apps/api/src/modules/vote/vote.module.ts` (NEW)
- `apps/api/src/modules/vote/services/vote.service.ts` (NEW)
- `apps/api/src/modules/vote/dto/vote.dto.ts` (NEW)
- `apps/api/src/modules/api/v1/vote.controller.ts` (NEW)
- `apps/api/src/modules/api/v1/index.ts` (MODIFIED)
- `apps/api/src/modules/api/api.module.ts` (MODIFIED)
- `docs/API.md` (MODIFIED)

## Checklist

- [x] Vote 모듈 생성 (VoteService, VoteController, DTOs)
- [x] `GET /vote/epoch/current` 엔드포인트 구현
- [x] `GET /vote/pools` 엔드포인트 구현 (sortBy, search, pagination)
- [x] Voter.totalWeight(), Voter.weights() RPC 호출 연동
- [x] VE/Voter 이벤트 인덱싱 동작 확인
- [x] Portfolio lock/vote position API 동작 확인
- [x] Gauge emission 갱신 동작 확인
- [x] `pnpm build` 성공
- [x] `docs/API.md` 업데이트
