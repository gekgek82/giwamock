/**
 * NestJS OpenAPI class decorators only — import from `@giwater/shared/nest/swagger` in **broker** / **gateway**.
 * Do not import this entry from `apps/web` (Next.js); it pulls `@nestjs/swagger` → `@nestjs/core` into the client bundle.
 */
export * from '../dto/broker-swap-route.swagger';
export * from '../dto/protocol-contracts.swagger';
