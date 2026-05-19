---
name: giwater-mock-api
description: Add or update mock API responses for the Giwater-App apps/web (Next.js) project. Use whenever the user asks to "mock the /foo endpoint", "add a mock for X", "make /bar return fake data", "I need mock data for the Y page so I can preview the design", "fake out the swap quote", "mock the pool list", or anything else that means "give me a canned response from one of our HTTP APIs so I don't need the backend running." Fires for both adding new handlers and amending existing ones in apps/web/lib/mocks.ts. Do NOT use for unit-test fixtures (those live next to *.test.ts files), wagmi/on-chain mocks (those hit RPCs directly, not apiFetch), or for disabling the mock system (just flip NEXT_PUBLIC_MOCK_DATA in .env.local).
---

# Giwater mock API skill

The Giwater-App web frontend has a single-file mock data system that intercepts every HTTP call at the `apiFetch` layer. When the user wants design-preview data without a running backend, your job is to add (or edit) one entry in `apps/web/lib/mocks.ts`.

This skill exists because every "please mock X" request follows the same shape — find the API method, look up the DTO, append a handler — and re-deriving that each time is wasted effort.

## The mental model in 30 seconds

```
User flow / hook
   ↓
React Query queryFn
   ↓
gatewayBrokerApi.* / adminApi.* / portfolioApi.*     ← three API clients
   ↓
apiFetch(config, endpoint, options)                  ← single chokepoint in lib/apiClient.ts
   ↓
getMockResponse(...)  ← reads NEXT_PUBLIC_MOCK_DATA
   ↓
   ├─ matched handler in lib/mocks.ts  →  canned data, no network
   └─ no match                          →  real fetch (logs a warn in dev)
```

The whole mock layer is one file: `apps/web/lib/mocks.ts`. Keep it that way. **Do not** create per-feature mock files, per-API folders, or `__mocks__` directories. Greppability across the whole mock surface in one file is the whole point.

## Process for "mock the X endpoint"

Follow these steps every time. Don't skip — even the read steps matter, because the file conventions (helper builders, fixture constants, ordering) are part of what keeps the mock data internally consistent.

### 1. Read the existing mock layer first

Always read these before writing:

- `apps/web/lib/mocks.ts` — current handler list, fixture constants (`MOCK_TOKEN_ADDR`, `MOCK_POOL_ADDR`, `MOCK_SPOT_TOKENS`, `MOCK_SPOT_PAIRS`), helper builders (`buildMockSpotToken`, `buildMockSpotPair`), and the `getMockResponse` matcher. You're appending to this file; match its conventions.
- `apps/web/lib/apiClient.ts` — only to confirm the interception point hasn't changed (look for the `getMockResponse` call near the top of `apiFetch`). One-time check; skip on subsequent edits.

### 2. Locate the API method being mocked

Open the relevant client and find the method the user named (or the closest match to the page they want to preview):

| Client file                        | Base URL                                   | Use case                                                                               |
| ---------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `apps/web/lib/gatewayBrokerApi.ts` | `/api/gateway` (proxied to gateway origin) | Public user-facing reads: pools, tokens, swap routes, contracts                        |
| `apps/web/lib/adminApi.ts`         | `/api/admin`                               | `/admin/**` pages: seasons, points, badges, pool curation, banners, cache, indexer ops |
| `apps/web/lib/portfolioApi.ts`     | `INDEXER_API_URL` (legacy `apps/api`)      | Wallet portfolio: positions, locks, votes, point earnings, tPOINT, LP stake intents    |

From the method, extract three things you need to write the handler:

- **HTTP method** — usually GET; some are POST/PUT/DELETE
- **URL path after the baseUrl** — e.g. `/spot-pairs/recently-created`, `/admin/season/${id}`, `/portfolio/${wallet}/positions/liquidity`. This is what `getMockResponse` matches against (after stripping the `/api/{gateway,admin,broker-admin}` proxy prefix).
- **Return DTO type** — the `<T>` in `fetchJson<T>(...)` or the explicit `Promise<X>` return type

### 3. Look up the DTO shape

DTOs typically live in `packages/shared/src/dto/` (re-exported from `@giwater/shared`). Some admin/portfolio types live in `apps/web/types/admin.ts` or `apps/web/types/portfolio.ts`. Open the file and read the interface so you know the required fields.

The DTOs are usually big — dozens of fields, most of which the UI doesn't display. You don't need to populate them all meaningfully; you just need to satisfy TypeScript. The pattern in mocks.ts is:

- Identify which fields the consumer actually reads (grep for the field name from the page/hook side, or just look at the existing `buildMockSpotToken` / `buildMockSpotPair` helpers — they show which fields matter)
- Fill those with realistic values
- Fill everything else with zero / empty string / empty array

### 4. Append a handler to the `handlers` array in `lib/mocks.ts`

The handler shape:

```ts
{
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string | RegExp,
  description: string,
  respond: (ctx: { method, path, query, pathParams, body }) => unknown,
}
```

**Exact path match (most cases):**

```ts
{
  method: "GET",
  path: "/some/endpoint",
  description: "clientName.methodName — what this returns",
  respond: ({ query }): SomeResponseDto => ({
    offset: Number(query.get("offset") ?? 0),
    limit: Number(query.get("limit") ?? 200),
    total: SOME_FIXTURE.length,
    items: SOME_FIXTURE,
  }),
},
```

**Path with parameters (e.g. `/admin/season/:id`):**

```ts
{
  method: "GET",
  path: /^\/admin\/season\/(\d+)$/,
  description: "adminApi.getSeasonById",
  respond: ({ pathParams }): SeasonConfig => {
    const id = Number(pathParams[0]);
    return { id, /* ... */ } satisfies SeasonConfig;
  },
},
```

The RegExp must match the **whole** path — `getMockResponse` checks `m[0] !== path` and rejects partial matches. Use `^...$` anchors.

**Annotating the return type:** use either `respond: (ctx): SomeDto => ({...})` or `({...}) satisfies SomeDto`. Either works; pick whichever reads better. The return type annotation is what gives you TS validation that you've satisfied the DTO contract.

**Position in the array:** order matters because first match wins. For exact-path strings, order is irrelevant (each path appears at most once). For RegExps, put more specific patterns before more general ones if they could overlap.

### 5. Reuse fixture constants

`mocks.ts` already has top-level constants for the shared identities used across handlers:

- `MOCK_TOKEN_ADDR` — `{ WETH, USDC, USDT, GIWA, TER, cbBTC, DAI, ... }`. Token contract addresses used by every handler that mentions a token. **Always reuse these** — don't invent new ones. The mock pool list and the mock token list cross-reference these addresses, and if a new handler invents a different "WETH" address, the UI will treat them as different tokens.
- `MOCK_POOL_ADDR` — pool/pair contract addresses, same idea.
- `MOCK_SPOT_TOKENS` / `MOCK_SPOT_PAIRS` — the token and pool fixtures that are already populated. If you're mocking a related endpoint (e.g. "get pool by address"), look up the data from these arrays rather than re-typing values.

If you need a new identity (e.g. mocking a season ID, a badge ID, a TPoint lock ID), add it to a small named constant near the top of the file so future handlers can reference it.

### 6. Verify

From `apps/web`:

```bash
pnpm exec tsc --noEmit         # must produce no NEW errors from your edit
                               # (there are pre-existing admin pool errors unrelated to mocks;
                               #  use `git stash` to confirm they're not caused by your change)
curl -s -o /dev/null -w "%{http_code}" http://localhost:7003   # expect 200
```

If the user has a specific page they want to preview, hit that URL too (e.g. `curl ... http://localhost:3007/swap`).

You don't need to start the dev server yourself — assume it's already running, and only report failure if curl indicates otherwise.

## Common pitfalls

**`isGatewayConfigured()` short-circuits before apiFetch.** Several `gatewayBrokerApi.*` methods throw early if `isGatewayConfigured()` returns false — that check happens before `apiFetch` is called, so a mock handler can't rescue it. In the current codebase `isGatewayConfigured()` always returns `true`, so this is almost never a problem, but if a user reports "my mock isn't firing", check this first.

**`apiUpload` is NOT hooked into the mock layer.** Only `apiFetch` calls `getMockResponse`. File/image uploads (`adminApi.uploadTokenIcon`, banner images, badge images, etc.) hit the network even when `NEXT_PUBLIC_MOCK_DATA=true`. If the user needs to preview an admin upload flow, you'll need to also patch `apiUpload` in `lib/apiClient.ts` to consult the mock layer (or add a wrapper). Flag this to the user before doing it — it's a real change to a shared helper, not just adding a handler.

**`indexerApi` (the legacy `apps/api` NestJS backend) is deprecated.** Per `memory/project_apps_api_deprecated.md`, the in-repo NestJS backend is being replaced by gateway + broker. If you're asked to mock something that currently routes through `lib/indexerApi.ts` (e.g. `useTokenSearch` → `indexerApi.searchTokens`), prefer:

1. **Better**: migrate the hook to the gateway parity equivalent (e.g. `gatewayBrokerApi.searchTokens` already exists and calls `/spot-tokens/by-symbol/:symbol` or `/spot-tokens/by-address/:address`), then mock the gateway endpoint.
2. **Acceptable short-term**: add a mock for the indexer URL (the path normalizer in `getMockResponse` strips absolute origins, so `http://localhost:3044/foo` matches the same handler as a relative `/foo`). But flag this as legacy and suggest the migration.

**DTO field obesity.** Most DTOs in `@giwater/shared` have 30–60 fields. Only a handful drive the visible UI. Don't burn time researching what every field means — populate the ones the consumer reads (grep the consumer for the field name if unsure) and zero/empty the rest. The existing `buildMockSpotToken` / `buildMockSpotPair` show the pattern. If you find yourself adding a new DTO, add a `buildMockX` helper next to those, especially if more than one handler will return that DTO.

**The flag must be on.** Mocks only run when `NEXT_PUBLIC_MOCK_DATA=true` in `apps/web/.env.local`. If the user says "I added the mock but the page still hits the backend", first check `.env.local`, then restart the dev server (env changes don't hot-reload). Document this once and move on.

**No handler for path X → falls through.** `getMockResponse` logs a dev-console warning when no handler matches, then falls through to the real fetch. If the user has the backend offline, this surfaces as a real network error in the UI. When you finish adding the requested handler, also scan the page's network tab (or, more practically, ask the user) for any _other_ endpoints the page calls — those will need handlers too if the page should work offline. Common companions:

- A page that calls `gatewayBrokerApi.listSpotPairsRecentlyCreated` almost always also needs `/contracts` and `/spot-tokens/recently-created` mocked (because `usePools` is rarely used in isolation — the surrounding UI uses `useContractAddresses`).
- Anything that shows wallet balances or USD prices touches `useTokenBalances` (wagmi, not mockable here) and `useTokenPrices` (legacy indexer — see above).
- Portfolio pages touch many `portfolioApi.*` endpoints; check the consuming hook to see which ones.

## What NOT to mock through this skill

- **Unit-test fixtures** (`*.test.ts` files) — those have their own local stubs near the test code; don't pull them into `lib/mocks.ts`.
- **wagmi / on-chain reads** — `useReadContract`, `useBalance`, `useWaitForTransactionReceipt`, etc. hit the RPC node directly. They don't go through `apiFetch`, so mock handlers can't see them. If the user wants on-chain mocks, that's a different problem (wagmi connectors / chain config), not this skill.
- **Disabling mocks** — just set `NEXT_PUBLIC_MOCK_DATA=false` in `apps/web/.env.local`. Don't delete handlers to "disable" them.
- **Removing a handler permanently** — that's a normal edit, not really a "mock skill" task; just delete the entry.

## Quick reference: file paths

- Mock registry: `apps/web/lib/mocks.ts`
- Interception point: `apps/web/lib/apiClient.ts` (`apiFetch`, ~line 70)
- API clients: `apps/web/lib/gatewayBrokerApi.ts`, `apps/web/lib/adminApi.ts`, `apps/web/lib/portfolioApi.ts`
- DTOs: `packages/shared/src/dto/*.ts` (re-exported from `@giwater/shared`)
- Admin/portfolio web-only types: `apps/web/types/admin.ts`, `apps/web/types/portfolio.ts`
- Flag config: `apps/web/lib/config.ts` (`MOCK_DATA_ENABLED`), `apps/web/.env.local` (`NEXT_PUBLIC_MOCK_DATA`)

## Example — full handler for a hypothetical "get badge by id"

User says: _"Mock the admin badge detail page so I can preview without the admin backend."_

1. Open `adminApi.ts`, find `getBadgeDefinition(id: number): Promise<BadgeDefinition>` — calls `GET /admin/badge-definition/${id}`, which `adminApi` proxies through `/api/admin/admin/badge-definition/${id}` → normalized to `/badge-definition/${id}` after the prefix strip... wait, actually `adminApi.adminProxyPath` strips a leading `/admin` from the endpoint before proxying. So the path that hits `apiFetch` is `/api/admin/badge-definition/${id}`, which the normalizer strips to `/badge-definition/${id}`. **Always trace the proxy mapping in the client file** — it's not always literal.

2. Look up `BadgeDefinition` in `apps/web/types/admin.ts` — note the required fields.

3. Append:

```ts
{
  method: "GET",
  path: /^\/badge-definition\/(\d+)$/,
  description: "adminApi.getBadgeDefinition",
  respond: ({ pathParams }): BadgeDefinition => ({
    id: Number(pathParams[0]),
    name: "Mock badge",
    description: "Preview-only badge fixture",
    category: "season",
    /* ...zero-fill remaining required fields... */
  }),
},
```

4. Run `pnpm exec tsc --noEmit` — if any required field is missing, TS will say so.

5. Tell the user: handler added, plus any related endpoints they may also want mocked (here, probably `getBadgeDefinitions` for the list page).

That's the whole loop. Keep handlers boring, keep mocks.ts the single source of truth, and reuse fixture constants so the mocked world stays internally consistent.
