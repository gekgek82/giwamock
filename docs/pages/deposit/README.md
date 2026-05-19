# Deposit

## Overview

선택한 풀에 유동성을 예치하는 페이지. 기본(Basic) 풀과 집중(Concentrated) 풀 두 가지 유형을 지원한다.

## Route

`/deposit?token0=...&token1=...&type=...&chain0=...&chain1=...&factory=...`

### Query Parameters

| Parameter | 설명 |
|-----------|------|
| `token0` | 첫 번째 토큰 주소 |
| `token1` | 두 번째 토큰 주소 |
| `type` | 풀 유형 |
| `chain0` | 토큰0 체인 |
| `chain1` | 토큰1 체인 |
| `factory` | 팩토리 주소 |

## Components

- `Header`, `Footer`
- `PoolInfoHeader` - 선택된 풀 정보 헤더
- `PriceRangeSelector` - 집중 유동성 풀용 가격 범위 선택
- `TokenDepositInputs` - 양쪽 토큰 수량 입력
- `ApprovalModal` - 토큰 승인 워크플로우 모달

## API / Hooks

- `usePools()` - 풀 목록 조회
- `useTokenBalance()` - 토큰 잔액 조회 (양쪽 토큰)
- `usePoolReserves()` - 풀 리저브 조회
- `useTokenAllowance()` - 토큰 allowance 확인
- `useTokenApprove()` - 토큰 approve 실행
- `useQuoteAddLiquidity()` - 예상 LP 토큰 수량 조회
- `useWriteContract()` - 유동성 추가 트랜잭션 실행
- `useWaitForTransactionReceipt()` - 트랜잭션 컨펌 대기

## 주요 기능

- **Basic Pool Deposit**: 기존 비율에 맞춰 토큰 자동 계산
- **Concentrated Pool Deposit**: 가격 범위 설정 후 예치 (현재 목업 데이터로 디자인 프리뷰)
- **토큰 승인 모달**: 멀티스텝 승인 워크플로우
- **슬리피지 설정**: Auto / Manual 모드 (기본값 0.5%)
- **초기 유동성 감지**: 풀에 유동성이 없을 경우 경고 표시
- **예상 LP 토큰 표시**: 로딩 상태 포함
- **트랜잭션 확인**: GiwaScan 탐색기 링크 제공
- **잔액/리저브 자동 갱신**: 예치 성공 후 자동 리패치

## State

- `amount0`, `amount1` - 예치할 토큰 수량
- `slippage` - 슬리피지 허용치
- `isAutoSlippage` - 자동/수동 슬리피지 토글
- `isApprovalModalOpen` - 승인 모달 표시 여부
- `needsApproval0`, `needsApproval1` - 토큰별 승인 필요 여부
