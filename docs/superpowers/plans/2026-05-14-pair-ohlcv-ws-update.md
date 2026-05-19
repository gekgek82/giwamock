# Plan: Real-time Pair OHLCV WebSocket Update

**Date:** 2026-05-14  
**Status:** READY

## Goal

After broker aggregates a Swap event and updates `spot_pair_time_buckets`, push the latest OHLCV snapshot to connected web clients via:

```
Broker (RabbitMQ publish) → Gateway (Socket.IO room emit) → Web (singleton socket → RxJS bus → UI)
```

---

## Architecture Overview

```
[Indexer RabbitMQ] ──► RabbitmqService.handleIndexerMessage()
                            │
                            ├─► indexerAggregation.aggregatePayload()   ← OHLCV written to DB here
                            │       └─ SwapOhlcvAggregationService.onSwap()
                            │               └─ [NEW] fanout.fanOutPairOhlcvUpdate(pool, pair, blockTs)
                            │                           └─ RabbitMQ → gatewayExchange
                            │
                            └─► (existing) brokerGatewayWsFanout.fanOutFromIndexerPayload()
                                            └─ token:0x... / onchain.Swap  [unchanged]

[Gateway RabbitMQ consumer]
    └─ handleBrokerNotify() → isBrokerGatewayWsEmitV1() → channelWs$.next()
                                [NO CHANGE NEEDED — already routes to Socket.IO rooms]

TradingGateway.afterInit():
    channelWsEmits$ → server.to('pair:0x...').emit('pair.ohlcv', data)
                                [perMessageDeflate added — see Task 4b]

[Web client]
    GatewaySocketProvider (singleton io()) ──subscribe──► pair:0x{pool}
         │ on 'pair.ohlcv'
         └──► gatewayEventBus$ (RxJS Subject)
                   ├──► usePairOhlcvUpdate() hook → TradingView bar update / price badge
                   └──► (future) swap toast notification
```

---

## Tasks

### Task 1: Shared DTO — `PairOhlcvUpdateDto`

**File:** `packages/shared/src/dto/pair-ohlcv-update.dto.ts` (new)

```ts
export const PAIR_OHLCV_EVENT = 'pair.ohlcv' as const;

export interface PairOhlcvUpdateDto {
  pool: string;        // lowercase 0x pool address
  ts: number;          // block timestamp of the swap (unix seconds)
  price: number;       // current price (quote per base)
  open: number;        // day open
  high: number;        // day high
  low: number;         // day low
  baseVolume: number;  // day base volume
  quoteVolume: number; // day quote volume
}
```

Export from `packages/shared/src/dto/index.ts`.

**Verify:** `pnpm --filter @giwater/shared build` succeeds.

---

### Task 2: Broker — pair OHLCV emitter

**File:** `apps/broker/src/emitter/contracts/pair-ohlcv.emitter.ts` (new)

```ts
import type { BrokerGatewayWsEmitV1 } from '@giwater/shared';
import { PAIR_OHLCV_EVENT, type PairOhlcvUpdateDto } from '@giwater/shared';
import { pairChannel } from '../channel-names';
import { wsEmit } from '../ws-emit';

export function buildPairOhlcvEmit(
  pool: string,
  data: PairOhlcvUpdateDto,
): BrokerGatewayWsEmitV1 | null {
  const ch = pairChannel(pool);
  if (!ch) return null;
  return wsEmit(ch, PAIR_OHLCV_EVENT, data);
}
```

---

### Task 3: Broker — add `fanOutPairOhlcvUpdate()` to `BrokerGatewayWsFanoutService`

**File:** `apps/broker/src/emitter/broker-gateway-ws-fanout.service.ts` (modify)

Add method:
```ts
async fanOutPairOhlcvUpdate(dto: PairOhlcvUpdateDto): Promise<void> {
  const emit = buildPairOhlcvEmit(dto.pool, dto);
  if (!emit) return;
  const ok = await this.rabbitmq.publishToGateway(
    this.rabbit.gatewayWsEmitRoutingKey,
    emit,
  );
  if (!ok) this.logger.warn(`fanOutPairOhlcvUpdate: publish failed pool=${dto.pool}`);
}
```

---

### Task 4: Broker — wire emit into `RabbitmqService` after aggregation

Follow the existing pattern: emitter calls live in `RabbitmqService.handleIndexerMessage()`,
aggregation services stay pure (DB only, no fanout concerns).

**Step 4a — `SwapOhlcvAggregationService.onSwap()` returns pool**

File: `apps/broker/src/swap-ohlcv/swap-ohlcv-aggregation.service.ts` (modify)

Change signature from `Promise<void>` to `Promise<{ pool: string | null }>`.
Return `{ pool }` at the end of `onSwap()` (pool is already resolved internally).
For the early-exit path (no pool found), return `{ pool: null }`.

```ts
async onSwap(payload: SwapIndexerBrokerPayload): Promise<{ pool: string | null }> {
  // ... existing logic unchanged ...
  return { pool };          // at end of happy path
  // early exit: return { pool: null };
}
```

**Step 4b — `aggregateSwap()` bubbles the pool up**

File: `apps/broker/src/aggregator/swap/index.ts` (modify)

```ts
export async function aggregateSwap(
  payload: SwapIndexerBrokerPayload,
  swapGraph: SwapLiquidityGraphService,
  swapOhlcv: SwapOhlcvAggregationService,
): Promise<{ pool: string | null }> {
  await swapGraph.onSwap(payload);
  return swapOhlcv.onSwap(payload);
}
```

**Step 4c — `IndexerAggregationService.aggregatePayload()` returns swap pool**

File: `apps/broker/src/aggregation/indexer-aggregation.service.ts` (modify)

```ts
async aggregatePayload(payload: unknown): Promise<{ swapPool: string | null }> {
  // ... existing try/catch ...
  // inside aggregateIndexedEvent for Swap type, capture return value
  return { swapPool: result?.pool ?? null };
}
```

Update `aggregateIndexedEvent` in `apps/broker/src/aggregator/index.ts` to return
`{ pool: string | null }` for Swap events, `{ pool: null }` for all others.

**Step 4d — `RabbitmqService` calls fanout after aggregation**

File: `apps/broker/src/rabbitmq/rabbitmq.service.ts` (modify)

In `runPostPersistAggregationEntry()` (or inline in `handleIndexerMessage()`), after
`aggregatePayload()` returns, call the fanout if a pool was resolved:

```ts
private async runPostPersistAggregationEntry(payload: unknown): Promise<void> {
  const { swapPool } = await this.indexerAggregation.aggregatePayload(payload);
  if (swapPool) {
    try {
      await this.brokerGatewayWsFanout.fanOutPairOhlcvFromPool(swapPool, payload);
    } catch (err) {
      this.logger.warn(`pair OHLCV fanout failed pool=${swapPool}: ${err instanceof Error ? err.message : err}`);
    }
  }
}
```

`fanOutPairOhlcvFromPool(pool, payload)` is added to `BrokerGatewayWsFanoutService`
(see Task 3 update below): it reads the `spot_pairs` row from DB and builds the DTO.
Wrap in try/catch so WS failures never fail the indexer ack.

**Update Task 3** — `fanOutPairOhlcvFromPool(pool, rawPayload)` replaces the earlier
`fanOutPairOhlcvUpdate(dto)` signature. It injects `SpotPairRepository` to read the
current pair row, builds `PairOhlcvUpdateDto`, calls `buildPairOhlcvEmit()`, then publishes.
`SpotPairEntity` is already in `BrokerDbModule` so no new entity registration needed.

**Verify:** `pnpm --filter @giwater/broker exec tsc --noEmit` — zero errors.

---

### Task 4b: Gateway — enable perMessageDeflate compression

**File:** `apps/gateway/src/ws/trading.gateway.ts` (modify)

Add `perMessageDeflate` to the `@WebSocketGateway` decorator:

```ts
@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
  perMessageDeflate: {
    threshold: 512, // only compress frames larger than 512 bytes
  },
})
```

This uses the WebSocket built-in per-message deflate (RFC 7692). No client-side change needed — the browser WebSocket implementation negotiates compression automatically during the handshake. Small frames like `pair.ohlcv` (< 512 bytes) are sent uncompressed to avoid CPU overhead on frequent small messages.

**Verify:** `pnpm --filter @giwater/gateway exec tsc --noEmit` — zero errors.

---

### Task 5: Web — install dependencies

```bash
pnpm --filter @giwater/web add socket.io-client rxjs
```

**Verify:** `apps/web/package.json` has `socket.io-client` and `rxjs` in dependencies.

---

### Task 6: Web — singleton socket client

**File:** `apps/web/lib/gatewaySocket.ts` (new)

```ts
import { io, type Socket } from 'socket.io-client';

let _socket: Socket | null = null;

export function getOrCreateSocket(origin: string): Socket {
  if (!_socket || _socket.disconnected) {
    _socket = io(origin, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return _socket;
}

export function destroySocket(): void {
  _socket?.disconnect();
  _socket = null;
}
```

---

### Task 7: Web — RxJS gateway event bus

**File:** `apps/web/lib/gatewayEventBus.ts` (new)

```ts
import { Subject } from 'rxjs';

export interface GatewayWsEvent {
  channel: string;
  event: string;
  data: unknown;
}

export const gatewayEventBus$ = new Subject<GatewayWsEvent>();
```

---

### Task 8: Web — `GatewaySocketProvider` context

**File:** `apps/web/context/GatewaySocketProvider.tsx` (new)

- `'use client'`
- `createContext<GatewaySocketContextValue>` with:
  - `subscribePairChannel(pool: string): void`
  - `unsubscribePairChannel(pool: string): void`
- `GatewaySocketProvider`:
  - On mount: `getOrCreateSocket(socketOrigin)` from `useGateway()`
  - `socket.on('connect', ...)` → send `channels.subscribe` for already-registered pools
  - `socket.on(PAIR_OHLCV_EVENT, ...)` → push to `gatewayEventBus$` (doesn't work — socket events are per room)
  - After `channels.subscribe`, listen on generic `pair.ohlcv` events: use Socket.IO room-based listening; the gateway emits with `server.to(channel).emit(event, data)`, so the client receives `event = 'pair.ohlcv'` on the default namespace. Listen via:
    ```ts
    socket.on('pair.ohlcv', (data: unknown) => {
      // data already includes pool address from PairOhlcvUpdateDto
      const dto = data as PairOhlcvUpdateDto;
      gatewayEventBus$.next({ channel: `pair:${dto.pool}`, event: PAIR_OHLCV_EVENT, data: dto });
    });
    ```
  - On unmount: `destroySocket()`
- Export `useGatewaySocket()` hook

**Important:** Socket.IO room membership is server-side. Clients must explicitly send `channels.subscribe` with `{ channels: ['pair:0x...'] }` to join a room. The provider maintains a `Set<string>` of subscribed channels to re-send on reconnect.

---

### Task 9: Web — `usePairOhlcvUpdate` hook

**File:** `apps/web/hooks/usePairOhlcvUpdate.ts` (new)

```ts
import { useEffect } from 'react';
import { filter } from 'rxjs/operators';
import { gatewayEventBus$ } from '@/lib/gatewayEventBus';
import { PAIR_OHLCV_EVENT, type PairOhlcvUpdateDto } from '@giwater/shared';
import { useGatewaySocket } from '@/context/GatewaySocketProvider';

export function usePairOhlcvUpdate(
  pool: string | null | undefined,
  onUpdate: (data: PairOhlcvUpdateDto) => void,
): void {
  const { subscribePairChannel, unsubscribePairChannel } = useGatewaySocket();

  useEffect(() => {
    if (!pool) return;
    const normalized = pool.toLowerCase();
    subscribePairChannel(normalized);

    const sub = gatewayEventBus$
      .pipe(filter((e) => e.event === PAIR_OHLCV_EVENT && e.channel === `pair:${normalized}`))
      .subscribe((e) => onUpdate(e.data as PairOhlcvUpdateDto));

    return () => {
      sub.unsubscribe();
      unsubscribePairChannel(normalized);
    };
  }, [pool]);
}
```

---

### Task 10: Web — wire `GatewaySocketProvider` into app layout

**File:** `apps/web/app/layout.tsx` (modify)

Wrap the app tree with `<GatewaySocketProvider>` inside `<GatewayProvider>`:

```tsx
<GatewayProvider>
  <GatewaySocketProvider>
    {children}
  </GatewaySocketProvider>
</GatewayProvider>
```

---

### Task 11: Web — live price badge on swap/pair page

Find the pair page component (wherever `spot_pairs.price` is currently displayed) and call `usePairOhlcvUpdate` to show a live price badge that animates on each update.

Minimal integration:
```tsx
const [livePrice, setLivePrice] = useState<number | null>(null);
usePairOhlcvUpdate(poolAddress, (dto) => setLivePrice(dto.price));
```

---

### Task 12: AsyncAPI documentation

**File:** `docs/WEBSOCKET.asyncapi.yaml` ✅ (already created)

Documents all Socket.IO channels and events using [AsyncAPI 3.0](https://www.asyncapi.com/blog/socketio-part1) with `socketio` bindings.

Coverage:
| Channel key | Room | Events |
|---|---|---|
| `pairOhlcvUpdate` | `pair:{poolAddress}` | `pair.ohlcv` ← **NEW** |
| `pairPoolCreated` | `pair:{poolAddress}` | `onchain.PoolCreated` |
| `pairCLPoolCreated` | `pair:{poolAddress}` | `onchain.CLPoolCreated` |
| `tokenSwap` | `token:{tokenAddress}` | `onchain.Swap` |
| `tokenPoolCreated` | `token:{tokenAddress}` | `onchain.PoolCreated` |
| `tokenCLPoolCreated` | `token:{tokenAddress}` | `onchain.CLPoolCreated` |
| `tokenLiquidityAdded` | `token:{tokenAddress}` | `onchain.LiquidityAdded` |
| `tokenCLLiquidityAdded` | `token:{tokenAddress}` | `onchain.CLLiquidityAdded` |

Control messages: `channels.subscribe/subscribed`, `channels.unsubscribe/unsubscribed`, `ping/pong`, `broker.invoke/result/error`.

**After any new channel or event is added:** update `docs/WEBSOCKET.asyncapi.yaml` — add the channel entry, message schema in `components/messages`, and reference it in `operations`.

---

## Verification Checklist

- [ ] `pnpm --filter @giwater/shared build` — no errors
- [ ] `pnpm --filter @giwater/broker exec tsc --noEmit` — no errors
- [ ] `pnpm --filter @giwater/web exec tsc --noEmit` — no errors (or `next build`)
- [ ] With broker + gateway running, trigger a swap → broker logs show "fanOutPairOhlcvUpdate"
- [ ] Gateway logs show the `pair.ohlcv` WS emit routed to socket room
- [ ] Web: open browser dev tools → Socket.IO connection established, `channels.subscribe` sent, `pair.ohlcv` events received
- [ ] Live price badge updates in UI without page refresh

---

## Non-goals (out of scope for this plan)

- Per-resolution (1m/1h/1d) bucket pushes for TradingView `subscribeBars` — use HTTP UDF for historical, WS only for latest bar close
- Toast notifications (can be added as a follow-up consumer of `gatewayEventBus$`)
- Token channel OHLCV updates (same pattern, separate plan)
