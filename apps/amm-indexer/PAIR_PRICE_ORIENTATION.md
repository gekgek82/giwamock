# Indexer pair price orientation (prompt / spec)

Use this document as the **product + engineering spec** for how the AMM indexer stores **display base**, **display quote**, and **numeric axis** (`pairPriceAxis`) on pool creation. Implementation: `inferIndexerPairPriceOrientation` in `@giwater/shared`.

## Goals

- Persist **which token is “BASE” vs “QUOTE” in UX**, independent of on-chain `token0` / `token1` sorting.
- Persist **how `price` should be read** for this pool row when it follows rules (i) or (ii).

## On-chain `token0` / `token1` (what the indexer stores)

The indexer **does not** sort token addresses itself. It persists **`token0` and `token1` exactly as emitted** by `PoolCreated` / `CLPoolCreated` on the factory.

On Uniswap-style factories, that emission follows the protocol rule: **`token0` is the lower address, `token1` the higher**, when compared as **160-bit unsigned integers** (same as comparing the `0x…` hex strings lexicographically for equal-length addresses). The handlers only read `event.args.token0` / `event.args.token1` and store them; `inferIndexerPairPriceOrientation` then adds **display** base/quote on top of that canonical pair.

## Rules

**(i) Stable in the pair**  
If **either** `token0` or `token1` is a configured **stablecoin** (e.g. USDC, USDT), represent the pair as **X / STABLE**:

- The **stable** is always **display quote**.
- The other token is **display base**.
- `pairPriceAxis` = `display_quote_per_display_base` (price = quote per 1 base in display terms).

**Exception — both sides are stables**  
If **both** tokens are in the stable list, fall back to on-chain order for display addresses and use axis **`token1_per_token0`** (same as rule iii numerics on the raw pair).

**(ii) No stable, but network / wrapped native**  
If **neither** side is a configured stable, but **one** side matches the configured **network quote token** (e.g. wrapped GIWA for “X / GIWA”):

- That token is **display quote**; the other is **display base**.
- `pairPriceAxis` = `display_quote_per_display_base`.

**(iii) No stable and no network quote token**  
If neither rule (i) nor (ii) applies:

- **Display base** = `token0`, **display quote** = `token1` (on-chain order).
- `pairPriceAxis` = **`token1_per_token0`**: the stored price convention matches **token1 per 1 token0** in the raw on-chain sense.

## Configuration (amm-indexer)

| Variable | Purpose |
|----------|---------|
| `INDEXER_PAIR_STABLE_ADDRESSES` | Comma-separated `0x…` list of stable ERC-20s (rule i). |
| `INDEXER_PAIR_NETWORK_QUOTE_TOKEN` | Single `0x…` for the “network / GIWA” quote side when no stable (rule ii). |

See `apps/amm-indexer/.env.example`.

## Canonical TypeScript addresses

`@giwater/shared` exports **defaults and presets** in `constants/pair-indexer-display.ts` (e.g. `PAIR_INDEXER_NETWORK_QUOTE_TOKEN_WGIWA`, `PAIR_INDEXER_STABLE_ADDRESSES`, `PAIR_INDEXER_ORIENTATION_PRESET_WGIWA`). Extend stable list there when new stables deploy; copy values into env for the running indexer.

## Related code

| Piece | Location |
|-------|----------|
| Orientation algorithm | `packages/shared/src/utils/pair-indexer-price-orientation.ts` |
| Env wiring | `apps/amm-indexer/src/handlers/lib/indexerPairOrientationEnv.ts` |
| Pool created handlers | `handlers/poolCreated.ts`, `handlers/clPoolCreated.ts` |
| Broker payload fields | `packages/shared/src/contract-events/indexer-broker-queue-payload.ts` |
