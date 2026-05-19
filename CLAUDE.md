# Claude Code Rules

## General Rules

- **All CLAUDE.md files must be written in English.**
- **Language policy:** All source code, code comments, markdown files, and documentation must be written in **English**. All conversations and chat responses to the user must be in **Korean (한국어)**.
- **Contract project:** The smart contract source code lives at `../Giwater-Contract`. When you need contract ABIs, addresses, or other on-chain details, read from that directory in **read-only** mode — never modify files there.

## Design Philosophy

- **Decisions are for the user, not for the code.** Adding more code (new entities, fields, services) is not a downside — it is the work that needs to be done. Never treat additional code as a "con" in trade-off analysis. If a feature benefits the user, build it properly with the right abstractions, entities, and structure.

## Pre-TGE Phase

The protocol is currently in the **pre-TGE (Token Generation Event) user-experience phase**. Rewards, voting, and staking flows that will eventually be on-chain are tracked **off-chain** during this phase. When building or modifying any flow that touches rewards/voting/staking, follow these rules:

- **Gauges do not exist on-chain yet.** `Voter.gauges(pool)` returning the zero address is the **normal state**, not an error. Never treat "no gauge" as a blocker or show a "no active gauge" CTA in user-facing flows.
- **Off-chain systems replace on-chain contracts** until TGE:
  - **Voting** — `tpoint_lock_positions` + `tpoint_vote_position` tables in `apps/api/src/modules/tpoint-lock`. UI: `CreateTPointLockForm`, `MyPoints`.
  - **Points / rewards** — `point_balances` table accumulates `lpPoints`, `tradingPoints`, `referralPoints`, `emissionPoints`. No TER is minted until TGE.
  - **LP staking intent** — `lp_stake_intents` table in `apps/api/src/modules/lp-stake-intent`. Each row is an absolute LP amount (`staked_amount numeric(78,0)`, wei) per `(wallet, pool)`; no `Gauge.deposit` transaction in pre-TGE. The `LiquidityPositionService` reads this table to populate `position.stake.*` when the pool has no gauge. Submissions are signature-authenticated — the signed message must include both the pool address and the staked amount (see `verifyMessageBinding`).
- **Both paths must coexist.** When a gauge does exist (`hasGauge === true`), use the on-chain flow. When it doesn't, fall through to the off-chain path. The switch is per-pool, not a global flag — migration at TGE happens pool-by-pool as gauges are created.
- **Absolute amounts, not percentages.** When recording off-chain "how much is staked / locked / allocated", store the absolute wei amount (`numeric(78,0)`), not a percentage of the user's current balance. Percentages drift when the underlying balance changes (partial deposits / withdraws); absolute amounts stay stable.
- **Admin UI stays on-chain.** Pre-TGE rules apply to **user-facing** flows only. `/admin/**` pages (e.g. `admin/contracts/voter`) continue to call contracts directly — they are tools for deploying pre-TGE infrastructure.

## Key Rules

- **NEVER duplicate types.** Always import from `@giwater/shared`.
- **DTOs must live in `packages/shared/src/dto/`.** API request/response types (DTOs) are defined as plain TypeScript interfaces in the shared package so both the API (`apps/api`) and the client (`apps/web`) reference a single source of truth. The backend may wrap them with NestJS decorator classes, but the canonical shape always comes from `@giwater/shared`.
- **TypeORM QueryBuilder — property vs column names:** The rule depends on *where* inside the builder you're referencing a field.
  - **Simple alias.property references** in `.where()`, `.andWhere()`, `.orderBy()`, `.select('alias.prop')`, `.addSelect('alias.prop')` → **use entity property names** (e.g., `stats.tvlUsd`, `b.userAddress`). TypeORM translates them to DB column names. Raw SQL in `orderBy` causes alias resolution errors.
  - **Inside raw SQL expressions** — aggregate functions, casts, arithmetic, subqueries, any `.select('SUM(...)', 'alias')` or `.andWhere('CAST(...) > 0')` — **TypeORM does NOT translate**, so you **must use DB column names** (e.g., `SUM(b.total_points::numeric)`, not `SUM(b.totalPoints::numeric)`). Postgres folds unquoted identifiers to lowercase, so `b.totalPoints` silently becomes `b.totalpoints` which doesn't exist and fails at runtime with `column "b.totalpoints" does not exist`.
  - Rule of thumb: if your string contains `(`, `::`, a SQL keyword like `CAST`/`COALESCE`/`SUM`, or a subquery — it's raw SQL → use DB column names. Plain `alias.prop` without any surrounding SQL → entity property name.
- **Avoid N+1 queries.** Never call a DB-hitting method inside a loop over entities. Instead, batch-load all required data upfront (e.g., load the active season once, load all pools with stats in a single query) and compute results in-memory. When writing a new service method that processes a list of entities, always check that each called sub-method is not individually querying the database.

## Workflow

- Read `docs/overview/ARCHITECTURE.md` before making structural changes.
- Read `docs/kanban/README.md` for current task priorities.
- When editing `apps/broker/**` entities or broker Postgres schema, read `apps/broker/prompts/broker-db-schema-and-migrations.md` first.
- **Broker schema changes use TypeORM migrations** (`synchronize: false`; `migrationsRun: true` at boot). Workflow: edit the entity → run `pnpm broker:migration:generate src/migrations/YourName` → review the generated file → commit both. Never hand-write DDL or `ALTER TABLE` in app code.
- Update `docs/API.md` when adding/modifying endpoints.
- Move completed tasks in `docs/kanban/` (DOING -> DONE).
- Run `pnpm build` to verify shared package changes work.
- After editing `apps/web/**`, verify: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3007`
- After editing `apps/gateway/**`, verify: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3046/api/health`

## Common Errors

- **"Cannot find module './XXX.js'"** in Next.js: Stale webpack cache. Run `rm -rf apps/web/.next` and restart.
- **Shared package not found**: Rebuild with `pnpm --filter @giwater/shared build`.
