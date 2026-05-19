# Backend - SybilDetector getFundingSource() stub → Nodit API 연동

- **Status**: DONE
- **Priority**: Medium
- **Created**: 2026-02-12
- **Completed**: 2026-02-12

## 구현 내용

`SybilDetectorService.getFundingSource()`의 stub(항상 null 반환)을 제거하고, Nodit RPC를 통한 실제 블록체인 조회로 구현.

### 변경 사항

**NoditService에 추가:**
- `getTransactionCount(address)` — `eth_getTransactionCount` RPC
- `getFirstTransactionSender(address)` — 최초 ERC20 Transfer 로그를 조회하여 트랜잭션 발신자 추적

**SybilDetectorService 변경:**
- `NoditService` 의존성 주입 활성화 (주석 해제)
- `getFundingSource()`: DB 캐시 확인 → 블록체인 조회 → ReferralLink.fundingSource에 캐싱
- `analyzeAddress()`: 트랜잭션 카운트 체크 추가 (낮은 tx count = 의심도 +15)

**AntiAbuseModule 변경:**
- `NoditModule` import 추가

### 동작 흐름

1. ReferralLink의 `fundingSource` 필드 확인 (캐시)
2. 없으면 Nodit RPC로 최초 ERC20 Transfer 로그 조회
3. 해당 트랜잭션의 `from` 주소를 funding source로 판별
4. 결과를 ReferralLink에 캐싱 (반복 조회 방지)

## 수정 파일

- `apps/api/src/modules/nodit/services/nodit.service.ts` — 2개 메서드 추가
- `apps/api/src/modules/anti-abuse/services/sybil-detector.service.ts` — 전면 리팩토링
- `apps/api/src/modules/anti-abuse/anti-abuse.module.ts` — NoditModule import 추가

## Checklist

- [x] `NoditService`에 `getTransactionCount()` 메서드 구현
- [x] `NoditService`에 `getFirstTransactionSender()` 메서드 구현
- [x] `SybilDetectorService`에 `NoditService` 의존성 주입 활성화
- [x] `getFundingSource()` 실제 블록체인 조회 구현
- [x] 결과를 DB에 캐싱 (ReferralLink.fundingSource)
- [x] `pnpm build` 확인

## 대안 검토

| 방식 | 장점 | 단점 |
|------|------|------|
| **ERC20 Transfer 로그 기반 (채택)** | 표준 JSON-RPC, 추가 API 불필요 | 순수 ETH 전송은 감지 불가 |
| Etherscan-style API | 전체 트랜잭션 이력 | Nodit에서 미지원, 별도 API 필요 |
| Internal Transaction Tracing | 정확한 ETH 추적 | `debug_traceTransaction` 필요, 무거움 |
| 프론트엔드에서 전달 | 간단 | 조작 가능, 신뢰도 낮음 |

## 제한사항

- 순수 ETH 전송(Transfer 이벤트 없음)은 현재 감지 불가
- DEX 사용자는 대부분 ERC20 Transfer가 발생하므로 실용적으로 충분
- 향후 Nodit의 enhanced API 지원 시 개선 가능
