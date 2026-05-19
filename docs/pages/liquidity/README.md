# Liquidity

## Overview

사용 가능한 유동성 풀 목록을 표시하는 페이지. 풀 필터링, 검색, 통계 확인 기능을 제공한다.

## Route

`/liquidity`

## Components

- `Header`, `Footer`, `HeroBanner`
- `TokenPairIcon` - 토큰 페어 아이콘 표시
- `PoolRow` - 개별 풀 테이블 행

## API / Hooks

- `usePools()` - 풀 목록 조회
- `useGlobalStats()` - DEX 글로벌 통계 (TVL, 24h 거래량 등)
- `usePoolStatsFromIndexer()` - 개별 풀 통계 조회

## 주요 기능

### 필터 탭

| 필터 | 설명 |
|------|------|
| All | 모든 풀 |
| Concentrated | 집중 유동성 풀 |
| Basic | 기본 AMM 풀 |
| Volatile | 변동성 풀 |
| Stable | 스테이블 풀 |
| Incentivized | 인센티브 풀 |

### 풀 테이블 컬럼

- 토큰 페어 (아이콘 포함)
- 풀 전략 및 자산 유형
- 실시간 수수료율
- TVL (프로그레스 바)
- 24h 거래량
- 누적 수수료
- Swap Fee APR (7일 기준, 프로그레스 바)
- Emission APR (프로그레스 바)
- Deposit 버튼

### 기타

- 풀 이름/토큰 심볼로 검색
- "Launch Pool" 버튼 → `/pool/launch`로 이동
- 각 풀의 Deposit 버튼 → `/deposit` 페이지로 이동

## State

- `activeFilter` - 현재 선택된 필터
- `searchQuery` - 검색어
- `filteredPools` - 필터링된 풀 목록
