# Build First Feature

- **Status**: DONE
- **Priority**: Medium
- **Created**: 2025-01-01

## Description

Build the first API endpoint and connect it to the frontend. This validates the full-stack workflow: backend -> shared types -> frontend.

## Checklist

- [ ] Create a NestJS module (`nest g module <feature>` or manually)
- [ ] Create controller, service, and wire up to Prisma
- [ ] Add API route constant to `packages/shared/src/constants/index.ts`
- [ ] Update `docs/API.md` with the new endpoint
- [ ] Build a frontend page/component that calls the API
- [ ] Verify end-to-end: data flows from DB -> API -> Frontend

## Notes

- Follow the NestJS module pattern: `{feature}.module.ts`, `{feature}.controller.ts`, `{feature}.service.ts`.
- Import types from `@app/shared`, never duplicate them.
- Tip: Paste your task description into Cursor AI to scaffold the feature automatically.
