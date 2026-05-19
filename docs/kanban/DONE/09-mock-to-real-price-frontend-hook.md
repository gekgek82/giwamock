# Frontend - useTokenPrices.ts MOCK_PRICES fallback 제거

- **Status**: DONE
- **Priority**: High
- **Created**: 2026-02-12
- **Completed**: 2026-02-12

## 구현 내용

`useTokenPrices` 훅에서 `MOCK_PRICES` fallback 경로를 제거하고, indexer API만 사용하도록 단순화.

### 변경 사항

- `MOCK_PRICES` 객체 완전 제거 (priceApi.ts와 중복이었음)
- mock fallback `useQuery` 경로 완전 제거
- `useTokenPrices()`: indexer API만 사용, 데이터 없으면 빈 객체 반환
- `useTokenPricesByAddress()`: `isIndexerConfigured()` 조건 제거 (항상 활성화)
- `useTokenPriceByAddress()`: `isIndexerConfigured()` 조건 제거
- `isMockData` 플래그: `!isIndexerConfigured()` 기반으로 판단 (API 설정 여부)
- `@tanstack/react-query` 직접 import 제거 (더 이상 mockQuery 불필요)

### 비고

- `isMockData` 인터페이스는 하위 호환성을 위해 유지
- Backend에서 이제 DEX 풀 리저브 기반 실제 가격을 제공하므로 mock 불필요

## Checklist

- [x] `MOCK_PRICES` 객체 제거
- [x] mock fallback `useQuery` 경로 제거
- [x] `isMockData` 플래그를 API 설정 기반으로 변경
- [x] 관련 훅들 정상 동작 확인 (빌드 통과)
- [x] `pnpm build` 확인
