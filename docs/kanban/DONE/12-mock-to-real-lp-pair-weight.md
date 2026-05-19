# Backend - LP Score PAIR_WEIGHT_BY_TIER 하드코딩 → 설정으로 이동

- **Status**: DONE
- **Priority**: Low
- **Created**: 2026-02-12
- **Completed**: 2026-02-12

## 구현 내용

`PAIR_WEIGHT_BY_TIER` 상수를 환경 변수 기반 설정으로 전환. 코드 수정 없이 tier별 가중치 변경 가능.

### 변경 사항

- `PAIR_WEIGHT_BY_TIER` 하드코딩 상수 제거
- `ConfigService` 주입하여 인스턴스 변수 `pairWeightByTier`로 대체
- 환경 변수: `PAIR_WEIGHT_TIER1`, `PAIR_WEIGHT_TIER2`, `PAIR_WEIGHT_TIER3`
- 기본값: Tier1=1.5, Tier2=1.0, Tier3=0.5 (기존과 동일)
- 기동 시 로그로 현재 설정된 가중치 출력

### 환경 변수

```env
PAIR_WEIGHT_TIER1=1.5    # Core: meme/partnership pair
PAIR_WEIGHT_TIER2=1.0    # Major: Major-Stable pair
PAIR_WEIGHT_TIER3=0.5    # Stable: Stable-Stable pair (또는 0.2 — 기획팀 확인 필요)
```

## 수정 파일

- `apps/api/src/config/configuration.ts` — `points` 설정 추가
- `apps/api/src/modules/score/services/lp-score.service.ts` — ConfigService 사용

## Checklist

- [x] 환경 변수로 tier별 가중치 설정 가능
- [x] 기본값은 기존과 동일 (하위 호환)
- [x] `pnpm build` 확인

## 대안 검토

| 방식 | 장점 | 단점 |
|------|------|------|
| **환경 변수 (채택)** | 마이그레이션 불필요, 즉시 적용 | 변경 시 재기동 필요 |
| DB SeasonConfig 확장 | Admin UI에서 변경 가능 | 마이그레이션 필요, 복잡도 증가 |
| 별도 설정 테이블 | 유연한 관리 | 오버엔지니어링, 3개 값에 과함 |

## Notes

- Tier 3 가중치 (0.5x vs 0.2x) 결정은 기획팀 확인 후 env 변수만 변경하면 됨
- 시즌별 가중치 차별화가 필요해지면 DB 이동을 재검토
