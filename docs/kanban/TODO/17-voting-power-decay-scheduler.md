# Voting Power 감쇠(Decay) 주기 재계산

- **Status**: TODO
- **Priority**: High
- **Created**: 2026-03-04

## Description

`lock_positions.votingPower`은 이벤트 수신 시점에 1회만 기록되고 이후 감쇠가 반영되지 않는다. VotingEscrow의 선형 감쇠 모델(4년 → 0)에 맞춰 주기적으로 재계산하는 스케줄러를 구현한다.

## 현황

- `lock_positions` 테이블에 `voting_power`, `lock_end` 컬럼 존재
- `PositionStateService.handleVEDeposit()`에서 초기 votingPower 계산 로직 존재
- 계산식: `amount * (timeRemaining / maxLockTime)` (maxLockTime = 4년)
- 현재 DB에 저장된 votingPower는 **이벤트 발생 시점 기준**이며 시간 경과 후 부정확

## 구현 계획

### 방안 A: 스케줄러로 DB 갱신 (추천)

1. `LockDecayTask` 생성 (1시간 또는 4시간 주기)
2. 만료되지 않은 모든 lock 조회
3. `votingPower = lockedAmount * max(0, lockEnd - now) / MAX_LOCK_TIME` 재계산
4. 만료된 lock은 `isExpired = true`, `votingPower = 0` 업데이트
5. Permanent lock은 감쇠 없이 유지

### 방안 B: 읽기 시점 계산

- Portfolio API에서 DB 값 대신 `lockEnd` 기반으로 실시간 계산
- DB 업데이트 불필요하지만, Vote API에서도 동일 로직 필요

## Checklist

- [ ] 감쇠 계산 방식 결정 (스케줄러 vs 읽기 시점)
- [ ] 스케줄러 태스크 생성 (`apps/api/src/modules/scheduler/tasks/`)
- [ ] 만료 lock 자동 비활성화
- [ ] Permanent lock 예외 처리
- [ ] Portfolio API 응답에서 votingPower 정확성 확인
- [ ] `pnpm build` 확인

## 참고 파일

- `apps/api/src/database/entities/lock-position.entity.ts` — 엔티티 스키마
- `apps/api/src/modules/indexer/services/position-state.service.ts` — 초기 계산 로직
- `apps/api/src/modules/portfolio/services/lock-position.service.ts` — 포트폴리오 읽기
- `apps/web/hooks/useVotingEscrow.ts` — 프론트엔드는 컨트랙트에서 직접 읽으므로 영향 없음
