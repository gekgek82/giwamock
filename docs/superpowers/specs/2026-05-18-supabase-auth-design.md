# Supabase Auth Integration Design

**Date:** 2026-05-18
**Scope:** Web3 (SIWE) + Web2 (X/Twitter OAuth) authentication via Supabase, admin wallet whitelist, config-service DB migration to Supabase postgres

---

## Goals

1. Add real user authentication (wallet and/or X account) on top of the existing site password gate
2. Allow users to link both a wallet address and a Twitter/X account to a single unified profile
3. Replace the password-based `AdminAuthGuard` with wallet-based admin access controlled by an env var whitelist
4. Migrate config-service's postgres database to the Supabase-hosted postgres (same project, no schema changes)

## Non-Goals

- Removing `PasswordProtection` (site-wide password gate remains)
- Protecting gateway or broker API endpoints behind auth (gateway endpoints stay public for now)
- On-chain identity or ENS resolution

---

## Architecture

```
apps/web
  ├─ @supabase/supabase-js        (session management, auto token refresh)
  ├─ AuthProvider context          (user, session, signIn, signOut, linkWallet)
  ├─ useAuth hook
  ├─ /auth/callback page           (Twitter OAuth redirect handler)
  └─ AdminWalletGuard              (replaces AdminAuthGuard)

apps/gateway
  ├─ AuthModule
  │   ├─ POST /auth/wallet/nonce   (issue SIWE nonce, stored in Redis with 5min TTL)
  │   ├─ POST /auth/wallet/verify  (verify SIWE signature → issue Supabase session)
  │   └─ POST /auth/wallet/link    (link wallet to existing X-authenticated user)
  └─ SupabaseAuthGuard             (validates Supabase JWT — for future protected routes)

Supabase project (single project)
  ├─ Auth: users table, Twitter OAuth provider enabled
  ├─ Database (postgres): public schema
  │   ├─ user_profiles              (links auth.users → wallet_address + twitter_id)
  │   └─ [config-service tables]    (banners, referral, faucets, watched-wallets)
  └─ Row Level Security disabled on config-service tables (service role only)

config-service
  └─ DATABASE_URL → Supabase postgres connection string (no other changes)
```

---

## Supabase Project Setup

- One Supabase project shared across auth and config-service DB
- Twitter OAuth provider enabled in Supabase dashboard (requires Twitter App credentials)
- Redirect URL: `https://giwater.finance/auth/callback`
- `user_profiles` table created via Supabase migration (not TypeORM):

```sql
CREATE TABLE public.user_profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address  text UNIQUE,
  twitter_id      text UNIQUE,
  created_at      timestamptz DEFAULT now()
);
```

---

## SIWE Authentication Flow

### Nonce Endpoint: `POST /auth/wallet/nonce`

```
Request:  { address: "0x..." }
Response: { nonce: "uuid-v4" }
Storage:  Redis key "siwe:nonce:{address}" → nonce, TTL 5 minutes
```

### Verify Endpoint: `POST /auth/wallet/verify`

```
Request:  { address, message, signature }

Gateway steps:
  1. Fetch nonce from Redis — 401 if missing (expired or replayed)
  2. Verify SIWE message format and signature using viem verifyMessage()
  3. Delete nonce from Redis (prevents replay)
  4. Supabase Admin SDK: find user by wallet_address in user_profiles
       If not found: create new auth.users entry + user_profiles row
  5. supabase.auth.admin.createSession(userId)
  6. If address in ADMIN_WALLET_ADDRESSES: set user metadata { role: 'admin' }

Response: { access_token, refresh_token }
```

Frontend: `supabase.auth.setSession({ access_token, refresh_token })`

### SIWE Message Format

```
giwater.finance wants you to sign in with your Ethereum account:
{address}

URI: https://giwater.finance
Version: 1
Chain ID: 91342
Nonce: {nonce}
Issued At: {ISO8601}
```

---

## X/Twitter OAuth Flow

Handled entirely by Supabase's native Twitter provider — no custom gateway endpoint needed.

```
1. Frontend: supabase.auth.signInWithOAuth({ provider: 'twitter',
     options: { redirectTo: 'https://giwater.finance/auth/callback' } })

2. User authenticates on Twitter → redirects to /auth/callback

3. /auth/callback page: supabase.auth.exchangeCodeForSession(code)
   → Supabase creates/finds user by twitter_id
   → Session auto-set in browser
```

---

## Account Linking

### Wallet → X (already logged in with wallet, wants to add X)

```
1. Frontend: supabase.auth.signInWithOAuth({ provider: 'twitter',
     options: { redirectTo: 'https://giwater.finance/auth/callback?link=true' } })
2. /auth/callback: detect link=true query param
3. Gateway: POST /auth/wallet/link-twitter
   body: { twitterUserId } (extracted from new OAuth session)
   → Merges twitter identity into existing wallet-based user_profiles row
```

Note: supabase.auth.linkIdentity() requires Supabase project to have "Allow manual linking" enabled.
If disabled, use the manual merge flow above instead.

### X → Wallet (already logged in with X, wants to add wallet)

```
1. Frontend: POST /auth/wallet/nonce (with current user's wallet address)
2. User signs SIWE message
3. Frontend: POST /auth/wallet/link
   body: { address, message, signature }
   Headers: Authorization: Bearer {access_token}

Gateway steps:
  1. Validate Supabase JWT → get userId
  2. Verify SIWE signature (nonce flow same as /verify)
  3. Check wallet_address not already claimed by another user
  4. Insert/update user_profiles.wallet_address for userId

Response: { success: true }
```

---

## Admin Auth Migration

`AdminAuthGuard` → `AdminWalletGuard`

**Env var:** `ADMIN_WALLET_ADDRESSES=0x...,0x...` (comma-separated, case-insensitive)

**Flow:**
1. Admin visits `/admin/**`
2. `AdminWalletGuard` checks for active Supabase session
3. If no session: show SIWE login button (RainbowKit ConnectButton + sign message)
4. After SIWE login: gateway sets `user.user_metadata.role = 'admin'` if address is whitelisted
5. `AdminWalletGuard` reads `user.user_metadata.role` — redirects if not `'admin'`
6. Role hierarchy (ADMIN/OPERATOR/VIEWER) can be extended via `user_metadata.adminRole` field if needed later

**Password-based `AdminAuthGuard` is removed entirely.**

---

## Config-service DB Migration

No schema or entity changes. Only the connection string changes:

```
# Before
DATABASE_URL=postgresql://user:pass@host:5432/config_db

# After
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Config-service TypeORM config uses `migrationsRun: true` — existing migrations run automatically on boot and create all tables in the `public` schema. No conflict with Supabase internal schemas (`auth`, `storage`, `realtime`).

**Migration steps:**
1. Create Supabase project
2. Run config-service migrations against Supabase postgres to create schema
3. Migrate existing data (pg_dump → pg_restore or manual SQL script)
4. Update `DATABASE_URL` in Railway config-service env vars
5. Restart config-service — verify health

---

## Environment Variables

### apps/web
```
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### apps/gateway
```
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # server-only, never expose to client
ADMIN_WALLET_ADDRESSES=0x...,0x...      # comma-separated, lowercase
```

### config-service
```
DATABASE_URL=postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres
```

---

## New Files

```
apps/web/lib/supabase.ts
apps/web/context/AuthProvider.tsx
apps/web/hooks/useAuth.ts
apps/web/app/auth/callback/page.tsx
apps/web/components/admin/AdminWalletGuard.tsx

apps/gateway/src/auth/auth.module.ts
apps/gateway/src/auth/auth.controller.ts
apps/gateway/src/auth/auth.service.ts
apps/gateway/src/auth/supabase-auth.guard.ts
apps/gateway/src/auth/siwe.types.ts
```

## Modified Files

```
apps/web/context/Providers.tsx              — wrap with AuthProvider
apps/web/components/admin/AdminAuthGuard.tsx — replaced by AdminWalletGuard
apps/gateway/src/app.module.ts              — register AuthModule
config-service: DATABASE_URL env var        — point to Supabase postgres
```

---

## Dependencies

### apps/web
```
@supabase/supabase-js
@supabase/ssr
```

### apps/gateway
```
@supabase/supabase-js
viem                  (already in monorepo — for verifyMessage)
```

---

## Error Handling

| Case | Response |
|------|----------|
| Nonce expired or not found | 401 `NONCE_EXPIRED` |
| Invalid SIWE signature | 401 `INVALID_SIGNATURE` |
| Wallet already linked to another account | 409 `WALLET_ALREADY_LINKED` |
| Admin wallet not in whitelist | 403 `NOT_ADMIN` |
| Supabase Admin SDK error | 500 (logged, generic message to client) |

---

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` is server-only (gateway env var, never `NEXT_PUBLIC_`)
- Nonce is single-use and TTL-bound (5 min) — prevents replay attacks
- Wallet addresses stored and compared lowercase
- SIWE message includes `chainId: 91342` — prevents cross-chain signature reuse
- `user_profiles` table uses `auth.users.id` as FK with `ON DELETE CASCADE`
