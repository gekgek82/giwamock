# Define Tech Stack & Configuration

- **Status**: DONE
- **Priority**: High
- **Created**: 2025-01-01

## Description

Review and finalize the tech stack for your project. The scaffolding provides defaults, but you may want to customize them.

## Checklist

- [ ] Decide on authentication strategy (JWT, session-based, OAuth, etc.)
- [ ] Decide on database (keep SQLite for dev, or switch to PostgreSQL/MySQL for production)
- [ ] Choose a deployment target (Vercel, AWS, Docker, etc.)
- [ ] Configure environment variables for each environment (`.env`, `.env.production`)
- [ ] Add any additional libraries needed (e.g., file upload, email, payments)

## Notes

- SQLite works great for development and small projects. For production, consider PostgreSQL.
- To switch databases, update `apps/api/prisma/schema.prisma` provider and `DATABASE_URL` in `.env`.
- Stack decisions should be documented in `docs/overview/ARCHITECTURE.md`.
