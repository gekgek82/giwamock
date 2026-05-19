# Bribe/Incentive 컨트랙트 인덱싱 + 클레임

- **Status**: TODO
- **Priority**: High
- **Created**: 2026-03-04

## Description

현재 Vote 관련 incentive(뇌물) 데이터가 인덱싱되지 않아 모든 곳에서 0으로 표시된다. `BribeVotingReward`와 `FeesVotingReward` 컨트랙트 이벤트를 인덱싱하고, 사용자가 투표 보상(수수료+인센티브)을 클레임할 수 있도록 한다.

## 현황

- `BribeVotingRewardAbi`, `FeesVotingRewardAbi` — `@giwater/shared`에 ABI 존재, 백엔드에서 **미사용**
- `VoteService`: `totalIncentives = 0` 하드코딩 (vote.service.ts:74)
- `VotePoolDto.incentives`: 항상 `"0.00"` 반환
- `vote_positions.estimated_incentives`: 항상 0
- `ClaimService.prepareVoteClaim()`: `RewardsDistributor.claim()` 만 구현, bribe/fee voting reward 클레임 없음

## 구현 계획

### Phase 1: 이벤트 인덱싱

1. `EVENT_TOPICS`에 BribeVotingReward, FeesVotingReward 이벤트 토픽 추가
   - `RewardNotified(address reward, uint amount)`
   - `ClaimRewards(address user, address reward, uint amount)`
2. `EventSyncService`에 각 gauge의 voting reward 주소 동기화 추가
   - `Voter.gaugeToBribe(gauge)` → BribeVotingReward 주소
   - `Voter.gaugeToFees(gauge)` → FeesVotingReward 주소
3. `EventProcessorService`에 이벤트 핸들러 추가
4. Incentive 데이터를 저장할 테이블/컬럼 추가 (pool별 epoch별 incentive 합계)

### Phase 2: API 연동

1. `VoteService.getVotePools()`: incentives 필드에 실제 데이터 반환
2. `VoteService.getCurrentEpoch()`: totalIncentives 실제 집계
3. `PositionStateService.handleVoted()`: estimated_incentives 계산

### Phase 3: 클레임

1. `ClaimService`에 bribe/fee voting reward 클레임 로직 추가
   - `BribeVotingReward.getReward(tokenId, tokens[])`
   - `FeesVotingReward.getReward(tokenId, tokens[])`
2. Portfolio claim API에서 vote reward 포함

## Checklist

- [ ] BribeVotingReward, FeesVotingReward ABI 분석
- [ ] 이벤트 토픽 상수 추가
- [ ] Voter.gaugeToBribe/gaugeToFees RPC 호출 추가
- [ ] EventProcessorService 핸들러 구현
- [ ] Incentive 데이터 스키마 설계 (DB 테이블/컬럼)
- [ ] VoteService에 실제 incentive 데이터 연동
- [ ] ClaimService에 bribe/fee 클레임 트랜잭션 준비 추가
- [ ] 프론트엔드 incentives 표시 확인 (현재 0 → 실제 값)
- [ ] `pnpm build` 확인

## 참고 파일

- `packages/shared/src/abis/json/BribeVotingReward.json` — Bribe ABI
- `packages/shared/src/abis/json/FeesVotingReward.json` — Fees ABI
- `apps/api/src/modules/indexer/services/event-processor.service.ts` — 이벤트 처리
- `apps/api/src/modules/indexer/services/position-state.service.ts` — 상태 업데이트
- `apps/api/src/modules/vote/services/vote.service.ts` — incentives 하드코딩 위치
- `apps/api/src/modules/portfolio/services/claim.service.ts` — 클레임 서비스
