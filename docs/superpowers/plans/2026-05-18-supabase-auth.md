# Supabase Auth Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SIWE (wallet) + X/Twitter OAuth authentication via Supabase, replace password-based AdminAuthGuard with wallet whitelist, and migrate config-service postgres to Supabase.

**Architecture:** Frontend uses `@supabase/supabase-js` for session management (auto-refresh). Wallet auth goes through a new `AuthModule` on `apps/gateway` which verifies SIWE signatures and mints Supabase sessions via Admin SDK. Twitter OAuth is handled natively by Supabase. Admin access is controlled by `ADMIN_WALLET_ADDRESSES` env var checked after SIWE verification.

**Tech Stack:** `@supabase/supabase-js` v2, `@supabase/ssr`, `viem` (signature verification), RainbowKit/wagmi (wallet connection, already installed in web), NestJS (gateway AuthModule)

---

## File Map

**Create:**
- `apps/gateway/src/auth/auth.module.ts`
- `apps/gateway/src/auth/auth.controller.ts`
- `apps/gateway/src/auth/auth.service.ts`
- `apps/gateway/src/auth/supabase-auth.guard.ts`
- `apps/web/lib/supabase.ts`
- `apps/web/context/AuthProvider.tsx`
- `apps/web/hooks/useAuth.ts`
- `apps/web/app/auth/callback/page.tsx`
- `apps/web/components/admin/AdminWalletGuard.tsx`

**Modify:**
- `apps/gateway/package.json` — add `@supabase/supabase-js`, `viem`
- `apps/gateway/src/app.module.ts` — register `AuthModule`
- `apps/web/package.json` — add `@supabase/supabase-js`, `@supabase/ssr`
- `apps/web/context/Providers.tsx` — wrap with `AuthProvider`
- `apps/web/components/admin/AdminAuthGuard.tsx` — replace body with `AdminWalletGuard` delegation

---

## Task 1: Install Dependencies

**Files:**
- Modify: `apps/gateway/package.json`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install gateway deps**

```bash
cd apps/gateway && pnpm add @supabase/supabase-js viem
```

Expected: packages added to `apps/gateway/package.json` dependencies.

- [ ] **Step 2: Install web deps**

```bash
cd apps/web && pnpm add @supabase/supabase-js @supabase/ssr
```

Expected: packages added to `apps/web/package.json` dependencies.

- [ ] **Step 3: Verify installs**

```bash
cd /path/to/repo && pnpm --filter @giwater/gateway exec node -e "require('@supabase/supabase-js')" && echo "gateway supabase OK"
pnpm --filter @giwater/web exec node -e "require('@supabase/supabase-js')" && echo "web supabase OK"
```

Expected: both print `OK`.

- [ ] **Step 4: Commit**

```bash
git add apps/gateway/package.json apps/web/package.json pnpm-lock.yaml
git commit -m "feat(auth): install @supabase/supabase-js and viem deps"
```

---

## Task 2: Supabase Project Setup (Manual Steps)

> These are one-time manual setup steps in the Supabase dashboard. No code changes.

- [ ] **Step 1: Create Supabase project**

  Go to https://supabase.com/dashboard → New Project. Choose a region close to Railway deployment. Note: `Project URL` and `anon key` (Settings → API) and `service_role key`.

- [ ] **Step 2: Enable Twitter OAuth provider**

  Supabase dashboard → Authentication → Providers → Twitter → Enable. Enter Twitter App's `Client ID` and `Client Secret`. Set redirect URL to `https://giwater.finance/auth/callback`.

- [ ] **Step 3: Create user_profiles table**

  Supabase dashboard → SQL Editor → run:

  ```sql
  CREATE TABLE IF NOT EXISTS public.user_profiles (
    id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_address text UNIQUE,
    twitter_id     text UNIQUE,
    created_at     timestamptz DEFAULT now()
  );

  ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "users_read_own_profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

  CREATE POLICY "service_role_all"
    ON public.user_profiles FOR ALL
    USING (true)
    WITH CHECK (true);
  ```

- [ ] **Step 4: Add env vars to gateway**

  In `apps/gateway/.env` (local) and Railway gateway service env vars:
  ```
  SUPABASE_URL=https://[ref].supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
  SUPABASE_ANON_KEY=eyJ...
  ADMIN_WALLET_ADDRESSES=0xabc...,0xdef...
  ```

- [ ] **Step 5: Add env vars to web**

  In `apps/web/.env.local` (local) and Railway web service env vars:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  ```

---

## Task 3: Gateway — AuthService + Nonce Endpoint

**Files:**
- Create: `apps/gateway/src/auth/auth.service.ts`
- Create: `apps/gateway/src/auth/auth.module.ts`
- Create: `apps/gateway/src/auth/auth.controller.ts`

- [ ] **Step 1: Create AuthService**

  Create `apps/gateway/src/auth/auth.service.ts`:

  ```typescript
  import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    InternalServerErrorException,
    Logger,
  } from '@nestjs/common';
  import { createClient, SupabaseClient } from '@supabase/supabase-js';
  import { verifyMessage } from 'viem';
  import { randomUUID } from 'crypto';

  interface NonceEntry {
    nonce: string;
    expiresAt: number;
  }

  @Injectable()
  export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly adminClient: SupabaseClient;
    private readonly anonClient: SupabaseClient;
    private readonly nonceStore = new Map<string, NonceEntry>();
    private readonly adminWallets: Set<string>;

    constructor() {
      const url = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const anonKey = process.env.SUPABASE_ANON_KEY;
      if (!url || !serviceKey || !anonKey) {
        throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY');
      }
      this.adminClient = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      this.anonClient = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const raw = process.env.ADMIN_WALLET_ADDRESSES ?? '';
      this.adminWallets = new Set(
        raw.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean),
      );
    }

    generateNonce(address: string): string {
      const nonce = randomUUID().replace(/-/g, '').slice(0, 16);
      this.nonceStore.set(address.toLowerCase(), {
        nonce,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      return nonce;
    }

    private consumeNonce(address: string): string | null {
      const key = address.toLowerCase();
      const entry = this.nonceStore.get(key);
      if (!entry || Date.now() > entry.expiresAt) {
        this.nonceStore.delete(key);
        return null;
      }
      this.nonceStore.delete(key);
      return entry.nonce;
    }

    async verifyWallet(
      address: string,
      message: string,
      signature: string,
    ): Promise<{ access_token: string; refresh_token: string }> {
      const storedNonce = this.consumeNonce(address);
      if (!storedNonce) throw new UnauthorizedException('NONCE_EXPIRED');
      if (!message.includes(`Nonce: ${storedNonce}`)) {
        throw new UnauthorizedException('INVALID_SIGNATURE');
      }

      const valid = await verifyMessage({
        address: address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
      if (!valid) throw new UnauthorizedException('INVALID_SIGNATURE');

      const walletEmail = `wallet-${address.toLowerCase()}@giwater.internal`;
      const isAdmin = this.adminWallets.has(address.toLowerCase());

      const { data: profile } = await this.adminClient
        .from('user_profiles')
        .select('id')
        .eq('wallet_address', address.toLowerCase())
        .maybeSingle();

      let userId: string;
      if (profile) {
        userId = profile.id;
      } else {
        const { data: newUser, error } = await this.adminClient.auth.admin.createUser({
          email: walletEmail,
          email_confirm: true,
          user_metadata: { wallet_address: address.toLowerCase() },
        });
        if (error || !newUser.user) {
          this.logger.error('createUser failed', error?.message);
          throw new InternalServerErrorException('USER_CREATE_FAILED');
        }
        userId = newUser.user.id;
        await this.adminClient
          .from('user_profiles')
          .insert({ id: userId, wallet_address: address.toLowerCase() });
      }

      if (isAdmin) {
        await this.adminClient.auth.admin.updateUserById(userId, {
          user_metadata: { wallet_address: address.toLowerCase(), role: 'admin' },
        });
      }

      const { data: linkData, error: linkError } =
        await this.adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: walletEmail,
        });
      if (linkError || !linkData?.properties) {
        this.logger.error('generateLink failed', linkError?.message);
        throw new InternalServerErrorException('SESSION_CREATE_FAILED');
      }

      const { data: sessionData, error: sessionError } =
        await this.anonClient.auth.verifyOtp({
          email: walletEmail,
          token: linkData.properties.email_otp,
          type: 'email',
        });
      if (sessionError || !sessionData.session) {
        this.logger.error('verifyOtp failed', sessionError?.message);
        throw new InternalServerErrorException('SESSION_EXCHANGE_FAILED');
      }

      return {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      };
    }

    async linkWallet(
      userId: string,
      address: string,
      message: string,
      signature: string,
    ): Promise<void> {
      const storedNonce = this.consumeNonce(address);
      if (!storedNonce || !message.includes(`Nonce: ${storedNonce}`)) {
        throw new UnauthorizedException('NONCE_EXPIRED');
      }

      const valid = await verifyMessage({
        address: address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
      if (!valid) throw new UnauthorizedException('INVALID_SIGNATURE');

      const { data: existing } = await this.adminClient
        .from('user_profiles')
        .select('id')
        .eq('wallet_address', address.toLowerCase())
        .maybeSingle();

      if (existing && existing.id !== userId) {
        throw new ConflictException('WALLET_ALREADY_LINKED');
      }

      await this.adminClient
        .from('user_profiles')
        .upsert({ id: userId, wallet_address: address.toLowerCase() });
    }

    async validateToken(token: string): Promise<{ userId: string; role?: string }> {
      const {
        data: { user },
        error,
      } = await this.adminClient.auth.getUser(token);
      if (error || !user) throw new UnauthorizedException('INVALID_TOKEN');
      return {
        userId: user.id,
        role: user.user_metadata?.role as string | undefined,
      };
    }
  }
  ```

- [ ] **Step 2: Create AuthController**

  Create `apps/gateway/src/auth/auth.controller.ts`:

  ```typescript
  import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Headers,
    UnauthorizedException,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation } from '@nestjs/swagger';
  import { AuthService } from './auth.service';

  @ApiTags('auth')
  @Controller('auth')
  export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('wallet/nonce')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Issue SIWE nonce for wallet address' })
    getNonce(@Body() body: { address: string }): { nonce: string } {
      const nonce = this.authService.generateNonce(body.address);
      return { nonce };
    }

    @Post('wallet/verify')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Verify SIWE signature and return Supabase session' })
    async verify(
      @Body() body: { address: string; message: string; signature: string },
    ): Promise<{ access_token: string; refresh_token: string }> {
      return this.authService.verifyWallet(body.address, body.message, body.signature);
    }

    @Post('wallet/link')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Link wallet address to existing authenticated user' })
    async linkWallet(
      @Headers('authorization') authHeader: string,
      @Body() body: { address: string; message: string; signature: string },
    ): Promise<{ success: boolean }> {
      const token = authHeader?.replace('Bearer ', '');
      if (!token) throw new UnauthorizedException('Missing token');
      const { userId } = await this.authService.validateToken(token);
      await this.authService.linkWallet(userId, body.address, body.message, body.signature);
      return { success: true };
    }
  }
  ```

- [ ] **Step 3: Create AuthModule**

  Create `apps/gateway/src/auth/auth.module.ts`:

  ```typescript
  import { Module } from '@nestjs/common';
  import { AuthController } from './auth.controller';
  import { AuthService } from './auth.service';

  @Module({
    controllers: [AuthController],
    providers: [AuthService],
    exports: [AuthService],
  })
  export class AuthModule {}
  ```

- [ ] **Step 4: Verify gateway typecheck passes**

```bash
cd apps/gateway && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/gateway/src/auth/
git commit -m "feat(gateway): add AuthModule with SIWE nonce + verify + link endpoints"
```

---

## Task 4: Gateway — SupabaseAuthGuard + Register AuthModule

**Files:**
- Create: `apps/gateway/src/auth/supabase-auth.guard.ts`
- Modify: `apps/gateway/src/app.module.ts`

- [ ] **Step 1: Create SupabaseAuthGuard**

  Create `apps/gateway/src/auth/supabase-auth.guard.ts`:

  ```typescript
  import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
  } from '@nestjs/common';
  import { AuthService } from './auth.service';
  import type { Request } from 'express';

  @Injectable()
  export class SupabaseAuthGuard implements CanActivate {
    constructor(private readonly authService: AuthService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest<Request>();
      const authHeader = request.headers['authorization'];
      const token = authHeader?.replace('Bearer ', '');
      if (!token) throw new UnauthorizedException('Missing token');
      const payload = await this.authService.validateToken(token);
      (request as Request & { supabaseUser: typeof payload }).supabaseUser = payload;
      return true;
    }
  }
  ```

- [ ] **Step 2: Register AuthModule in AppModule**

  Edit `apps/gateway/src/app.module.ts`:

  ```typescript
  import { Module } from '@nestjs/common';
  import { ConfigModule } from '@nestjs/config';
  import configuration from './config/configuration';
  import { ApiModule } from './api/api.module';
  import { AuthModule } from './auth/auth.module';
  import { EventsModule } from './events/events.module';
  import { HealthModule } from './health/health.module';
  import { HttpCacheModule } from './http-cache';
  import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
  import { RedisModule } from './redis/redis.module';
  import { WsModule } from './ws/ws.module';

  @Module({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [configuration],
      }),
      EventsModule,
      RedisModule,
      HttpCacheModule,
      RabbitmqModule,
      HealthModule,
      AuthModule,
      ApiModule,
      WsModule,
    ],
  })
  export class AppModule {}
  ```

- [ ] **Step 3: Verify typecheck**

```bash
cd apps/gateway && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/gateway/src/auth/supabase-auth.guard.ts apps/gateway/src/app.module.ts
git commit -m "feat(gateway): add SupabaseAuthGuard and register AuthModule"
```

---

## Task 5: Test Gateway Auth Endpoints

> Gateway must be running locally with Supabase env vars set.

- [ ] **Step 1: Start gateway**

```bash
cd apps/gateway && SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... ADMIN_WALLET_ADDRESSES=... pnpm dev
```

- [ ] **Step 2: Test nonce endpoint**

```bash
curl -s -X POST http://localhost:3046/auth/wallet/nonce \
  -H "Content-Type: application/json" \
  -d '{"address":"0x0000000000000000000000000000000000000001"}' | jq .
```

Expected:
```json
{ "nonce": "some16charstring" }
```

- [ ] **Step 3: Test nonce expiry (expired nonce rejected)**

```bash
# Call verify with a made-up nonce to confirm 401 response
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3046/auth/wallet/verify \
  -H "Content-Type: application/json" \
  -d '{"address":"0x0000000000000000000000000000000000000001","message":"fake","signature":"0x00"}'
```

Expected: `401`

---

## Task 6: Web — Supabase Browser Client

**Files:**
- Create: `apps/web/lib/supabase.ts`

- [ ] **Step 1: Create Supabase browser client**

  Create `apps/web/lib/supabase.ts`:

  ```typescript
  import { createBrowserClient } from '@supabase/ssr';

  let instance: ReturnType<typeof createBrowserClient> | null = null;

  export function getSupabaseClient() {
    if (!instance) {
      instance = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
    }
    return instance;
  }
  ```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/supabase.ts
git commit -m "feat(web): add Supabase browser client"
```

---

## Task 7: Web — AuthProvider Context

**Files:**
- Create: `apps/web/context/AuthProvider.tsx`

- [ ] **Step 1: Create AuthProvider**

  Create `apps/web/context/AuthProvider.tsx`:

  ```typescript
  'use client';

  import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    type ReactNode,
  } from 'react';
  import type { User, Session } from '@supabase/supabase-js';
  import { useAccount, useSignMessage } from 'wagmi';
  import { getSupabaseClient } from '@/lib/supabase';

  interface AuthContextValue {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    signInWithWallet: () => Promise<void>;
    signInWithX: () => Promise<void>;
    signOut: () => Promise<void>;
    linkWallet: () => Promise<void>;
  }

  const AuthContext = createContext<AuthContextValue | null>(null);

  function buildSiweMessage(addr: string, nonce: string): string {
    return [
      `giwater.finance wants you to sign in with your Ethereum account:`,
      addr,
      ``,
      `URI: https://giwater.finance`,
      `Version: 1`,
      `Chain ID: 91342`,
      `Nonce: ${nonce}`,
      `Issued At: ${new Date().toISOString()}`,
    ].join('\n');
  }

  export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();

    useEffect(() => {
      const supabase = getSupabaseClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      });
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      });
      return () => subscription.unsubscribe();
    }, []);

    const signInWithWallet = useCallback(async () => {
      if (!address) throw new Error('No wallet connected');
      const nonceRes = await fetch('/api/gateway/auth/wallet/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      if (!nonceRes.ok) throw new Error('Failed to get nonce');
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      const message = buildSiweMessage(address, nonce);
      const signature = await signMessageAsync({ message });

      const verifyRes = await fetch('/api/gateway/auth/wallet/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, message, signature }),
      });
      if (!verifyRes.ok) throw new Error('Wallet verification failed');
      const { access_token, refresh_token } = (await verifyRes.json()) as {
        access_token: string;
        refresh_token: string;
      };

      await getSupabaseClient().auth.setSession({ access_token, refresh_token });
    }, [address, signMessageAsync]);

    const signInWithX = useCallback(async () => {
      await getSupabaseClient().auth.signInWithOAuth({
        provider: 'twitter',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    }, []);

    const signOut = useCallback(async () => {
      await getSupabaseClient().auth.signOut();
    }, []);

    const linkWallet = useCallback(async () => {
      if (!address || !session) throw new Error('Wallet not connected or not signed in');
      const nonceRes = await fetch('/api/gateway/auth/wallet/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      if (!nonceRes.ok) throw new Error('Failed to get nonce');
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      const message = buildSiweMessage(address, nonce);
      const signature = await signMessageAsync({ message });

      const res = await fetch('/api/gateway/auth/wallet/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ address, message, signature }),
      });
      if (!res.ok) throw new Error('Wallet link failed');
    }, [address, session, signMessageAsync]);

    return (
      <AuthContext.Provider
        value={{ user, session, isLoading, signInWithWallet, signInWithX, signOut, linkWallet }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  export function useAuthContext(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
    return ctx;
  }
  ```

- [ ] **Step 2: Commit**

```bash
git add apps/web/context/AuthProvider.tsx
git commit -m "feat(web): add AuthProvider context with SIWE + X OAuth support"
```

---

## Task 8: Web — useAuth Hook

**Files:**
- Create: `apps/web/hooks/useAuth.ts`

- [ ] **Step 1: Create useAuth hook**

  Create `apps/web/hooks/useAuth.ts`:

  ```typescript
  export { useAuthContext as useAuth } from '@/context/AuthProvider';
  ```

- [ ] **Step 2: Commit**

```bash
git add apps/web/hooks/useAuth.ts
git commit -m "feat(web): add useAuth convenience hook"
```

---

## Task 9: Web — Twitter OAuth Callback Page

**Files:**
- Create: `apps/web/app/auth/callback/page.tsx`

- [ ] **Step 1: Create callback page**

  Create `apps/web/app/auth/callback/page.tsx`:

  ```typescript
  'use client';

  import { Suspense, useEffect } from 'react';
  import { useRouter, useSearchParams } from 'next/navigation';
  import { getSupabaseClient } from '@/lib/supabase';

  function CallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
      const code = searchParams.get('code');
      if (!code) {
        router.replace('/');
        return;
      }
      getSupabaseClient()
        .auth.exchangeCodeForSession(code)
        .then(() => router.replace('/'))
        .catch(() => router.replace('/'));
    }, [router, searchParams]);

    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-400">인증 중...</p>
      </div>
    );
  }

  export default function AuthCallbackPage() {
    return (
      <Suspense>
        <CallbackContent />
      </Suspense>
    );
  }
  ```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/auth/callback/
git commit -m "feat(web): add Twitter OAuth callback page"
```

---

## Task 10: Web — AdminWalletGuard

**Files:**
- Create: `apps/web/components/admin/AdminWalletGuard.tsx`
- Modify: `apps/web/components/admin/AdminAuthGuard.tsx`

- [ ] **Step 1: Create AdminWalletGuard**

  Create `apps/web/components/admin/AdminWalletGuard.tsx`:

  ```typescript
  'use client';

  import { createContext, useContext, type ReactNode } from 'react';
  import { ConnectButton } from '@rainbow-me/rainbowkit';
  import { useAccount } from 'wagmi';
  import { useAuthContext } from '@/context/AuthProvider';
  import type { AdminAuthContext, AdminRole } from '@/types/admin';

  const AdminAuthContextValue = createContext<AdminAuthContext | null>(null);

  export function useAdminAuth(): AdminAuthContext {
    const context = useContext(AdminAuthContextValue);
    if (!context) throw new Error('useAdminAuth must be used within AdminWalletGuard');
    return context;
  }

  interface AdminWalletGuardProps {
    children: ReactNode;
    requiredRole?: AdminRole;
  }

  export function AdminWalletGuard({ children }: AdminWalletGuardProps) {
    const { user, isLoading, signInWithWallet, signOut } = useAuthContext();
    const { isConnected } = useAccount();

    const isAdmin = user?.user_metadata?.role === 'admin';

    const login = async (_password: string): Promise<void> => {
      await signInWithWallet();
    };

    const contextValue: AdminAuthContext = {
      isAuthenticated: isAdmin,
      role: isAdmin ? ('ADMIN' as AdminRole) : null,
      login,
      logout: signOut,
    };

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-1000">
          <div className="text-white">Loading...</div>
        </div>
      );
    }

    if (!isAdmin) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-1000">
          <div className="bg-[#1a1a2e] p-8 rounded-2xl shadow-xl w-full max-w-md mx-4 border border-neutral-800">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary-700 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="4" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">GIWATER Admin</h1>
                <p className="text-sm text-neutral-500">관리자 지갑으로 로그인</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4">
              <ConnectButton />
              {isConnected && (
                <button
                  onClick={signInWithWallet}
                  className="w-full py-3 bg-primary-100 hover:bg-primary-200 text-neutral-1000 font-semibold rounded-xl transition-colors"
                >
                  지갑으로 서명하기
                </button>
              )}
            </div>
            <div className="mt-6 text-center">
              <a href="/" className="text-sm text-neutral-500 hover:text-primary-700 transition-colors">
                ← 메인 페이지로 돌아가기
              </a>
            </div>
          </div>
        </div>
      );
    }

    return (
      <AdminAuthContextValue.Provider value={contextValue}>
        {children}
      </AdminAuthContextValue.Provider>
    );
  }
  ```

- [ ] **Step 2: Replace AdminAuthGuard body to delegate to AdminWalletGuard**

  Replace the entire content of `apps/web/components/admin/AdminAuthGuard.tsx` with:

  ```typescript
  export { AdminWalletGuard as AdminAuthGuard, useAdminAuth } from './AdminWalletGuard';
  ```

  This keeps all existing `import { AdminAuthGuard, useAdminAuth } from '@/components/admin/AdminAuthGuard'` calls working without touching each admin page.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/admin/AdminWalletGuard.tsx apps/web/components/admin/AdminAuthGuard.tsx
git commit -m "feat(web): add AdminWalletGuard — replace password auth with SIWE wallet whitelist"
```

---

## Task 11: Web — Wire AuthProvider into Providers

**Files:**
- Modify: `apps/web/context/Providers.tsx`

- [ ] **Step 1: Add AuthProvider to provider chain**

  Edit `apps/web/context/Providers.tsx` — add `AuthProvider` import and wrap inside `RainbowKitProvider` (needs wagmi hooks to be available):

  ```typescript
  "use client";

  import "@rainbow-me/rainbowkit/styles.css";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { WagmiProvider } from "wagmi";
  import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
  import { getConfig } from "@/lib/wagmi";
  import { Toaster, ToastBar, toast } from "react-hot-toast";
  import { useState } from "react";
  import { LocaleProvider } from "@/context/LocaleContext";
  import { PasswordProtection } from "@/components/PasswordProtection";
  import { DataSourceProvider } from "@/lib/datasources/context";
  import { GatewayProvider } from "@/context/GatewayContext";
  import { GatewaySocketProvider } from "@/context/GatewaySocketProvider";
  import { AuthProvider } from "@/context/AuthProvider";

  const config = getConfig();

  export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
      () =>
        new QueryClient({
          defaultOptions: {
            queries: {
              refetchOnWindowFocus: false,
              retry: false,
            },
          },
        })
    );

    return (
      <PasswordProtection>
        <LocaleProvider>
          <GatewayProvider>
            <GatewaySocketProvider>
              <WagmiProvider config={config}>
                <QueryClientProvider client={queryClient}>
                  <RainbowKitProvider modalSize="compact">
                    <AuthProvider>
                      <DataSourceProvider>{children}</DataSourceProvider>
                    </AuthProvider>
                    <Toaster
                      position="top-right"
                      toastOptions={{
                        duration: 5000,
                        style: {
                          background: "#363636",
                          color: "#fff",
                        },
                        success: {
                          duration: 5000,
                          iconTheme: {
                            primary: "#10b981",
                            secondary: "#fff",
                          },
                        },
                        error: {
                          duration: 7000,
                          iconTheme: {
                            primary: "#ef4444",
                            secondary: "#fff",
                          },
                        },
                      }}
                    >
                      {(t) => (
                        <ToastBar toast={t}>
                          {({ icon, message }) => (
                            <>
                              {icon}
                              {message}
                              {t.type !== "loading" && (
                                <button
                                  onClick={() => toast.dismiss(t.id)}
                                  className="ml-2 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                                  aria-label="Close"
                                >
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="currentColor">
                                    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                                  </svg>
                                </button>
                              )}
                            </>
                          )}
                        </ToastBar>
                      )}
                    </Toaster>
                  </RainbowKitProvider>
                </QueryClientProvider>
              </WagmiProvider>
            </GatewaySocketProvider>
          </GatewayProvider>
        </LocaleProvider>
      </PasswordProtection>
    );
  }
  ```

- [ ] **Step 2: Verify web typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify web server responds**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3007
```

Expected: `200`

- [ ] **Step 4: Commit**

```bash
git add apps/web/context/Providers.tsx
git commit -m "feat(web): wire AuthProvider into provider tree"
```

---

## Task 12: Config-Service DB Migration to Supabase

> Migrate config-service's existing postgres data to Supabase postgres.

- [ ] **Step 1: Dump existing config-service DB**

```bash
pg_dump \
  --no-owner \
  --no-acl \
  --data-only \
  "$CONFIG_DATABASE_URL" \
  > /tmp/config-service-data.sql
```

Expected: `/tmp/config-service-data.sql` created with INSERT statements.

- [ ] **Step 2: Run config-service migrations against Supabase postgres to create schema**

  Set `DATABASE_URL` to Supabase postgres URL in config-service env, then:

```bash
cd apps/config-service && DATABASE_URL="postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres" pnpm start:prod
```

  Config-service boots with `migrationsRun: true` → TypeORM creates all tables automatically. Shut it down after successful migration log appears.

- [ ] **Step 3: Restore data to Supabase postgres**

```bash
psql "postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:5432/postgres" \
  -f /tmp/config-service-data.sql
```

  Expected: INSERT statements execute without errors.

- [ ] **Step 4: Update Railway config-service env var**

  In Railway dashboard → config-service → Variables → update `DATABASE_URL` to Supabase postgres URL. Redeploy.

- [ ] **Step 5: Verify config-service health**

```bash
curl -s https://config-service.railway.app/api/health
```

Expected: `200` with health status.

---

## Task 13: Integration Verification

- [ ] **Step 1: Verify wallet sign-in flow end-to-end**

  Add a temporary test button to `apps/web/app/page.tsx` (remove after verification):

  ```tsx
  // Temporary — remove after testing
  import { useAuth } from '@/hooks/useAuth';
  import { ConnectButton } from '@rainbow-me/rainbowkit';

  // Inside the page component:
  const { signInWithWallet, user } = useAuth();
  // ...
  <ConnectButton />
  <button onClick={signInWithWallet}>Sign in with wallet</button>
  <pre>{JSON.stringify(user?.email, null, 2)}</pre>
  ```

  1. Connect wallet → click "Sign in with wallet"
  2. Approve the signature in the wallet modal
  3. Check Supabase dashboard → Authentication → Users: new user appears with email `wallet-0x...@giwater.internal`
  4. `user?.email` in the UI shows the wallet email → session is set
  5. Remove the test button and revert `apps/web/app/page.tsx`

- [ ] **Step 2: Verify admin wallet guard**

  1. Set `ADMIN_WALLET_ADDRESSES=0x<your-test-wallet>` in gateway env
  2. Restart gateway
  3. Sign in with wallet (step 1 flow)
  4. Navigate to `/admin` — should show children without password form
  5. Sign in with a non-admin wallet → should show wallet sign-in screen

- [ ] **Step 3: Verify Twitter OAuth flow**

  1. Click "Sign in with X" (calls `signInWithX()`)
  2. Twitter auth page opens
  3. After authorization, redirect to `/auth/callback?code=...`
  4. Check Supabase dashboard → Users: new user appears with twitter provider
  5. Session set in browser

- [ ] **Step 4: Verify wallet link from X session**

  1. Sign in with X (step 3)
  2. Connect wallet
  3. Call `linkWallet()`
  4. Check Supabase `user_profiles` table: `wallet_address` populated for the Twitter user

---

## Notes

- `SUPABASE_SERVICE_ROLE_KEY` must never be in `NEXT_PUBLIC_*` env vars or committed to git
- Nonce store is in-memory per gateway instance — for multi-replica deployments, replace `nonceStore` Map in `AuthService` with the existing `ioredis` client from `apps/gateway/src/redis/`
- Twitter OAuth requires a Twitter Developer App with OAuth 2.0 enabled and callback URL set to `https://giwater.finance/auth/callback` (and `http://localhost:3007/auth/callback` for local dev)
- Supabase's `email_confirm: true` skips email verification — required for wallet-based users that use a synthetic email
