# Swap

## Overview

토큰 스왑 기능을 제공하는 페이지. 사용자가 보유한 토큰을 다른 토큰으로 교환할 수 있다.

## Route

`/swap`

## Components

- `Header` - 네비게이션 바
- `Footer` - 푸터
- `SwapCard` - 메인 스왑 인터페이스 (토큰 선택, 수량 입력, 스왑 실행)

## Notes

- Server component (SSR)
- 스왑 로직은 `SwapCard` 컴포넌트에 캡슐화되어 있음
- 중앙 정렬된 단일 카드 레이아웃
