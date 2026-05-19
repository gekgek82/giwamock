# Define Data Models & Schema

- **Status**: DONE
- **Priority**: High
- **Created**: 2025-01-01

## Description

Design the database schema for your application. Define models in Prisma and matching TypeScript types in the shared package.

## Checklist

- [ ] Design your data models (entities, relationships)
- [ ] Update `apps/api/prisma/schema.prisma` with your models
- [ ] Run `npx prisma migrate dev --name <description>` to apply changes
- [ ] Add matching TypeScript interfaces to `packages/shared/src/types/index.ts`
- [ ] Add DTOs with validation to `packages/shared/src/dto/` (if needed)
- [ ] Rebuild shared package: `pnpm --filter @app/shared build`

## Notes

- Keep Prisma models and shared TypeScript types in sync.
- Use `cuid()` for IDs (default in the template).
- Example: If you add a `Post` model in Prisma, also add a `Post` interface in `packages/shared`.
