# Backend - Referral totalPointsEarned 하드코딩 → 실제 계산

- **Status**: DONE
- **Priority**: Medium
- **Created**: 2026-02-12
- **Completed**: 2026-02-12

## 구현 내용

`ReferralService.getOrCreateReferralCode()`에서 `totalPointsEarned`를 `'0'` 하드코딩 대신 `ReferralReward` 테이블에서 실제 합산하도록 변경.

### 변경 사항

- `ReferralReward` 리포지토리를 `ReferralService`에 주입
- `calculateTotalPointsEarned()` 메서드 추가 — `SUM(reward_points)` 쿼리
- `COALESCE` 사용으로 보상 기록이 없을 때 안전하게 `'0'` 반환

## 수정 파일

- `apps/api/src/modules/referral/services/referral.service.ts`

## Checklist

- [x] `ReferralReward` 리포지토리 주입
- [x] `calculateTotalPointsEarned()` 메서드 추가 (SUM 쿼리)
- [x] `getOrCreateReferralCode()`에서 실제 값 반환
- [x] `pnpm build` 확인

## 대안 검토

| 방식 | 장점 | 단점 |
|------|------|------|
| **ReferralReward SUM 쿼리 (채택)** | 정확한 누적 값, 기존 엔티티 활용 | 매 호출시 쿼리 실행 |
| PointBalance.referralPoints 조회 | 이미 집계된 값 | 시즌별이라 전체 누적이 아님 |
| PointHistory 집계 | 감사 추적 포함 | 쿼리 복잡, forfeited 상태 고려 필요 |
| 별도 캐시 컬럼 추가 | 빠른 읽기 | 마이그레이션 필요, 동기화 이슈 |
