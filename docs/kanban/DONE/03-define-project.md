# Define Project Overview

- **Status**: DONE
- **Priority**: High
- **Created**: 2025-01-01

## Description

Define what this project is about. Update the overview documentation and AI context files so that both developers and AI agents understand the project's purpose.

## Checklist

- [ ] Write a project description in `AI_CONTEXT.md` (what the app does, who it's for)
- [ ] Update `docs/overview/ARCHITECTURE.md` with your project-specific architecture
- [ ] Update `README.md` with project description and getting started guide
- [ ] Define the core domain models in `packages/shared/src/types/index.ts`

## Notes

- `AI_CONTEXT.md` is the single source of truth for all AI agents (Cursor, Claude, Copilot, Codex).
- Being specific helps AI agents generate more accurate code. Instead of "a social app", write "a recipe-sharing platform where users can post, rate, and comment on recipes".
