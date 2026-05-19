# Pool Launch

## Overview

새로운 유동성 풀을 생성하는 3단계 위저드 페이지.

## Route

`/pool/launch`

## API / Hooks

- `useRegisteredTokens()` - 등록된 토큰 목록 조회
- `useTokenFromAddress()` - 커스텀 주소로 토큰 조회
- `useCheckPoolExists()` - 풀 존재 여부 확인
- `useCreatePool()` - 풀 생성 트랜잭션 실행

## 3단계 위저드

### Step 1: 토큰 선택

- 등록된 토큰 목록에서 선택하거나 커스텀 주소 직접 입력
- 커스텀 토큰 주소 검증 및 정보 표시 (심볼, 이름, 아이콘)

### Step 2: 풀 타입 선택

| 타입 | 설명 |
|------|------|
| Basic Volatile | 변동성 자산 풀 |
| Basic Stable | 스테이블 자산 풀 |

### Step 3: 결과 확인

- 풀이 이미 존재하면 → Deposit 페이지로 이동 안내
- 풀이 없으면 → 풀 생성 실행
- 성공 시 GiwaScan 링크 제공
- 생성 후 Deposit 페이지로 라우팅

## State

- `step` - 현재 위저드 단계 (1~3)
- `token0`, `token1` - 선택된 토큰
- `isStable` - 풀 타입 (stable/volatile)
- `customAddress0`, `customAddress1` - 커스텀 토큰 주소 입력값
- `poolExists` - 풀 존재 여부
- `isPoolCreated` - 풀 생성 완료 여부
