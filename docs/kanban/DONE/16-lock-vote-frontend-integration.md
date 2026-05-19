# Lock & Vote 프론트엔드 Mock → Real 연동

- **Status**: DONE
- **Priority**: High
- **Created**: 2026-03-04
- **Completed**: 2026-03-04

## Description

Vote/Lock 페이지의 모든 mock 데이터를 실제 데이터 소스(컨트랙트 + 백엔드 API)로 교체한다. 읽기 훅(VotingEscrow 컨트랙트 multicall), API 훅(epoch/pools/points), 쓰기 훅(createLock/vote)을 생성하고, 6개 컴포넌트를 연동한다.

## 구현 내용

### 프론트엔드 API 클라이언트

- `indexerApi.getVoteEpoch()`, `indexerApi.getVotePools()` 메서드 추가
- `EpochInfo`, `VotePoolInfo`, `VotePoolsQuery`, `VotePoolsResponse` 타입 추가

### 읽기 훅 (Phase 2)

- `useVotingEscrow.ts`: useVeNFTCount, useUserLocks (3단계 multicall), useLockData
- `useVoteEpoch.ts`: epoch 데이터 API 래핑 (1분 staleTime)
- `useVotePools.ts`: vote pool 목록 API 래핑 (5분 staleTime)
- `useUserPoints.ts`: portfolioApi.getPointPositions + getLockPositions 조합

### 쓰기 훅 (Phase 3)

- `useCreateLock.ts`: needsApproval + approveToken + createLock (VotingEscrow.createLock)
- `useVote.ts`: vote (Voter.vote) + reset (Voter.reset) + notifyTransaction

### 컴포넌트 연동 (Phase 4)

- `MyPoints.tsx`: mockPointsData → useUserPoints + useAccount
- `VotingRound.tsx`: mockVotingData/mockPools → useVoteEpoch + useVotePools
- `PoolVoteCard.tsx`: useUserLocks 연동, Pool 인터페이스 업데이트
- `SelectLockModal.tsx`: MOCK_LOCKS 상수 제거
- `CreateLockForm.tsx`: 실제 TER 잔고 + approve + createLock 트랜잭션
- `AllocateVotingPower.tsx`: 실제 pool/lock 데이터 + vote 트랜잭션

## 수정/생성 파일

- `apps/web/hooks/useVotingEscrow.ts` (NEW)
- `apps/web/hooks/useVoteEpoch.ts` (NEW)
- `apps/web/hooks/useVotePools.ts` (NEW)
- `apps/web/hooks/useUserPoints.ts` (NEW)
- `apps/web/hooks/useCreateLock.ts` (NEW)
- `apps/web/hooks/useVote.ts` (NEW)
- `apps/web/types/indexer.ts` (MODIFIED)
- `apps/web/lib/indexerApi.ts` (MODIFIED)
- `apps/web/components/vote/MyPoints.tsx` (MODIFIED)
- `apps/web/components/vote/VotingRound.tsx` (MODIFIED)
- `apps/web/components/vote/PoolVoteCard.tsx` (MODIFIED)
- `apps/web/components/vote/SelectLockModal.tsx` (MODIFIED)
- `apps/web/components/vote/CreateLockForm.tsx` (MODIFIED)
- `apps/web/components/vote/AllocateVotingPower.tsx` (MODIFIED)
- `apps/web/app/vote/allocate/page.tsx` (MODIFIED - Suspense 래핑)

## Checklist

- [x] API 클라이언트 확장 (getVoteEpoch, getVotePools)
- [x] VotingEscrow 읽기 훅 (useUserLocks, useLockData)
- [x] API 데이터 훅 (useVoteEpoch, useVotePools, useUserPoints)
- [x] 컨트랙트 쓰기 훅 (useCreateLock, useVote)
- [x] 6개 컴포넌트 mock → real 교체
- [x] allocate page.tsx Suspense 래핑
- [x] `pnpm build` 성공
