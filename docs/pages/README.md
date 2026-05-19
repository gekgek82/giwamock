# Pages Documentation

이 디렉토리는 웹 애플리케이션의 각 페이지/기능에 대한 문서를 포함합니다.

## Page Map

```
Route                          Page                    Status
/                              Home                    ✅
/swap                          Swap                    ✅
/liquidity                     Liquidity               ✅
/deposit                       Deposit                 ✅
/portfolio                     Portfolio               ✅
/pool/launch                   Pool Launch             ✅
/vote                          Vote                    🚧 (dev only)
/vote/lock                     Vote Lock               🚧 (dev only)
/vote/allocate                 Vote Allocate           🚧 (dev only)
/admin                         Admin Dashboard         ✅
/admin/tokens                  Token Management        ✅
/admin/pools                   Pool Management         ✅
/admin/seasons                 Season Management       ✅
/admin/points                  Point Management        ✅
/admin/badges                  Badge Management        ✅
/admin/blacklist               Blacklist Management    ✅
/admin/indexer                 Indexer Management      ✅
/admin/cache                   Cache Management        ✅
/admin/contracts               Contracts Overview      ✅
/admin/contracts/ter-token     TER Token               ✅
/admin/contracts/voting-escrow VotingEscrow (veTER)    ✅
/admin/contracts/voter         Voter                   ✅
/admin/contracts/minter        Minter                  ✅
/admin/contracts/pool-factory  Pool Factory            ✅
/admin/contracts/cl-factory    CL Factory              ✅
/admin/contracts/rewards-distributor  RewardsDistributor ✅
/admin/contracts/factory-registry     Factory Registry   ✅
/admin/contracts/gauges        Gauges                  ✅
```

## Directory Structure

```
docs/pages/
├── README.md                  # 이 파일
├── home/README.md             # 홈 페이지
├── swap/README.md             # 토큰 스왑
├── liquidity/README.md        # 유동성 풀 목록
├── deposit/README.md          # 유동성 예치
├── portfolio/README.md        # 포트폴리오
├── pool-launch/README.md      # 풀 생성
├── vote/README.md             # 거버넌스 투표
└── admin/README.md            # 어드민 대시보드
```

## Template

새 페이지 문서 작성 시 아래 템플릿을 사용합니다:

```markdown
# Page Name

## Overview
페이지에 대한 간략한 설명.

## Route
`/route-path`

## Components
- `ComponentName` - 설명

## API / Hooks
- `useHookName()` - 설명
- `GET /api/resource` - 설명

## Notes
추가 컨텍스트.
```
