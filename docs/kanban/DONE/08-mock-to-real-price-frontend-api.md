# Frontend - priceApi.ts MOCK_PRICES 제거 → Backend API 호출

- **Status**: DONE
- **Priority**: High
- **Created**: 2026-02-12
- **Completed**: 2026-02-12

## 구현 내용

`priceApi.ts`의 `MOCK_PRICES` 하드코딩을 제거하고, `indexerApi.getAllTokenPrices()`를 호출하도록 전환.

### 변경 사항

- `MOCK_PRICES` 객체 완전 제거
- `getTokenPrices()` → `indexerApi.getAllTokenPrices()` 호출로 교체
- `isUsingMockPrices()` → `!isIndexerConfigured()` 반환
- API 실패 시 안전하게 0 반환 (try/catch)
- 기존 캐시 로직 유지 (1분 TTL)

### 비고

- `priceApi.ts`는 어떤 파일에서도 import하지 않는 dead code였음
- React 컴포넌트에서는 `useTokenPrices` 훅을 사용하므로 직접적인 영향 없음
- 향후 server-side에서 필요할 경우를 대비하여 파일 유지

## Checklist

- [x] `getTokenPrices()`에서 Backend API 호출하도록 교체
- [x] `MOCK_PRICES` 객체 제거
- [x] `isUsingMockPrices()` 로직 변경
- [x] `pnpm build` 확인
