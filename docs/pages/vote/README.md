# Vote

## Overview

거버넌스 투표 시스템. 토큰 락업을 통해 투표권을 획득하고, 풀/제안에 투표권을 배분하는 기능을 제공한다.

> **🚧 개발 중**: 프로덕션에서는 `UnderDevelopment` 컴포넌트가 표시되며, 개발 모드에서만 접근 가능.

## Routes

### `/vote` - 투표 메인

투표 현황 및 사용자 투표 파워를 표시.

**Components:**
- `MyPoints` - 사용자 투표 파워/포인트 표시
- `VotingRound` - 현재/예정 투표 라운드 정보

**Layout:** 좌측 MyPoints, 우측 VotingRound 2컬럼 레이아웃

---

### `/vote/lock` - 토큰 락업

토큰을 락업하여 투표 파워를 획득.

**Components:**
- `CreateLockForm` - 토큰 락업 생성 폼

---

### `/vote/allocate` - 투표 배분

투표 파워를 각 풀/제안에 배분.

**Components:**
- `AllocateVotingPower` - 투표 파워 배분 인터페이스

**Layout:** 전체 너비 레이아웃

## Notes

- 모든 Vote 페이지는 `process.env.NODE_ENV !== 'production'` 체크를 통해 개발 환경에서만 활성화
- 프로덕션 환경에서는 `UnderDevelopment` 폴백 컴포넌트 표시
