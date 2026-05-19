# Backend - 토큰 가격 Mock → 실제 가격 피드 연동

- **Status**: DONE
- **Priority**: High
- **Created**: 2026-02-12
- **Completed**: 2026-02-12

## Description

Backend의 `TESTNET_PRICES` 하드코딩 가격을 제거하고, DEX 풀 리저브 기반 가격 도출로 전환한다.

## 구현 내용

### 채택한 방식: DEX Pool Reserve 기반 가격 도출

`PriceService.deriveTokenPricesFromPools()` 메서드를 추가하여, 풀의 reserve 비율로 토큰 가격을 자동 계산:
1. 스테이블코인(USDC, USDT, DAI)을 $1로 시드
2. 각 풀에서 한쪽 토큰 가격이 알려져 있으면 반대쪽 가격을 도출
3. 최대 5회 반복하여 모든 토큰 가격 도출
4. 결과를 `tokens.price_usd` 컬럼에 저장

### 변경된 우선순위: Cache → DB → Testnet(env) → 0

기존에는 DB보다 TESTNET_PRICES가 먼저 조회되었으나, 이제 DB가 우선.

### 환경 변수 제어

- `USE_TESTNET_PRICES=true|false` — testnet 가격 fallback 활성화 여부 (기본: true)
- `STABLECOIN_SYMBOLS=USDC,USDT,DAI` — 스테이블코인으로 취급할 심볼 목록

## 수정 파일

- `apps/api/src/config/configuration.ts` — `price` 설정 추가
- `apps/api/src/modules/stats/services/price.service.ts` — 전면 리팩토링
- `apps/api/src/modules/stats/services/stats.service.ts` — 스탯 갱신 전 가격 도출 호출
- `apps/api/src/common/constants/contracts.ts` — `TESTNET_PRICES` deprecated 표시

## Checklist

- [x] 가격 피드 방식 결정: DEX 풀 리저브 기반 도출
- [x] `PriceService`에 `deriveTokenPricesFromPools()` 메서드 추가 (2분마다 스케줄러에서 실행)
- [x] `Token` 엔티티의 `priceUsd` 컬럼을 주기적으로 갱신
- [x] `getTestnetPrice()`를 `USE_TESTNET_PRICES` 환경 변수로 분기 처리
- [x] `TESTNET_PRICES`를 production에서 사용하지 않도록 변경 (DB 우선)
- [x] 가격 갱신 실패 시 기존 가격 유지 (try/catch + warn 로그)
- [x] `pnpm build` 확인

## 대안 검토 (미채택)

| 방식 | 장점 | 단점 | 적합도 |
|------|------|------|--------|
| **DEX 풀 리저브 도출 (채택)** | 외부 의존 없음, 자체 데이터 활용 | 유동성 낮은 풀에서 부정확할 수 있음 | DEX에 가장 자연스러운 방식 |
| CoinGecko API | 정확한 시장가 | API 키 필요, 테스트넷 토큰 미지원, rate limit | 메인넷 전환 후 고려 가능 |
| 온체인 Oracle (Chainlink 등) | 탈중앙화, 신뢰성 높음 | Giwa Sepolia에 Oracle 없음, 비용 발생 | 메인넷 전환 후 고려 가능 |
| Admin 수동 입력 | 간단 | 실시간 반영 불가, 관리 부담 | 보조 수단으로만 적합 |
