# Frontend - localhost fallback URL 정리 및 환경 검증

- **Status**: DONE
- **Priority**: Low
- **Created**: 2026-02-12
- **Completed**: 2026-02-12

## 구현 내용

4개 파일에서 중복 정의되던 `localhost:3044` fallback을 `config.ts`로 통합. Production에서는 env 미설정 시 빈 문자열 반환.

### 변경 사항

**config.ts:**
- `INDEXER_API_URL`을 단일 소스로 정의
- `NODE_ENV === 'production'`이면 fallback 없음 (빈 문자열)
- 개발 환경에서만 `http://localhost:3044` fallback

**indexerApi.ts, adminApi.ts, portfolioApi.ts:**
- 각자 `process.env.NEXT_PUBLIC_INDEXER_API_URL || 'http://localhost:3044'` 중복 제거
- `config.ts`의 `INDEXER_API_URL` import로 통합

## 수정 파일

- `apps/web/lib/config.ts` — 단일 소스 정의
- `apps/web/lib/indexerApi.ts` — config import
- `apps/web/lib/adminApi.ts` — config import
- `apps/web/lib/portfolioApi.ts` — config import

## Checklist

- [x] `config.ts`에 `INDEXER_API_URL`을 단일 소스로 통합
- [x] 3개 파일에서 config import로 교체
- [x] Production 빌드 시 env 미설정 시 빈 문자열 (API 호출 자연스럽게 실패)
- [x] 개발 환경에서만 localhost fallback
- [x] `pnpm build` 확인

## 대안 검토

| 방식 | 장점 | 단점 |
|------|------|------|
| **config.ts 통합 + NODE_ENV 분기 (채택)** | 중복 제거, production 안전 | 환경 변수 미설정 시 API 호출 실패 (의도된 동작) |
| throw Error on missing env | 빌드 시 즉시 감지 | 빌드 자체가 실패하여 CI 영향 |
| 런타임 경고 + fallback | 부드러운 전환 | Production에서 localhost로 요청 가능성 |
