# Faucet Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist deployed TokenFaucet addresses in the API database so `/admin/faucets` auto-loads all known faucets on page mount instead of requiring manual address entry each time.

**Architecture:** A new `token_faucets` table in the `apps/api` Postgres database stores faucet address + token metadata. Three admin REST endpoints (list, register, delete) are added under `GET|POST|DELETE /api/admin/faucet`. The frontend fetches the list on mount, POSTs after deploying a new faucet, and offers a "Save to registry" button after manually loading an unregistered faucet.

**Tech Stack:** NestJS + TypeORM (api), Next.js + adminApi fetch helper (web), TypeScript DTOs in `@giwater/shared`

---

## File Map

| Action | File |
|--------|------|
| Modify | `packages/shared/src/dto/admin.ts` — add faucet DTO section |
| Create | `apps/api/src/database/entities/token-faucet.entity.ts` |
| Modify | `apps/api/src/database/entities/index.ts` — export `TokenFaucet` |
| Create | `apps/api/src/modules/faucet/services/faucet.service.ts` |
| Create | `apps/api/src/modules/faucet/faucet.module.ts` |
| Create | `apps/api/src/modules/admin/controllers/faucet-admin.controller.ts` |
| Modify | `apps/api/src/modules/admin/admin.module.ts` — import `FaucetModule` |
| Modify | `apps/web/types/admin.ts` — re-export new faucet types |
| Modify | `apps/web/lib/adminApi.ts` — add `getFaucets`, `registerFaucet`, `deleteFaucet` |
| Modify | `apps/web/app/admin/faucets/page.tsx` — auto-load + save to registry |

---

### Task 1: Add faucet DTOs to shared package

**Files:**
- Modify: `packages/shared/src/dto/admin.ts`

- [ ] **Step 1: Append faucet DTO section to the bottom of `packages/shared/src/dto/admin.ts`**

```typescript
// ============================================================================
// Faucet Registry Types
// ============================================================================

export interface AdminFaucetInfo {
  faucetAddress: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  createdAt: string;
}

export interface FaucetListResponse {
  faucets: AdminFaucetInfo[];
  total: number;
}

export interface RegisterFaucetRequest {
  faucetAddress: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
}
```

- [ ] **Step 2: Build shared package to verify types compile**

```bash
pnpm --filter @giwater/shared build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/dto/admin.ts
git commit -m "feat(shared): add faucet registry DTOs"
```

---

### Task 2: Create TokenFaucet entity and register it

**Files:**
- Create: `apps/api/src/database/entities/token-faucet.entity.ts`
- Modify: `apps/api/src/database/entities/index.ts`

- [ ] **Step 1: Create `apps/api/src/database/entities/token-faucet.entity.ts`**

```typescript
import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('token_faucets')
export class TokenFaucet {
  @PrimaryColumn({ name: 'faucet_address', type: 'varchar', length: 42 })
  faucetAddress: string;

  @Column({ name: 'token_address', type: 'varchar', length: 42 })
  tokenAddress: string;

  @Column({ name: 'token_name', type: 'varchar', length: 100 })
  tokenName: string;

  @Column({ name: 'token_symbol', type: 'varchar', length: 20 })
  tokenSymbol: string;

  @Column({ name: 'token_decimals', type: 'integer', default: 18 })
  tokenDecimals: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

- [ ] **Step 2: Export `TokenFaucet` from `apps/api/src/database/entities/index.ts`**

Add this line at the end of the exports in `index.ts`:

```typescript
export { TokenFaucet } from './token-faucet.entity';
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/database/entities/token-faucet.entity.ts \
        apps/api/src/database/entities/index.ts
git commit -m "feat(api): add TokenFaucet entity"
```

---

### Task 3: Create FaucetService

**Files:**
- Create: `apps/api/src/modules/faucet/services/faucet.service.ts`

- [ ] **Step 1: Create `apps/api/src/modules/faucet/services/faucet.service.ts`**

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenFaucet } from '../../../database/entities';
import {
  AdminFaucetInfo,
  FaucetListResponse,
  RegisterFaucetRequest,
} from '@giwater/shared';

@Injectable()
export class FaucetService {
  constructor(
    @InjectRepository(TokenFaucet)
    private readonly faucetRepository: Repository<TokenFaucet>,
  ) {}

  async findAll(): Promise<FaucetListResponse> {
    const faucets = await this.faucetRepository.find({
      order: { createdAt: 'DESC' },
    });
    return {
      faucets: faucets.map((f) => this.toDto(f)),
      total: faucets.length,
    };
  }

  async register(dto: RegisterFaucetRequest): Promise<AdminFaucetInfo> {
    const normalized = dto.faucetAddress.toLowerCase();
    const existing = await this.faucetRepository.findOne({
      where: { faucetAddress: normalized },
    });
    if (existing) {
      throw new ConflictException(
        `Faucet ${normalized} is already registered`,
      );
    }
    const faucet = this.faucetRepository.create({
      faucetAddress: normalized,
      tokenAddress: dto.tokenAddress.toLowerCase(),
      tokenName: dto.tokenName,
      tokenSymbol: dto.tokenSymbol,
      tokenDecimals: dto.tokenDecimals,
    });
    const saved = await this.faucetRepository.save(faucet);
    return this.toDto(saved);
  }

  async remove(faucetAddress: string): Promise<void> {
    const normalized = faucetAddress.toLowerCase();
    const faucet = await this.faucetRepository.findOne({
      where: { faucetAddress: normalized },
    });
    if (!faucet) {
      throw new NotFoundException(`Faucet ${normalized} not found`);
    }
    await this.faucetRepository.delete({ faucetAddress: normalized });
  }

  private toDto(f: TokenFaucet): AdminFaucetInfo {
    return {
      faucetAddress: f.faucetAddress,
      tokenAddress: f.tokenAddress,
      tokenName: f.tokenName,
      tokenSymbol: f.tokenSymbol,
      tokenDecimals: f.tokenDecimals,
      createdAt: f.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/faucet/services/faucet.service.ts
git commit -m "feat(api): add FaucetService"
```

---

### Task 4: Create FaucetModule

**Files:**
- Create: `apps/api/src/modules/faucet/faucet.module.ts`

- [ ] **Step 1: Create `apps/api/src/modules/faucet/faucet.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenFaucet } from '../../database/entities';
import { FaucetService } from './services/faucet.service';

@Module({
  imports: [TypeOrmModule.forFeature([TokenFaucet])],
  providers: [FaucetService],
  exports: [FaucetService],
})
export class FaucetModule {}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/faucet/faucet.module.ts
git commit -m "feat(api): add FaucetModule"
```

---

### Task 5: Create FaucetAdminController and register in AdminModule

**Files:**
- Create: `apps/api/src/modules/admin/controllers/faucet-admin.controller.ts`
- Modify: `apps/api/src/modules/admin/admin.module.ts`

- [ ] **Step 1: Create `apps/api/src/modules/admin/controllers/faucet-admin.controller.ts`**

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { FaucetService } from '../../faucet/services/faucet.service';
import {
  AdminFaucetInfo,
  FaucetListResponse,
  RegisterFaucetRequest,
} from '@giwater/shared';

@ApiTags('Faucet Admin')
@Controller('admin/faucet')
export class FaucetAdminController {
  constructor(private readonly faucetService: FaucetService) {}

  @Get()
  @ApiOperation({ summary: 'List all registered faucets' })
  @ApiResponse({ status: 200, description: 'List of registered faucets' })
  async findAll(): Promise<FaucetListResponse> {
    return this.faucetService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Register a deployed faucet' })
  @ApiResponse({ status: 201, description: 'Faucet registered' })
  @ApiResponse({ status: 409, description: 'Faucet already registered' })
  async register(@Body() dto: RegisterFaucetRequest): Promise<AdminFaucetInfo> {
    return this.faucetService.register(dto);
  }

  @Delete(':address')
  @ApiOperation({ summary: 'Remove a faucet from the registry' })
  @ApiParam({ name: 'address', type: String, description: 'Faucet contract address' })
  @ApiResponse({ status: 200, description: 'Faucet removed' })
  @ApiResponse({ status: 404, description: 'Faucet not found' })
  async remove(@Param('address') address: string): Promise<{ message: string }> {
    await this.faucetService.remove(address);
    return { message: 'Faucet removed from registry' };
  }
}
```

- [ ] **Step 2: Register `FaucetModule` and `FaucetAdminController` in `apps/api/src/modules/admin/admin.module.ts`**

Add to the imports array:
```typescript
import { FaucetModule } from '../faucet/faucet.module';
import { FaucetAdminController } from './controllers/faucet-admin.controller';
```

Add `FaucetModule` to the `imports` array and `FaucetAdminController` to the `controllers` array.

- [ ] **Step 3: Verify the API compiles**

```bash
pnpm --filter @giwater/api exec tsc --noEmit -p tsconfig.json 2>&1 | head -30
```

Expected: no errors (or exits 0).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/admin/controllers/faucet-admin.controller.ts \
        apps/api/src/modules/admin/admin.module.ts
git commit -m "feat(api): add FaucetAdminController with GET/POST/DELETE /api/admin/faucet"
```

---

### Task 6: Add faucet methods to adminApi and web types

**Files:**
- Modify: `apps/web/types/admin.ts`
- Modify: `apps/web/lib/adminApi.ts`

- [ ] **Step 1: Re-export new faucet types in `apps/web/types/admin.ts`**

In the existing `export type { ... } from '@giwater/shared'` block (around line 9), add:

```typescript
  AdminFaucetInfo,
  FaucetListResponse,
  RegisterFaucetRequest,
```

- [ ] **Step 2: Add faucet methods to `apps/web/lib/adminApi.ts`**

In the `AdminApiClient` class (near the other similar CRUD methods like `getTokens` / `createToken`), add:

```typescript
  async getFaucets(): Promise<FaucetListResponse> {
    return apiFetch<FaucetListResponse>(this.config, '/api/admin/faucet');
  }

  async registerFaucet(data: RegisterFaucetRequest): Promise<AdminFaucetInfo> {
    return apiFetch<AdminFaucetInfo>(this.config, '/api/admin/faucet', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteFaucet(address: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(
      this.config,
      `/api/admin/faucet/${address}`,
      { method: 'DELETE' },
    );
  }
```

Also add the import of these types at the top of `adminApi.ts` where other admin types are imported:

```typescript
  AdminFaucetInfo,
  FaucetListResponse,
  RegisterFaucetRequest,
```

- [ ] **Step 3: Verify web types compile**

```bash
pnpm --filter @giwater/web exec tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/types/admin.ts apps/web/lib/adminApi.ts
git commit -m "feat(web): add faucet registry methods to adminApi"
```

---

### Task 7: Update faucets admin page to auto-load and save to registry

**Files:**
- Modify: `apps/web/app/admin/faucets/page.tsx`

- [ ] **Step 1: Replace the full contents of `apps/web/app/admin/faucets/page.tsx`**

```typescript
"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { parseUnits, formatUnits, isAddress } from "viem";
import type { Abi } from "viem";
import { TokenFaucetAbi, ERC20Abi } from "@giwater/shared/abis";
import { TOKEN_FAUCET_BYTECODE } from "@giwater/shared/constants";
import toast from "react-hot-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/Card";
import { Input } from "@/components/admin/ui/Input";
import { Button } from "@/components/admin/ui";
import { useConnectModal, useChainModal } from "@rainbow-me/rainbowkit";
import { GIWASCAN_URL, GIWA_SEPOLIA_CHAIN_ID } from "@/lib/config";
import { adminApi } from "@/lib/adminApi";

const FAUCET_ABI = TokenFaucetAbi as Abi;
const ERC20_ABI = ERC20Abi as Abi;

const SET_MINTER_ABI = [
  {
    type: "function",
    name: "setMinter",
    inputs: [{ name: "newMinter", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const satisfies Abi;

interface FaucetInfo {
  faucetAddress: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  mintAmount: bigint;
  cooldownSeconds: bigint;
}

interface FaucetEntry {
  info: FaucetInfo | null;
  loading: boolean;
  error: string | null;
  editMintTokens: string;
  editCooldownSeconds: string;
  saving: "mint" | "cooldown" | null;
  inRegistry: boolean;
  savingToRegistry: boolean;
}

function formatCooldown(seconds: bigint): string {
  const s = Number(seconds);
  if (s >= 86400 && s % 86400 === 0) return `${s / 86400}d`;
  if (s >= 3600 && s % 3600 === 0) return `${s / 3600}h`;
  if (s >= 60 && s % 60 === 0) return `${s / 60}m`;
  return `${s}s`;
}

export default function FaucetsAdminPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { openChainModal } = useChainModal();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const wrongChain = isConnected && chainId !== GIWA_SEPOLIA_CHAIN_ID;

  const [deployTokenAddress, setDeployTokenAddress] = useState("");
  const [deployCooldown, setDeployCooldown] = useState("86400");
  const [isDeployingNew, setIsDeployingNew] = useState(false);

  const [addressInput, setAddressInput] = useState("");
  const [faucets, setFaucets] = useState<Record<string, FaucetEntry>>({});

  const updateEntry = useCallback(
    (addr: string, patch: Partial<FaucetEntry>) => {
      setFaucets((prev) => ({
        ...prev,
        [addr]: { ...prev[addr], ...patch },
      }));
    },
    [],
  );

  const loadFaucet = useCallback(
    async (addr: string, inRegistry = false) => {
      if (!publicClient) {
        toast.error("RPC client not available.");
        return;
      }
      updateEntry(addr, { loading: true, error: null });
      try {
        const [tokenAddr, mintAmt, cooldown] = await Promise.all([
          publicClient.readContract({
            address: addr as `0x${string}`,
            abi: FAUCET_ABI,
            functionName: "token",
          }) as Promise<`0x${string}`>,
          publicClient.readContract({
            address: addr as `0x${string}`,
            abi: FAUCET_ABI,
            functionName: "mintAmount",
          }) as Promise<bigint>,
          publicClient.readContract({
            address: addr as `0x${string}`,
            abi: FAUCET_ABI,
            functionName: "cooldownSeconds",
          }) as Promise<bigint>,
        ]);

        const [tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
          publicClient.readContract({
            address: tokenAddr,
            abi: ERC20_ABI,
            functionName: "name",
          }) as Promise<string>,
          publicClient.readContract({
            address: tokenAddr,
            abi: ERC20_ABI,
            functionName: "symbol",
          }) as Promise<string>,
          publicClient.readContract({
            address: tokenAddr,
            abi: ERC20_ABI,
            functionName: "decimals",
          }) as Promise<number>,
        ]);

        const info: FaucetInfo = {
          faucetAddress: addr,
          tokenAddress: tokenAddr,
          tokenName,
          tokenSymbol,
          tokenDecimals,
          mintAmount: mintAmt,
          cooldownSeconds: cooldown,
        };

        updateEntry(addr, {
          info,
          loading: false,
          inRegistry,
          editMintTokens: formatUnits(mintAmt, tokenDecimals),
          editCooldownSeconds: cooldown.toString(),
        });
      } catch (e) {
        updateEntry(addr, {
          loading: false,
          error: e instanceof Error ? e.message : "Failed to load faucet",
        });
      }
    },
    [publicClient, updateEntry],
  );

  const addToList = useCallback(
    (addr: string, inRegistry = false) => {
      const normalized = addr.toLowerCase();
      setFaucets((prev) => {
        if (prev[normalized]) return prev;
        return {
          ...prev,
          [normalized]: {
            info: null,
            loading: false,
            error: null,
            editMintTokens: "",
            editCooldownSeconds: "",
            saving: null,
            inRegistry,
            savingToRegistry: false,
          },
        };
      });
      void loadFaucet(normalized, inRegistry);
    },
    [loadFaucet],
  );

  // Auto-load registered faucets on mount
  useEffect(() => {
    adminApi.getFaucets().then((res) => {
      for (const f of res.faucets) {
        addToList(f.faucetAddress, true);
      }
    }).catch(() => {
      toast.error("Failed to load faucet registry.");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveToRegistry = useCallback(
    async (addr: string) => {
      const entry = faucets[addr];
      if (!entry?.info) return;
      updateEntry(addr, { savingToRegistry: true });
      try {
        await adminApi.registerFaucet({
          faucetAddress: entry.info.faucetAddress,
          tokenAddress: entry.info.tokenAddress,
          tokenName: entry.info.tokenName,
          tokenSymbol: entry.info.tokenSymbol,
          tokenDecimals: entry.info.tokenDecimals,
        });
        updateEntry(addr, { inRegistry: true, savingToRegistry: false });
        toast.success("Saved to registry.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to save.";
        if (msg.includes("already registered")) {
          updateEntry(addr, { inRegistry: true, savingToRegistry: false });
        } else {
          toast.error(msg.slice(0, 200));
          updateEntry(addr, { savingToRegistry: false });
        }
      }
    },
    [faucets, updateEntry],
  );

  const handleRemoveFromRegistry = useCallback(
    async (addr: string) => {
      try {
        await adminApi.deleteFaucet(addr);
        updateEntry(addr, { inRegistry: false });
        toast.success("Removed from registry.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to remove.");
      }
    },
    [updateEntry],
  );

  const handleDeployNew = useCallback(async () => {
    if (!walletClient || !publicClient) {
      toast.error("Wallet or RPC client not available.");
      return;
    }
    const tokenAddr = deployTokenAddress.trim();
    if (!isAddress(tokenAddr)) {
      toast.error("Invalid token address.");
      return;
    }
    const cooldownSecs = parseInt(deployCooldown.trim(), 10);
    if (!Number.isFinite(cooldownSecs) || cooldownSecs <= 0) {
      toast.error("Cooldown must be a positive integer (seconds).");
      return;
    }

    setIsDeployingNew(true);
    try {
      const faucetHash = await walletClient.deployContract({
        abi: FAUCET_ABI,
        bytecode: TOKEN_FAUCET_BYTECODE,
        args: [tokenAddr, BigInt(cooldownSecs)],
      });
      toast.success("Faucet deploy submitted; waiting for confirmation…");

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: faucetHash,
        confirmations: 1,
      });
      const faucetAddr = receipt.contractAddress;
      if (!faucetAddr) {
        toast.error("Receipt did not include a faucet address.");
        return;
      }

      toast.success("Faucet deployed. Calling setMinter on token…");

      const setMinterHash = await walletClient.writeContract({
        address: tokenAddr as `0x${string}`,
        abi: SET_MINTER_ABI,
        functionName: "setMinter",
        args: [faucetAddr],
      });
      await publicClient.waitForTransactionReceipt({ hash: setMinterHash, confirmations: 1 });

      toast.success(
        <span>
          Faucet deployed and connected.{" "}
          <a
            href={`${GIWASCAN_URL}/address/${faucetAddr}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {faucetAddr.slice(0, 10)}…
          </a>
        </span>,
      );

      setDeployTokenAddress("");
      addToList(faucetAddr, false);

      // Auto-register in backend (best-effort — token metadata not yet loaded)
      // Registration happens via "Save to registry" button once on-chain data is loaded
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deployment failed.";
      if (/rejected|denied|cancel/i.test(msg)) {
        toast.error("Transaction rejected.");
      } else {
        toast.error(msg.slice(0, 200));
      }
    } finally {
      setIsDeployingNew(false);
    }
  }, [
    walletClient,
    publicClient,
    deployTokenAddress,
    deployCooldown,
    addToList,
  ]);

  const handleAdd = useCallback(() => {
    const addr = addressInput.trim();
    if (!isAddress(addr)) {
      toast.error("Invalid contract address.");
      return;
    }
    setAddressInput("");
    addToList(addr, false);
  }, [addressInput, addToList]);

  const handleSetMintAmount = useCallback(
    async (addr: string) => {
      const entry = faucets[addr];
      if (!entry?.info || !walletClient || !publicClient) return;
      const { tokenDecimals } = entry.info;

      let newAmount: bigint;
      try {
        newAmount = parseUnits(entry.editMintTokens.trim(), tokenDecimals);
        if (newAmount === 0n) throw new Error("Amount must be > 0");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Invalid amount.");
        return;
      }

      updateEntry(addr, { saving: "mint" });
      try {
        const hash = await walletClient.writeContract({
          address: addr as `0x${string}`,
          abi: FAUCET_ABI,
          functionName: "setMintAmount",
          args: [newAmount],
        });
        toast.success("Transaction submitted…");
        await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        toast.success(
          <span>
            Mint amount updated.{" "}
            <a
              href={`${GIWASCAN_URL}/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View tx
            </a>
          </span>,
        );
        await loadFaucet(addr, entry.inRegistry);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Transaction failed.";
        if (/rejected|denied|cancel/i.test(msg)) {
          toast.error("Transaction rejected.");
        } else {
          toast.error(msg.slice(0, 200));
        }
      } finally {
        updateEntry(addr, { saving: null });
      }
    },
    [faucets, walletClient, publicClient, updateEntry, loadFaucet],
  );

  const handleSetCooldown = useCallback(
    async (addr: string) => {
      const entry = faucets[addr];
      if (!entry?.info || !walletClient || !publicClient) return;

      const parsed = parseInt(entry.editCooldownSeconds.trim(), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast.error("Cooldown must be a positive integer (seconds).");
        return;
      }

      updateEntry(addr, { saving: "cooldown" });
      try {
        const hash = await walletClient.writeContract({
          address: addr as `0x${string}`,
          abi: FAUCET_ABI,
          functionName: "setCooldownSeconds",
          args: [BigInt(parsed)],
        });
        toast.success("Transaction submitted…");
        await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        toast.success(
          <span>
            Cooldown updated.{" "}
            <a
              href={`${GIWASCAN_URL}/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View tx
            </a>
          </span>,
        );
        await loadFaucet(addr, entry.inRegistry);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Transaction failed.";
        if (/rejected|denied|cancel/i.test(msg)) {
          toast.error("Transaction rejected.");
        } else {
          toast.error(msg.slice(0, 200));
        }
      } finally {
        updateEntry(addr, { saving: null });
      }
    },
    [faucets, walletClient, publicClient, updateEntry, loadFaucet],
  );

  const faucetAddresses = Object.keys(faucets);

  const walletBanner = !isConnected ? (
    <Card>
      <CardContent className="space-y-3 py-4">
        <p className="text-sm text-ds-gray-700">
          Connect a wallet with admin role to sign transactions.
        </p>
        <Button type="button" onClick={() => openConnectModal?.()}>
          Connect wallet
        </Button>
      </CardContent>
    </Card>
  ) : wrongChain ? (
    <Card>
      <CardContent className="py-4 space-y-3">
        <p className="text-sm text-ds-yellow-700 bg-ds-yellow-700/10 border border-ds-yellow-700/25 rounded-md px-3 py-2">
          Switch to <strong>GIWA Sepolia</strong> (chain {GIWA_SEPOLIA_CHAIN_ID}).
          Currently on chain {chainId}.
        </p>
        <Button type="button" variant="secondary" onClick={() => openChainModal?.()}>
          Switch network
        </Button>
      </CardContent>
    </Card>
  ) : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-ds-gray-1000">
          Faucet Management
        </h1>
        <p className="text-sm text-ds-gray-700 mt-1">
          Deploy new{" "}
          <code className="text-xs bg-ds-gray-200 px-1 rounded">TokenFaucet</code>{" "}
          contracts or manage existing ones — update drip amount and cooldown.
          Your wallet must hold{" "}
          <code className="text-xs bg-ds-gray-200 px-1 rounded">DEFAULT_ADMIN_ROLE</code>{" "}
          on each faucet.
        </p>
      </div>

      {walletBanner}

      {/* Deploy new faucet */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deploy new faucet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ds-gray-700">
            Deploys a{" "}
            <code className="text-xs bg-ds-gray-200 px-1 rounded">TokenFaucet</code>{" "}
            for any existing{" "}
            <code className="text-xs bg-ds-gray-200 px-1 rounded">UserMintableToken</code>,
            then calls{" "}
            <code className="text-xs bg-ds-gray-200 px-1 rounded">setMinter</code>{" "}
            to connect them. Requires admin role on the token.
          </p>
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
              Token address
            </label>
            <Input
              value={deployTokenAddress}
              onChange={(e) => setDeployTokenAddress(e.target.value)}
              placeholder="0x… UserMintableToken address"
              className="font-geist-mono text-sm"
              disabled={isDeployingNew}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
              Cooldown (seconds between claims)
            </label>
            <Input
              value={deployCooldown}
              onChange={(e) => setDeployCooldown(e.target.value)}
              placeholder="86400 = 1 day"
              inputMode="numeric"
              disabled={isDeployingNew}
            />
            <p className="text-xs text-ds-gray-600">
              86400 = 1 day · 3600 = 1 hour · Drip amount defaults to 100 tokens
              (adjustable after deploy below)
            </p>
          </div>
          <Button
            type="button"
            onClick={() => void handleDeployNew()}
            disabled={
              !isConnected ||
              wrongChain ||
              !walletClient ||
              isDeployingNew ||
              !deployTokenAddress.trim()
            }
          >
            {isDeployingNew ? "Deploying…" : "Deploy & connect"}
          </Button>
        </CardContent>
      </Card>

      {/* Load existing faucet manually */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Load faucet by address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder="0x… TokenFaucet contract address"
              className="font-geist-mono text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
            <Button
              type="button"
              onClick={handleAdd}
              disabled={!addressInput.trim()}
            >
              Load
            </Button>
          </div>
          <p className="text-xs text-ds-gray-600">
            Enter a deployed faucet address to read and update its settings.
          </p>
        </CardContent>
      </Card>

      {/* Faucet cards */}
      {faucetAddresses.map((addr) => {
        const entry = faucets[addr];
        const { info, loading, error, editMintTokens, editCooldownSeconds, saving, inRegistry, savingToRegistry } =
          entry;

        return (
          <Card key={addr}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-sm font-geist-mono break-all">
                  {addr}
                </CardTitle>
                {info && !loading && (
                  <div className="flex items-center gap-2 shrink-0">
                    {inRegistry ? (
                      <button
                        className="text-xs text-ds-gray-600 hover:text-ds-red-500"
                        onClick={() => void handleRemoveFromRegistry(addr)}
                      >
                        Remove from registry
                      </button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void handleSaveToRegistry(addr)}
                        disabled={savingToRegistry}
                      >
                        {savingToRegistry ? "Saving…" : "Save to registry"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {loading && (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 bg-ds-gray-300 rounded animate-pulse" />
                  ))}
                </div>
              )}

              {error && (
                <p className="text-sm text-ds-red-400 bg-ds-red-700/10 border border-ds-red-700/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              {info && !loading && (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-0.5">
                        Token
                      </p>
                      <p className="text-ds-gray-1000 font-medium">
                        {info.tokenName}{" "}
                        <span className="text-ds-gray-700">({info.tokenSymbol})</span>
                      </p>
                      <p className="font-geist-mono text-xs text-ds-gray-600 break-all mt-0.5">
                        {info.tokenAddress}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-0.5">
                        Current settings
                      </p>
                      <p className="text-ds-gray-1000">
                        Drip:{" "}
                        <span className="font-medium">
                          {formatUnits(info.mintAmount, info.tokenDecimals)}{" "}
                          {info.tokenSymbol}
                        </span>
                      </p>
                      <p className="text-ds-gray-1000">
                        Cooldown:{" "}
                        <span className="font-medium">
                          {formatCooldown(info.cooldownSeconds)}{" "}
                          <span className="text-ds-gray-600 text-xs">
                            ({info.cooldownSeconds.toString()}s)
                          </span>
                        </span>
                      </p>
                    </div>
                  </div>

                  <hr className="border-ds-gray-300" />

                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                      New drip amount ({info.tokenSymbol} per claim)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={editMintTokens}
                        onChange={(e) =>
                          updateEntry(addr, { editMintTokens: e.target.value })
                        }
                        placeholder="100"
                        className="flex-1"
                        disabled={saving === "mint"}
                      />
                      <Button
                        type="button"
                        onClick={() => void handleSetMintAmount(addr)}
                        disabled={
                          !isConnected || wrongChain || !walletClient || saving !== null
                        }
                      >
                        {saving === "mint" ? "Saving…" : "Update"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                      New cooldown (seconds between claims)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={editCooldownSeconds}
                        onChange={(e) =>
                          updateEntry(addr, { editCooldownSeconds: e.target.value })
                        }
                        placeholder="86400 = 1 day"
                        inputMode="numeric"
                        className="flex-1"
                        disabled={saving === "cooldown"}
                      />
                      <Button
                        type="button"
                        onClick={() => void handleSetCooldown(addr)}
                        disabled={
                          !isConnected || wrongChain || !walletClient || saving !== null
                        }
                      >
                        {saving === "cooldown" ? "Saving…" : "Update"}
                      </Button>
                    </div>
                    {editCooldownSeconds && parseInt(editCooldownSeconds, 10) > 0 && (
                      <p className="text-xs text-ds-gray-600">
                        = {formatCooldown(BigInt(parseInt(editCooldownSeconds, 10)))}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      className="text-xs text-ds-gray-600 hover:text-ds-gray-900"
                      onClick={() => void loadFaucet(addr, inRegistry)}
                    >
                      Refresh
                    </button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      {faucetAddresses.length === 0 && (
        <p className="text-sm text-ds-gray-600">
          No faucets loaded yet. Deploy a new one above or enter an existing address.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify web build compiles**

```bash
pnpm --filter @giwater/web exec tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Verify the web server is still responding**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3007
```

Expected: `200`

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/admin/faucets/page.tsx
git commit -m "feat(web): auto-load and persist faucets via registry API"
```

---

## Verification

After all tasks are complete:

1. Start the API in dev mode — the `token_faucets` table is auto-created via `synchronize: true`.
2. Navigate to `http://localhost:3007/admin/faucets` — page loads with an empty list (no faucets registered yet).
3. Manually load a faucet address → click "Save to registry" → reload page → faucet appears automatically.
4. `GET /api/admin/faucet` in the browser or curl returns the registered faucet.
5. "Remove from registry" removes it; next reload it's gone.
