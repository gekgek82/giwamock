# Vote Pool Weight 캐싱 (RPC 호출 최적화)

- **Status**: TODO
- **Priority**: Medium
- **Created**: 2026-03-04

## Description

`VoteService.getVotePools()`는 매 요청마다 각 pool에 대해 `Voter.weights(poolAddress)` RPC 호출을 수행한다. Pool 수가 증가하면 응답 시간과 RPC rate limit에 문제가 될 수 있으므로, 캐싱 레이어를 추가한다.

## 현황

- `VoteService.getVotePools()`: pool 개수만큼 `Voter.weights()` 호출 (병렬)
- `Voter.totalWeight()`: 추가 1회 호출
- 캐싱 없음 — 매 요청마다 on-chain 호출
- NoditService에 adaptive rate limiting 적용 중 (10 token bucket, 8/sec refill)

## 구현 계획

### 방안 A: Redis 캐시 (추천)

1. `VoteService`에 Redis 캐시 레이어 추가
2. Pool weight 데이터를 1~5분 TTL로 캐싱
3. `totalWeight`도 함께 캐싱
4. `VOTED`/`ABSTAINED` 이벤트 수신 시 캐시 무효화

### 방안 B: 스케줄러로 DB 저장

1. `pool_stats` 테이블에 `vote_weight` 컬럼 추가
2. 스케줄러 태스크에서 주기적으로 (2~5분) 모든 pool의 weight 갱신
3. VoteService는 DB에서 읽기만 수행

### 방안 C: 컨트롤러 레벨 HTTP 캐싱

1. `@CacheInterceptor` + `@CacheTTL(60)` 적용
2. 가장 간단하지만 캐시 무효화 제어 어려움

## Checklist

- [ ] 캐싱 방식 결정
- [ ] 구현
- [ ] 캐시 무효화 로직 (vote/abstain 이벤트 연동)
- [ ] 응답 시간 확인 (캐시 hit vs miss)
- [ ] `pnpm build` 확인

## 참고 파일

- `apps/api/src/modules/vote/services/vote.service.ts` — getVotePools() 내 RPC 호출 (line 148-167)
- `apps/api/src/modules/nodit/services/nodit.service.ts` — rate limiting 설정
- `apps/api/src/modules/stats/services/stats-cache.service.ts` — 기존 Redis 캐시 패턴
