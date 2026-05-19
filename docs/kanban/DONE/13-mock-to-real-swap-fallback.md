# Frontend - SwapCard 기본 토큰 fallback 개선

- **Status**: DONE
- **Priority**: Low
- **Created**: 2026-02-12
- **Completed**: 2026-02-12

## 구현 내용

SwapCard에서 등록 토큰이 없을 때 zero address fallback을 제거하고 null 기반 처리로 전환.

### 변경 사항

- 기본 토큰: zero address 객체 → `null` 반환
- `hasTokens` 플래그 추가: 양쪽 토큰 모두 존재할 때만 `true`
- swap quote: `hasTokens`가 false이면 빈 문자열로 쿼리 비활성화
- input: 토큰 미로드 시 disabled
- 심볼 표시: optional chaining으로 `"---"` fallback
- TokenSelect/SwapButton: `undefined` 전달 (null safety)

## 수정 파일

- `apps/web/components/swap/SwapCard.tsx`

## Checklist

- [x] zero address fallback 제거
- [x] 토큰 미로드 시 input disabled
- [x] null safety 처리 (optional chaining)
- [x] `pnpm build` 확인
