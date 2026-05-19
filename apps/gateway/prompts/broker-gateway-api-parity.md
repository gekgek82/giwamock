# Gateway ↔ broker: same API interface

The **gateway does not duplicate broker business rules**. Clients use the **same logical API** whether they call the broker over HTTP or the gateway:

- **HTTP async:** `POST /api/v1/broker/invoke` with `BrokerGatewayHttpLikeRequest` (`method`, `path`, `query?`, `body?`) from `@giwater/shared`.
- **WebSocket:** event `broker.invoke` with the same fields; responses on `broker.invoke.result` / `broker.invoke.error`.

The gateway sends that payload to the broker **`broker.rpc`** queue; the broker answers on AMQP `replyTo` using **`BrokerGatewayRpcResponseDto`** (`ok`, `statusCode`, `body`, `error`).

In addition to `POST /api/v1/broker/invoke`, the gateway exposes **HTTP parity routes** for **GET** read paths (same path shape as broker, e.g. `/health`, `/swap-routes`, `/spot-pairs/...`) that internally forward to broker via the same `apiInvoke` RPC path.

**Administrative POSTs** — e.g. **`POST /spot-tokens/.../listing`** and **`POST /spot-pairs/.../listing`** — are **not** mirrored as gateway parity routes; they remain **broker-only** HTTP. Operators call the broker directly (or use `invoke` with explicit `method` / `path` / `body` only where intentionally allowed).

## RPC message identity (RabbitMQ)

- Each **RPC attempt** from the gateway gets a **fresh AMQP `correlationId`** (a random UUID) when publishing to `broker.rpc`. The broker must echo the same `correlationId` on the reply to `replyTo` so the gateway can match **which response belongs to which in-flight call** (concurrent requests do not get mixed up).
- The **JSON body** of the request (`method`, `path`, `query`, `body`) is **not** globally unique—two clients can send the same shape. Uniqueness for pairing is the **`correlationId` transport field**, not the payload.
- **Retries / duplicates:** If a client sends **`invoke` twice**, that is **two** RPCs (two UUIDs) unless you build deduplication yourself. This pattern does **not** guarantee **idempotent at-most-once** execution for duplicate submissions—design that at the application layer if needed.

## When you add or change a broker HTTP route

1. Update the broker implementation (`apps/broker`).
2. Update the **shared contract** in `@giwater/shared`:
   - DTO shape in `packages/shared/src/dto/**`
   - Swagger shape in `packages/shared/src/dto/**/*.swagger.ts`
   - This is required so **gateway `/api/docs`** can reflect the updated response/query contract after redeploy.
3. Update **`GatewayRpcInvokeService`** in the broker repo: `apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts` so `apiInvoke` matches the new route (inject services from new Nest modules there via **`GatewayRpcInvokeModule`** imports if needed).
4. Re-test `POST …/invoke` (and WS if clients use it).
5. Re-test gateway HTTP parity routes so Swagger and behavior stay aligned with broker routes.
6. Redeploy in the correct order:
   - Deploy **broker** first (so the new fields actually exist in the response body).
   - Deploy **gateway** second (so its OpenAPI reflects the updated `@giwater/shared` Swagger DTOs).

**Example paths that must stay aligned (parity):** `GET /health`, `GET /swap-routes`, `GET /indexed-events`, `GET /spot-tokens/…`, `GET /spot-pairs/…` including **`GET /spot-pairs/by-address/:address/cl-dynamic-fee`** (optional `query.sender`). **Listing POSTs** stay broker-only — align **`GatewayRpcInvokeService`** for `apiInvoke` but do **not** add parity controller routes for `POST …/listing`.

If a route is documented in gateway OpenAPI as a parity endpoint, it must map 1:1 to the corresponding broker route contract (method, path params, query semantics, and response/error shape).

## OpenAPI docs parity

- Gateway and broker should expose Swagger UI on the same path: **`/api/docs`**.
- Keep this path consistent across environments so clients and ops do not need service-specific doc URLs.

## Runtime parity gate (mandatory before saying "parity reached")

Never claim parity from source code inspection only. Parity is reached only when **all three** checks pass on the **target deployed URL**:

1. **Gateway HTTP route exists** (no framework-level `Cannot GET` route miss).
2. **Gateway -> broker RPC route exists** (`POST /api/v1/broker/invoke` does not return `No route for ... under ...` or `No RPC handler ...`).
3. **Gateway OpenAPI params match broker semantics** (at minimum: `from/to`, `offset/limit`, `listed`, `sender`, path `address` where applicable).

Run:

```bash
GATEWAY_URL=https://<gateway-host> node scripts/verify-broker-gateway-parity.mjs
```

If this fails:

- Fix broker `GatewayRpcInvokeService` branches first (`apps/broker/src/gateway-rpc/gateway-rpc-invoke.service.ts`).
- Fix gateway HTTP parity controller OpenAPI annotations (`apps/gateway/src/api/broker-http-parity.controller.ts`).
- Redeploy broker and gateway.
- Re-run the script on the deployed URL until clean.

Do not report "done/parity reached" until the deployed URL check is green.

**Full checklist and fan-out notes:** `apps/broker/prompts/gateway-rpc-fanout.md`.
