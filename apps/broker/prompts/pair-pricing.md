### Broker Pair Price & Orientation Rules (Critical)

For broker/indexer pool aggregation (`PoolCreated`, `CLPoolCreated`, `LiquidityAdded`, swap OHLCV), follow these rules strictly:

- **Keep token0/token1 as canonical on-chain tokens.** Do not overwrite or reinterpret `token0`/`token1`.
- **Display base/quote uses 3 rules only:**
  1. If exactly one side is stable, stable is **quote** and the other side is **base**.
  2. Else, if wrapped native is one side, wrapped native is **quote** and the other side is **base**.
  3. Else, default to **base = token0**, **quote = token1**.
- **`spot_pairs.price` must always be `token1/token0`** (human units), independent of display orientation.
- **`displayPrice` must be computed from display base/quote orientation** (rule-based output), not by changing the stored `price` axis.
- **`bDecimal` and `qDecimal` are base/quote decimals** (from the rule-derived base/quote), not blindly token0/token1 decimals.
- **Indexer-to-broker payload for pool-created events must include full `TokenInfo` objects** (`token`, `totalSupply`, `decimals`, `name`, `symbol`) for both sides when available, so broker can persist token metadata and decimal mappings deterministically.
- **Pool-created payload does _not_ need `bDecimal/qDecimal/baseName/quoteName/baseSymbol/quoteSymbol` fields directly.** Those are derived in broker from `token0Info/token1Info` and then persisted to `spot_pairs`.

### Configuration (Shared Source of Truth)

The 3-rule orientation config lives in `packages/shared/src/utils/pair-display-config.ts`.
Broker imports `PAIR_DISPLAY_CONFIG_DEFAULT` from shared in `apps/broker/src/config/configuration.ts`.

- `PAIR_DISPLAY_STABLE_QUOTE_ADDRESSES` — add all stable token addresses here (multiple supported).
- `PAIR_DISPLAY_CONFIG_DEFAULT.wrappedNativeAddress` — wrapped native token for Rule 2.
- `PAIR_DISPLAY_CONFIG_DEFAULT.wrappedNativeIsQuoteWhenNoStable` — Rule 2 toggle.
- `DEX_USD_QUOTE_ADDRESS_CONFIG_DEFAULT.usdtToken` / `.wethToken` — USD routing quote tokens used by broker TVL/USD computation.