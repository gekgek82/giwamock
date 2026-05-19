# Prompt: NestJS WebSocket gateway ↔ client (GiWater)

Use this as an **implementation brief** when scaffolding `apps/gateway` real-time connectivity. Primary reference: **[NestJS — Gateways](https://docs.nestjs.com/websockets/gateways)**.

## Goal

Implement the **edge NestJS gateway** so browsers and apps connect with **`socket.io-client`**, matching the architecture in `apps/gateway/README.md` (broker notifications → gateway → clients; optional Redis adapter for replicas).

## Server (NestJS) — follow the official gateway pattern

1. **Dependencies** (per [NestJS Gateways — Installation](https://docs.nestjs.com/websockets/gateways)):
   - `@nestjs/websockets`
   - `@nestjs/platform-socket.io`
   - `socket.io` (transitive / explicit as needed)

2. **Gateway class**
   - Annotate with `@WebSocketGateway(port?, options?)`.
   - Default: same port as HTTP unless you pass a port to `@WebSocketGateway(…)` or configure in options.
   - Use **namespaces** if the product needs isolation, e.g. `@WebSocketGateway({ namespace: 'trading' })` (see [Socket.IO namespaces](https://socket.io/docs/v4/namespaces/)).
   - Pass **Socket.IO server options** in the decorator’s second argument (e.g. `transports`, CORS-related settings aligned with the HTTP app).

3. **Register the gateway**
   - Add the gateway class to a module’s **`providers`** array. **Gateways are not instantiated until referenced in a module** (Nest warning in docs).

4. **Message handlers**
   - Use `@SubscribeMessage('eventName')` for each client → server event.
   - Prefer `@MessageBody()`, `@ConnectedSocket()` from `@nestjs/websockets` over raw `(client, data)` for testability.
   - Use **`@Ack()`** when you need explicit control over acknowledgments instead of only returning a value.

5. **Responses**
   - Returning a value sends a **single** acknowledgment where supported.
   - For **multiple pushes** to the client, return `{ event: string, data: unknown }` as `WsResponse` (see [Multiple responses](https://docs.nestjs.com/websockets/gateways)).
   - Handlers may be **`async`** or return **`Observable`** streams of `WsResponse`.

6. **Lifecycle** (implement interfaces from `@nestjs/websockets` when needed)
   - `OnGatewayInit` → `afterInit(server)`
   - `OnGatewayConnection` → `handleConnection(client)`
   - `OnGatewayDisconnect` → `handleDisconnect(client)`

7. **Broadcasting broker events**
   - Inject `@WebSocketServer() server: Server` (or `Namespace` when using a namespace gateway) to **`emit`** to rooms or the whole namespace after RabbitMQ consumers receive broker notifications.
   - Keep **room naming** and **event names** aligned with the **AsyncAPI** spec referenced in `README.md`.

8. **Multi-replica (Railway)**
   - When running multiple gateway instances, use the **Socket.IO Redis adapter** (and the same Redis separation / key prefixes described in the README) so emits reach clients on all replicas.

9. **Guards / pipes / interceptors**
   - The Nest docs note that gateways support the same patterns as HTTP where applicable; use **guards** for auth on connection or messages, and **validation pipes** on `@MessageBody()` DTOs.

## Client (`socket.io-client`)

1. **Connect** to the gateway URL + optional namespace, e.g. `io('https://gateway.example.com/trading', { transports: ['websocket'] })` if using namespace `/trading`.

2. **Emit** with optional ack callback (matches Nest handler return / `@Ack()`):
   ```ts
   socket.emit('events', { name: 'Nest' }, (response) => console.log(response));
   ```

3. **Listen** for server-initiated events (including `WsResponse`-style event names):
   ```ts
   socket.on('events', (data) => console.log(data));
   ```

4. **Reconnect & errors** — handle `connect_error`, `disconnect`; align with production TLS and CORS.

## Alignment checklist (GiWater README)

- [ ] HTTP API remains Nest + Swagger; WebSocket surface documented in **AsyncAPI**.
- [ ] HTTP handler path: Redis cache → RabbitMQ → broker; socket path: broker pushes → gateway **`server.emit` / `to(room).emit`**.
- [ ] Event names and payloads are **versioned** or stable for mobile/web clients.

## Reference links

- [NestJS — Gateways](https://docs.nestjs.com/websockets/gateways)
- [NestJS — Adapters](https://docs.nestjs.com/websockets/adapter) (custom or Redis adapter context)
- [Nest sample: gateways](https://github.com/nestjs/nest/tree/master/sample/02-gateways)
- [Socket.IO server options](https://socket.io/docs/v4/server-options/)
