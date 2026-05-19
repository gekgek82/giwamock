# Nodit 웹훅 구독 등록 (실시간 이벤트 수신)

- **Status**: TODO
- **Priority**: Medium
- **Created**: 2026-03-04

## Description

현재 VE/Voter 이벤트는 30초 주기 폴링으로만 수신된다. Nodit API에 웹훅을 등록하여 실시간 이벤트 수신으로 전환하면 지연을 줄일 수 있다.

## 현황

- **웹훅 수신측**: 구현 완료
  - `WebhookController`: POST `/webhook/nodit` (HMAC 서명 검증)
  - `WebhookService`: 이벤트 파싱 → `EventProcessorService`로 라우팅
- **웹훅 등록측**: 미구현
  - Nodit API에 웹훅 구독을 등록하는 코드 없음
  - 현재는 `EventSyncService`가 30초마다 폴링
- **폴링은 동작 중**: 이벤트 손실 없이 동기화되고 있음 (백업으로 유지 가능)

## 구현 계획

1. Nodit 웹훅 구독 API 클라이언트 구현
   - `createWebhookSubscription(contractAddress, eventTopics, webhookUrl)`
   - `listWebhookSubscriptions()`
   - `deleteWebhookSubscription(subscriptionId)`
2. 앱 시작 시 또는 Admin API로 구독 등록
   - VotingEscrow: DEPOSIT, WITHDRAW, MERGE, SPLIT 등
   - Voter: VOTED, ABSTAINED, GAUGE_CREATED 등
   - RewardsDistributor: CLAIMED
3. 폴링을 백업/보조 역할로 유지 (주기를 5분으로 늘릴 수 있음)
4. 중복 이벤트 처리 방어 (txHash + logIndex 기반 idempotency)

## Checklist

- [ ] Nodit 웹훅 API 문서 확인
- [ ] 웹훅 구독 관리 서비스 구현
- [ ] VotingEscrow, Voter, RewardsDistributor 구독 등록
- [ ] 중복 이벤트 방어 확인
- [ ] 폴링 주기 조정 (30초 → 5분)
- [ ] `pnpm build` 확인

## Notes

- 폴링만으로도 현재 정상 동작하므로 우선순위는 Medium
- 메인넷 런칭 시에는 실시간성을 위해 웹훅 필수
- 웹훅 URL은 공개 접근 가능해야 함 (개발 환경에서는 ngrok 등 필요)

## 참고 파일

- `apps/api/src/modules/webhook/controllers/webhook.controller.ts` — 수신측 (구현 완료)
- `apps/api/src/modules/webhook/services/webhook.service.ts` — 이벤트 파싱
- `apps/api/src/modules/indexer/services/event-sync.service.ts` — 폴링 동기화
- `apps/api/src/modules/nodit/services/nodit.service.ts` — Nodit RPC 클라이언트
