### Indexer -> Broker Payload Rules (Critical)

For `PoolCreated` and `CLPoolCreated`, the indexer MUST always include `token0Info` and `token1Info` in the broker queue payload (`notifyBroker` body), and broker MUST persist these objects into `indexed_events.payload`.

Required shape for both `token0Info` and `token1Info`:

- `token`: token address
- `totalSupply`: bigint string (or `0`)
- `decimals`: number (or `0`)
- `name`: string (empty string allowed)
- `symbol`: string (empty string allowed)

Do not gate `token0Info/token1Info` behind optional checks like `decimals !== undefined`.
Even when metadata is partial, include the object with safe defaults.

