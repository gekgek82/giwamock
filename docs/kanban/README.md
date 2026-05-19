# Kanban Board

Task management board for this project.

---

## Status

| Status | Count |
| ------ | ----- |
| TODO   | 6     |
| DOING  | 0     |
| DONE   | 18    |

## How It Works

Tasks are managed as markdown files in three folders:

```
docs/kanban/
├── TODO/    # Tasks to be done
├── DOING/   # Tasks in progress
└── DONE/    # Completed tasks
```

### Task File Format

Each task file should follow this format:

```markdown
# Task Title

- **Status**: TODO / DOING / DONE
- **Priority**: High / Medium / Low
- **Created**: YYYY-MM-DD

## Description

What needs to be done.

## Checklist

- [ ] Step 1
- [ ] Step 2

## Notes

Any relevant context or references.
```

### Workflow

1. Create a new `.md` file in `TODO/`
2. When starting work, move it to `DOING/`
3. When finished, move it to `DONE/` and check off all items
4. Update the counts in this README

## Priority Order

### Completed (DONE/)
1. ~~01-project-setup~~ · ~~02-database-integration~~ · ~~03-define-project~~ · ~~04-define-tech-stack~~ · ~~05-define-data-models~~ · ~~05-setup-auth~~ · ~~06-build-first-feature~~ · ~~06-customize-frontend~~
2. ~~07-mock-to-real-price-backend~~ · ~~08-mock-to-real-price-frontend-api~~ · ~~09-mock-to-real-price-frontend-hook~~
3. ~~10-mock-to-real-referral-points~~ · ~~11-mock-to-real-sybil-detector~~ · ~~12-mock-to-real-lp-pair-weight~~ · ~~13-mock-to-real-swap-fallback~~ · ~~14-mock-to-real-localhost-urls~~
4. ~~15-lock-vote-backend-api~~ · ~~16-lock-vote-frontend-integration~~

### Active (TODO/)
17. `TODO/17-voting-power-decay-scheduler.md` - **[High]** Voting Power 감쇠 주기 재계산
18. `TODO/18-bribe-incentive-indexing.md` - **[High]** Bribe/Incentive 컨트랙트 인덱싱 + 클레임
19. `TODO/19-vote-pool-weight-cache.md` - **[Medium]** Vote Pool Weight 캐싱 (RPC 최적화)
20. `TODO/20-nodit-webhook-registration.md` - **[Medium]** Nodit 웹훅 구독 등록 (실시간 이벤트)
21. `TODO/REFERRAL_BONUS_POINTS.md` - Referral Bonus Points
22. `TODO/UNIVERSAL_ROUTER_FRONTEND_GUIDE.md` - Universal Router Frontend Guide
