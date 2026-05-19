# 레퍼럴 & 볼륨 보상 시스템 구현 계획

**작성일:** 2026-05-14  
**담당:** 개발팀  
**상태:** 계획 단계

---

## 1. 현재 구현 현황 (이미 완성된 항목)

| 항목 | 상태 | 위치 |
|------|------|------|
| 레퍼럴 코드 생성 | ✅ 완료 | `referral_codes` 테이블 |
| KOL 티어 관리 (어드민) | ✅ 완료 | `/admin/referrals` 페이지 |
| 레퍼러-레퍼리 관계 DB | ✅ 완료 | `referral_relationships` 테이블 |
| `referralPoints` 적립 컬럼 | ✅ 완료 | `point_balances.referralPoints` |
| 어드민 레퍼러 목록/상세/프로비저닝 | ✅ 완료 | `apps/web/app/admin/referrals/page.tsx` |
| 티어별 비율 (General 10% / KOL1 15% / KOL2 20%) | ✅ 완료 | `ReferralTier` 타입 |

---

## 2. 추가 구현 필요 항목

### 2-A. 유저용 레퍼럴 UI

**현재 없는 것:** 유저가 본인의 레퍼럴 코드를 확인하고 공유하는 화면

**구현 범위:**
- 본인 레퍼럴 코드 표시 + 클립보드 복사 버튼
- 초대 링크 생성 (`https://giwater.finance?ref=GIWATER-MASTER-2026`)
- 레퍼리 수 / 누적 보상 포인트 현황 표시
- 위치: 기존 `/portfolio` 또는 `/vote` 탭 내 별도 섹션 (Figma 확인 필요)

---

### 2-B. 초대 링크 처리 (첫 지갑 연결 시 관계 등록)

**흐름:**
1. 신규 유저가 `?ref=CODE` 파라미터가 포함된 링크로 접속
2. 브라우저 로컬스토리지에 레퍼럴 코드 임시 저장
3. 최초 지갑 연결(Wallet Connect) 완료 시 API 호출
4. API: `referral_code` 조회 → 레퍼러 확인 → `referral_relationships` 에 관계 기록
5. **최초 1회만** 등록 가능 (이미 관계가 있으면 무시)

**구현 위치:**
- `apps/web`: `useReferralCapture` 훅 신규 작성
- 백엔드 API: `POST /referral/claim` 엔드포인트 신규 작성

---

### 2-C. 웰컴 보너스 (5,000 포인트 × 2)

**트리거:** 레퍼리의 첫 지갑 연결 완료

**지급 대상:** 레퍼러 5,000 pts + 레퍼리 5,000 pts (각각)

**지급 방식:** 즉시 지급이 아닌 **배치 지급**
- 이벤트 기간 종료 후 일괄 지급 예정일: **2026년 8월 1일**

**구현 범위:**
- DB 테이블 신규: `welcome_bonus_queue`
  - 컬럼: `referrer_address`, `referee_address`, `created_at`, `paid_at` (nullable)
- 레퍼리 최초 연결 시 → 큐에 row 삽입
- 어드민 UI: 지급 대기 건수 표시 + "일괄 지급 실행" 버튼 추가
- 실행 시: `point_balances.referralPoints` += 5,000 (레퍼러 & 레퍼리 각각)

---

### 2-D. 볼륨 플러스 (주간 정산)

**계산 기준:**
- 레퍼리의 스왑 거래량 (USD 기준)
- 레퍼리의 LP 예치량 (USD 기준)

**정산 주기:** 매주 월요일 00:00 ~ 일요일 23:59 (KST)

**지급일:** 다음 주 목요일

> ⚠️ **보상 공식 미확정** — 비즈니스팀 확정 후 개발 착수

**구현 범위:**
- DB 테이블 신규: `volume_plus_settlements`
  - 컬럼: `week_start`, `referrer_address`, `referee_address`, `volume_usd`, `reward_points`, `reward_rate`, `paid_at`
- 주간 정산 크론잡 (매주 일요일 자정 이후 실행)
- 어드민: 볼륨 플러스 비율 설정 UI 추가 (`/admin/referrals` 내 "Rate Config" 섹션)
- 지급 비율은 티어별로 다르게 적용 (현재 General 10% / KOL1 15% / KOL2 20% 구조 활용)

---

### 2-E. 어드민 볼륨 플러스 비율 설정

**현재:** 티어별 비율이 코드에 하드코딩  
**필요:** DB에서 동적으로 설정 가능하도록 변경

**구현 범위:**
- DB 테이블 신규: `referral_rate_config`
  - 컬럼: `tier`, `rate`, `min_volume_usd`, `effective_from`
- 어드민 `/admin/referrals` 페이지에 비율 수정 폼 추가

---

## 3. 구현 우선순위

| 순서 | 항목 | 이유 |
|------|------|------|
| 1순위 | 초대 링크 처리 + 관계 등록 (2-B) | 관계 DB가 있어야 나머지가 작동함 |
| 2순위 | 유저용 레퍼럴 UI (2-A) | 유저가 코드를 공유해야 신규 유입 가능 |
| 3순위 | 웰컴 보너스 큐 + 어드민 지급 (2-C) | 지급일(8/1)까지 여유 있음 |
| 4순위 | 비율 동적 설정 (2-E) | 볼륨 플러스 공식 확정 전 인프라 준비 |
| 5순위 | 볼륨 플러스 정산 크론잡 (2-D) | 공식 확정 후 개발 시작 |

---

## 4. 확인이 필요한 사항 (비즈니스팀)

1. **볼륨 플러스 공식** — 거래량 대비 포인트 계산 방식 확정 필요
2. **유저 레퍼럴 UI 위치** — Figma 디자인에서 어느 페이지/탭에 배치할지
3. **웰컴 보너스 지급일** — 2026년 8월 1일 고정인지, 이벤트 종료 시점에 따라 변동인지
4. **최초 지갑 연결 기준** — 앱 내 첫 Wallet Connect인지, 특정 액션(스왑/예치) 완료 시점인지
5. **레퍼리의 셀프 레퍼럴 방지** — 본인이 본인 코드를 사용하는 경우 처리 방법

---

## 5. 관련 파일 위치

| 파일 | 설명 |
|------|------|
| `apps/web/app/admin/referrals/page.tsx` | 어드민 레퍼럴 관리 페이지 |
| `apps/web/lib/adminApi.ts` | 어드민 API 호출 함수 |
| `packages/shared/src/dto/admin.ts` | `ReferralOverview`, `ReferralTier` 등 타입 정의 |
