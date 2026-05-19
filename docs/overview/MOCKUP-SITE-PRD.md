# Giwater Frontend Mockup Site PRD

## 1. Problem Statement

Giwater currently has production-oriented frontend, backend, gateway, indexer, and contract integration code for an AMM DEX. For demos, design reviews, investor/customer walkthroughs, and pre-TGE UX validation, the team needs a frontend-only mockup site that behaves like the live DEX without requiring a running backend, database, indexer, RPC reliability, real token balances, or on-chain transactions.

The existing `apps/web/lib/mocks.ts` already supports REST mock responses through `NEXT_PUBLIC_MOCK_DATA=true`, and some read-only on-chain values are mocked. The main gap is that all API surfaces and all contract-related interactions must be simulated end-to-end, including wallet signatures and transaction-like success states, while guaranteeing that no real transaction is created.

## 2. Goals

- Enable the full public Giwater frontend to run as a deterministic mockup from `apps/web` with no backend, gateway, indexer, Redis, PostgreSQL, or live contract dependency.
- Let users complete core AMM workflows visually: connect wallet, swap, provide/remove liquidity, stake/unstake, lock tPOINT, vote, add incentives, claim rewards/points, and inspect portfolio/history.
- Preserve the current UI and route structure so the mockup site demonstrates the same product users will see in production.
- Simulate wallet signing and contract transactions with realistic pending/success/failure states, but never submit a real transaction or calldata to a wallet/RPC.
- Keep mock mode isolated behind explicit configuration so production/live development behavior remains unchanged.

## 3. Non-Goals

- Build a new landing page or separate prototype UI. The mockup must reuse the existing app surface.
- Execute real blockchain writes, send native tokens, send ERC-20 approvals, or call contract write methods in mock mode.
- Replace the backend architecture. Mock mode is a frontend preview layer, not a backend rewrite.
- Guarantee financially accurate AMM execution. Mock math should be plausible and internally consistent, but the goal is UX validation.
- Mock `/admin/**` as a production admin console replacement. Admin can be included for demo completeness, but user-facing DEX flows are the priority.

## 4. Current Codebase Baseline

Frontend:
- Next.js app in `apps/web`, running on port `3007`.
- Public routes include `/`, `/swap`, `/liquidity`, `/deposit`, `/withdraw`, `/stake`, `/unstake`, `/earn`, `/portfolio`, `/promotion`, `/pool/launch`, and `/vote/**`.
- Admin routes exist under `/admin/**`.

Mock infrastructure already present:
- `NEXT_PUBLIC_MOCK_DATA=true` activates `apps/web/lib/mocks.ts`.
- `apiFetch` checks `getMockResponse(...)` before real network fetches.
- Mock handlers already cover gateway contracts, spot pairs/tokens, swap routes, vote epoch/pools, portfolio overview/positions/transactions, tPOINT locks/votes, LP stake intent, vote incentive, referral, claim rewards, and claim points.
- On-chain read helper mocks exist for token balances, mock token detection, and pool reserves.

Known gap:
- `apps/web/lib/mocks.ts` explicitly notes that wallet `writeContract` calls such as approve/addLiquidity are not fully mocked today. Users can reach wallet prompts, but the prompt can fail because mock contract addresses do not exist on-chain. The PRD requires this to become a full no-tx simulator.

## 5. Personas

- Demo viewer: wants to experience the product without setting up testnet funds or infrastructure.
- Product/design reviewer: wants to validate flows, states, copy, and responsiveness.
- Frontend developer: wants deterministic data for local UI work.
- Business stakeholder: wants a polished clickable DEX walkthrough that looks operational.

## 6. User Stories

- As a demo viewer, I want to open the site and see realistic protocol stats, pools, tokens, charts, and portfolio data so that the product feels live.
- As a wallet user, I want to connect or use a mock wallet identity so that wallet-gated screens are accessible during demos.
- As a trader, I want to enter swap amounts, review quotes, approve if needed, and see pending/success/failure screens so that I can evaluate the swap UX.
- As an LP, I want to deposit and withdraw liquidity through volatile/basic and concentrated liquidity flows so that I can inspect all liquidity UX states.
- As a pre-TGE participant, I want to stake/unstake LP intent and lock/increase/extend/merge tPOINT positions using signatures so that the off-chain model is demonstrable.
- As a voter, I want to select locks, allocate voting power, reset votes, and add incentives so that the ve(3,3) journey is visible.
- As a portfolio user, I want to claim points/rewards and see updated-looking transaction history so that account management flows feel complete.
- As a developer, I want unmatched API calls and unmocked contract calls to be visible in development logs so that mock coverage gaps are easy to close.

## 7. Requirements

### P0: Mock Mode Configuration

- Add a single explicit mock mode contract for the frontend.
- Mock mode must be enabled by `NEXT_PUBLIC_MOCK_DATA=true`.
- In mock mode, the app must not require backend services, gateway services, indexer services, config-service, Redis, PostgreSQL, or a live RPC for the public UX.
- In non-mock mode, existing real API/RPC behavior must remain unchanged.

Acceptance criteria:
- Given `NEXT_PUBLIC_MOCK_DATA=true`, when `pnpm dev:web` runs, public pages render without backend services.
- Given `NEXT_PUBLIC_MOCK_DATA=false`, when the app runs, existing API and wagmi paths are used.
- Given an API route lacks a mock handler, the developer console clearly identifies the method/path.

### P0: API Mock Coverage

- All frontend API clients must resolve through mock handlers in mock mode.
- Required mocked surfaces include:
  - gateway/broker: contracts, spot tokens, spot pairs, swap routes, referral.
  - portfolio: overview, liquidity/lock/vote/point positions, transactions, claimable rewards, claims.
  - pre-TGE: tPOINT lock, increase, extend, merge, poke, unlock, vote, reset vote.
  - LP staking intent: set, list, clear.
  - vote incentives: add, list by wallet, list by pool.
  - admin/config endpoints used by public flows, if surfaced outside `/admin/**`.
- Mock responses must match shared DTO shapes from `@giwater/shared` where DTOs exist.

Acceptance criteria:
- Given mock mode, no public page emits a failed fetch because the backend is offline.
- Given a user completes a public action, the UI receives a plausible success response.
- Given pagination/filter/sort parameters, mock responses preserve the expected response shape.

### P0: Wallet and Contract Write Simulator

- Contract writes must be intercepted in mock mode before any real `writeContract`, `sendTransaction`, or wallet transaction request is made.
- The simulator must support:
  - ERC-20 approval.
  - Permit2 approval where used.
  - swap execution.
  - basic pool add/remove liquidity.
  - concentrated liquidity mint/increase/decrease/collect/remove flows used by the UI.
  - staking/unstaking paths that currently branch between on-chain gauge and off-chain intent.
  - reward/fee/point claim paths.
  - token faucet/mint flows only if included in mock demo scope.
- Simulated writes must return mock transaction hashes and expose pending, success, error, retry, and reset states.
- Simulated writes must never open a wallet transaction confirmation prompt.

Acceptance criteria:
- Given mock mode, clicking Swap completes with a mock tx hash and success state.
- Given mock mode, clicking Approve completes in-app without a wallet tx prompt.
- Given mock mode, no browser wallet receives `eth_sendTransaction`.
- Given mock mode, intentional failure scenarios can be triggered for QA.

### P0: Signature Simulator

- Signature-authenticated off-chain actions must remain visually signed but must not require a real signature when demo mode is configured to use a mock wallet.
- Supported signed flows:
  - create/increase/extend/merge/poke/unlock tPOINT locks.
  - tPOINT vote/reset.
  - LP stake intent set/clear.
  - add vote incentive.
- If using a real connected wallet in mock mode, signing may be allowed as a non-transactional action, but the product must also support a no-wallet demo path.

Acceptance criteria:
- Given mock demo wallet mode, signed actions proceed with deterministic mock signatures.
- Given real wallet mock mode, sign prompts may appear only for message signing, never for transactions.
- Given a rejected signature, the UI shows the existing error/retry state.

### P0: Stateful Mock Session

- Mock actions should update a session-local state model so completed actions appear reflected in the UI.
- State can live in memory or `localStorage`; it must resettable.
- Minimum state updates:
  - token balances after approvals/swaps/deposits/withdrawals.
  - portfolio transactions after mock actions.
  - LP stake intents after stake/unstake.
  - tPOINT locks and votes after lock/vote actions.
  - claimable points/rewards after claims.

Acceptance criteria:
- Given a successful mock swap, a transaction row appears in portfolio/history.
- Given a mock claim, claimable amount is reduced or marked claimed.
- Given a page refresh, mock state either persists consistently or resets according to documented behavior.

### P1: Scenario Controls

- Provide developer/demo controls for scenario selection.
- Scenarios should include:
  - default active user.
  - disconnected wallet.
  - empty portfolio.
  - high-balance LP.
  - failed transaction.
  - slow pending transaction.
  - no gauge/pre-TGE pool.
  - gauge exists/post-TGE-style pool.

Acceptance criteria:
- Given a scenario query/localStorage flag, the app loads corresponding mock state.
- Given failure scenario, transaction-like actions show fail states without real side effects.

### P1: Admin Demo Coverage

- `/admin/**` may remain real by default because current project rules keep admin on-chain.
- If mock admin is needed for demos, add explicit admin mock mode that prevents all real writes.
- Admin mock scope should include dashboard stats, pools, tokens, banners, points, seasons, indexer, cache, referrals, and contract management views.

Acceptance criteria:
- Given admin mock mode, admin pages render without backend services.
- Given admin contract pages in mock mode, write buttons simulate tx states without real wallet tx prompts.

### P2: Visual QA and Demo Polish

- Provide deterministic seed data that exercises all major UI states.
- Ensure desktop and mobile views for swap, liquidity, vote, and portfolio have non-empty data.
- Add a visible but unobtrusive mock-mode indicator in non-production builds.

Acceptance criteria:
- Desktop and mobile smoke screenshots show populated UI.
- No public page has obvious loading dead-ends in mock mode.

## 8. Technical Approach

Recommended architecture:
- Keep `apps/web/lib/mocks.ts` as the REST fixture registry, but split large fixture/state helpers if it becomes hard to maintain.
- Add a mock transaction service, for example `apps/web/lib/mockWallet.ts` or `apps/web/lib/mockTransactions.ts`, that centralizes transaction hashes, delays, failures, and local state updates.
- Add mock implementations for read/write data sources under `apps/web/lib/datasources/**`, selected by `MOCK_DATA_ENABLED` in `DataSourceProvider`.
- Wrap write hooks behind local abstractions where needed instead of calling `useWriteContract` directly in feature components.
- Introduce a mock wallet/session provider only for mock mode. It should supply address, connection state, signatures, tx hashes, and action logs.

Important constraint:
- Do not monkey-patch provider globals in a way that could leak into live mode. Mock behavior must be selected through explicit code paths gated by `MOCK_DATA_ENABLED`.

## 9. Success Metrics

- 100% of public routes render without backend/RPC when mock mode is enabled.
- 100% of P0 user actions complete with success/failure UI states without real transactions.
- 0 calls to `eth_sendTransaction` in mock mode during public flow QA.
- Less than 2 seconds perceived completion time for standard simulated actions, unless slow-pending scenario is selected.
- Zero unmatched public API mock warnings during smoke QA.

## 10. Test and Verification Plan

- Unit tests:
  - `apiClient` mock matching.
  - mock transaction service success/failure/pending behavior.
  - mock state reducers for balances, transactions, locks, votes, and claims.
- Integration tests:
  - swap happy path and failure path.
  - deposit and withdraw happy paths.
  - tPOINT lock/vote flow.
  - portfolio claim flow.
- Manual/Playwright smoke:
  - render `/`, `/swap`, `/liquidity`, `/deposit`, `/withdraw`, `/stake`, `/unstake`, `/portfolio`, `/vote`.
  - verify no backend server is running.
  - verify no real wallet transaction prompt appears.

## 11. Phasing

### Phase 1: Public Read Mock Completion

- Audit all public pages for API/RPC dependencies.
- Add missing REST handlers and read data-source mocks.
- Ensure pages render with backend offline.

### Phase 2: No-Tx Write Simulator

- Centralize contract write and send transaction behavior.
- Convert swap, approval, deposit, withdraw, stake, unstake, claim flows to use mock write paths in mock mode.
- Add mock hashes, pending timing, failure injection, and transaction history updates.

### Phase 3: Signature and Pre-TGE State

- Add mock signature path for tPOINT, LP stake intent, voting, and incentive flows.
- Persist session-local state for locks, votes, intents, claims, and portfolio changes.

### Phase 4: Demo Scenarios and QA

- Add scenario selector/config.
- Add smoke tests and screenshots.
- Decide whether `/admin/**` needs full mock coverage.

## 12. Open Questions

- Product: Should mock mode support a no-wallet one-click demo identity, or should users still connect a real wallet for address display?
- Product: Is `/admin/**` part of the demo requirement, or should the mockup focus only on public DEX flows?
- Engineering: Should mock state persist in `localStorage` by default, or reset on refresh for deterministic demos?
- Engineering: Should failure/slow scenarios be controlled by query params, localStorage, or an internal dev panel?
- Design: Should mock mode be visibly labeled in the UI during stakeholder demos?

