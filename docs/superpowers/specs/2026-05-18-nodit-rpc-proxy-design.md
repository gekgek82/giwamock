# Nodit-Backed Local RPC Proxy for Ponder Historical Sync

**Date:** 2026-05-18  
**Status:** Approved

## Problem

Ponder's historical sync exhausts Nodit Developer Plan CU limits because it issues thousands of `eth_getLogs` and `eth_getBlockByNumber` RPC calls over large block ranges. Nodit recommends using their Web3 Data API (`searchEvents`, `getBlocksWithinRange`) instead, which is optimized for bulk historical queries.

## Goal

Replace Ponder's historical RPC fetches with Nodit Data API calls while keeping Ponder's handler code, schema, and `ponder_sync` cache mechanism completely intact.

## Approach: Local JSON-RPC Proxy

A lightweight local HTTP server sits between Ponder and the network. Ponder points to `http://localhost:8547` as its RPC endpoint and has no knowledge of the proxy. The proxy intercepts specific RPC methods and routes them to Nodit's Data API; all other methods pass through to a standard fallback RPC.

### Architecture

```
Ponder
  └─→ localhost:8547 (nodit-proxy)
         ├─ eth_getLogs              → Nodit searchEvents   (paginated, aggregate all pages)
         ├─ eth_getBlockByNumber     → Nodit getBlocksWithinRange
         ├─ eth_blockNumber          → fallback RPC
         └─ all other methods        → fallback RPC (PONDER_RPC_URL_2 / Nodit standard RPC)
```

Ponder syncs normally and writes to `ponder_sync` as usual. Factory contract discovery (`GaugeCreated` → dynamic gauge addresses) works through Ponder's existing path — the proxy only needs to return accurate raw log data.

### Why not write directly to ponder_sync?

Ponder's `ponder_sync.intervals` tracks synced ranges via `fragmentId` (an encoded filter fingerprint) + PostgreSQL `nummultirange`. The `fragmentId` is generated internally by Ponder from each contract/event filter. Writing to the DB directly would require replicating this encoding and risk consistency errors. The proxy approach lets Ponder manage its own DB, which is safer and more maintainable.

## Implementation

### File Structure

```
apps/amm-indexer/scripts/nodit-proxy/
  index.ts            ← HTTP server entry point (JSON-RPC 2.0)
  rpc-handler.ts      ← per-method routing logic
  nodit-client.ts     ← Nodit Data API client with automatic pagination
  format-adapter.ts   ← convert Nodit response → EIP-1193 format
```

### rpc-handler.ts — Method Routing

| JSON-RPC Method | Route |
|---|---|
| `eth_getLogs` | Nodit `searchEvents` (if block range ≤ `NODIT_HISTORICAL_END_BLOCK`) |
| `eth_getBlockByNumber` | Nodit `getBlocksWithinRange` (if block ≤ `NODIT_HISTORICAL_END_BLOCK`) |
| `eth_blockNumber` | fallback RPC |
| everything else | fallback RPC |

Blocks above `NODIT_HISTORICAL_END_BLOCK` always go to the fallback RPC. This keeps the proxy usable as a persistent sidecar — historical blocks served by Nodit, live blocks by standard RPC.

### nodit-client.ts — Pagination

Nodit Data API uses `page` / `rpp` pagination. `eth_getLogs` does not paginate. The client must:

1. Call `searchEvents` with `page=1, rpp=100`
2. Check if response has more pages (`total > page * rpp`)
3. Fetch remaining pages
4. Concatenate all results before returning to Ponder

### format-adapter.ts — Response Conversion

**Critical assumption (must verify first):** Nodit `searchEvents` must return raw `topics[]` and `data` fields alongside decoded values. If it returns only decoded values, ABI re-encoding is required (complex; see Risk section).

**eth_getLogs → searchEvents mapping:**

| EIP-1193 field | Nodit field |
|---|---|
| `address` | `contractAddress` or `address` |
| `topics[0..3]` | raw `topics` array |
| `data` | raw `data` |
| `blockNumber` | hex-encode `blockNumber` |
| `blockHash` | `blockHash` |
| `transactionHash` | `transactionHash` |
| `transactionIndex` | hex-encode `transactionIndex` |
| `logIndex` | hex-encode `logIndex` |
| `removed` | `false` (Nodit only returns canonical chain) |

**eth_getBlockByNumber → getBlocksWithinRange mapping:**

Nodit returns block metadata. Map all fields to EIP-1193 block format (hex-encoded numbers, required fields like `logsBloom`, `extraData` may need defaults if Nodit omits them).

### Environment Variables

| Variable | Description |
|---|---|
| `NODIT_API_URL` | `https://web3.nodit.io/v1/{key}` |
| `NODIT_PROXY_PORT` | Local port for the proxy (default: `8547`) |
| `NODIT_HISTORICAL_END_BLOCK` | **Required.** Block number up to which Nodit Data API is used; above this, fallback RPC handles requests. Also, any `eth_getBlockByNumber` with tag `"latest"` or `"pending"` always goes to fallback regardless of this value. |
| `PONDER_RPC_URL_1` | Change to `http://localhost:8547` |
| `PONDER_RPC_URL_2` | Fallback RPC (Nodit standard JSON-RPC or own node) |

### Startup

```bash
# 1. Start proxy (background)
pnpm tsx apps/amm-indexer/scripts/nodit-proxy/index.ts &

# 2. Ponder starts normally — no changes
pnpm ponder start --schema amm_indexer
```

Can be integrated into `start-maybe-prune.sh` as a pre-step.

## Risks

### R1: Nodit searchEvents response format (HIGH — verify first)

If `searchEvents` returns only decoded event data (e.g. `{ from, to, value }`) and not raw `topics[]` + `data`, the format adapter must ABI-encode the decoded values back to raw form. This is technically possible but requires:

- All contract ABIs available in the proxy
- Correct topic encoding for indexed vs non-indexed parameters
- Exact byte packing for `data`

Factory contract logs (`GaugeCreated`) are especially sensitive — Ponder extracts child contract addresses from `topic1`. Any encoding error here breaks factory discovery.

**Mitigation:** Call Nodit `searchEvents` manually before implementation and inspect the raw response JSON. If raw topics are absent, assess complexity before proceeding.

### R2: Missing block fields

Nodit `getBlocksWithinRange` may omit fields that Ponder's `standardizeBlock` requires (e.g. `logsBloom`, `sha3Uncles`, `mixHash`). Ponder's validation will throw if required fields are absent.

**Mitigation:** Inspect actual Nodit block response. Provide zero-value defaults for optional fields Ponder accepts as nullable.

### R3: Nodit pagination performance

Large block ranges with high event density may require many pages. Each page is a separate HTTP request. This could be slower than a single `eth_getLogs` call to an own node.

**Mitigation:** Tune `rpp` to maximum (check Nodit docs for max page size). The proxy can parallelize page fetches within a single `eth_getLogs` request.

### R4: Factory contract coverage

Ponder's factory pattern needs `GaugeCreated` logs to discover gauge addresses. The proxy must return these logs accurately. Since `GaugeCreated` is emitted by the `Voter` contract (not a factory spawned contract), it appears in a standard `eth_getLogs` filter and should be handled normally.

## Out of Scope

- Writing directly to `ponder_sync` tables
- Replacing Ponder with a custom Nodit-native indexer
- WebSocket / `eth_subscribe` (stays on fallback RPC)
- `debug_traceBlock` or transaction traces (stays on fallback RPC)
- Live block indexing past `NODIT_HISTORICAL_END_BLOCK`

## Success Criteria

1. Ponder completes historical sync without hitting Nodit Developer Plan CU limits
2. All `ponder_sync` tables populated correctly (logs, blocks, intervals, factory_addresses)
3. Factory contracts (BasicGauge, CLGauge, etc.) discovered correctly
4. Zero changes to Ponder handler code (`src/handlers/**`, `ponder.schema.ts`)
5. `curl -s http://localhost:8547 -d '{"method":"eth_blockNumber"}'` returns current block from fallback
