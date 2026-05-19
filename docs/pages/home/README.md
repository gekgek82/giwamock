# Home

## Overview

메인 대시보드/랜딩 페이지. 테스트 네트워크 정보, 토큰 잔액, 주요 기능 바로가기를 표시한다.

## Route

`/`

## Components

- `Header` - 네비게이션 바
- `Footer` - 푸터
- `TokenBalances` - 사용자 토큰 잔액 표시

## 주요 기능

- **테스트 단계 배너**: 오렌지 배지로 테스트 단계임을 안내
- **Quick Actions**: Swap, Liquidity, Vote 페이지로 이동하는 바로가기 버튼
- **네트워크 정보**: GIWA Sepolia 네트워크 정보 (Chain ID: 91342, 탐색기 링크)
- **테스트 토큰 안내**: 테스트 토큰 정보 카드
- **토큰 잔액**: 사용자가 보유한 토큰 목록 표시

## Layout

- 좌측: 토큰 잔액 섹션
- 우측: Quick Actions 및 네트워크 정보

## Notes

- Client component (`"use client"`)
- `useTranslations()`으로 i18n 지원
