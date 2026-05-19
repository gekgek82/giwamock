# Set Up Authentication

- **Status**: DONE
- **Priority**: Medium
- **Created**: 2025-01-01

## Description

Add user authentication to protect API endpoints and frontend routes.

## Checklist

- [ ] Choose auth strategy (JWT, session, NextAuth, etc.)
- [ ] Implement login/register endpoints in `apps/api`
- [ ] Add auth middleware/guards for protected routes
- [ ] Add auth state management in `apps/web`
- [ ] Create login/register pages in `apps/web`
- [ ] Add protected route handling (redirect to login if unauthenticated)
- [ ] Update `docs/API.md` with auth endpoints

## Notes

- The User model is already included in the Prisma schema.
- API route constants for auth are pre-defined in `packages/shared/src/constants/index.ts`.
- Consider using `@nestjs/passport` with JWT strategy for the backend.
