# Broker Postgres schema and migrations (mandatory for agents)

Read this **before** changing anything under `apps/broker/src/models/**`, `apps/broker/src/broker-db/**`, or `apps/broker/src/migrations/**`.

## Non‑negotiable rules

1. **Single source of truth for table shape**
   - TypeORM entities in `apps/broker/src/models/**` define what the application expects at runtime.
   - The physical Postgres schema must match those entities after migrations have run.

2. **All DDL goes in TypeORM migration files in `src/migrations/`**
   - Migration files are TypeScript classes implementing `MigrationInterface` with `up()` and `down()` methods.
   - The initial schema is in `src/migrations/1700000000000-InitialSchema.ts`.
   - **Adding** columns/tables/indexes: generate a new migration with `pnpm --filter @giwater/broker migration:generate src/migrations/YourMigrationName`, then review and commit it.
   - **Never** run ad-hoc `ALTER TABLE` from Nest services, RabbitMQ handlers, or app code.

3. **`synchronize` is off**
   - `broker-db.module.ts` keeps `synchronize: false`.
   - Do **not** turn it on temporarily; migrations are the only way schema changes happen.

4. **Migrations run automatically at boot**
   - `broker-db.module.ts` sets `migrationsRun: true` — TypeORM runs any pending migrations when the DataSource connects.
   - TypeORM tracks applied migrations in the `migrations` table (created automatically).
   - To run manually: `pnpm --filter @giwater/broker migration:run` (or `pnpm broker:migration:run` from repo root).

5. **CLI commands (from `apps/broker/` directory)**

   | Command | Purpose |
   |---|---|
   | `pnpm migration:run` | Apply all pending migrations |
   | `pnpm migration:revert` | Revert the last migration |
   | `pnpm migration:generate src/migrations/Name` | Generate migration by diffing entities vs DB |
   | `pnpm migration:show` | List applied/pending migrations |

   The CLI uses `src/data-source.ts` and requires `BROKER_DATABASE_URL` or `DATABASE_URL` in environment.

6. **Keep docs in sync**
   - Update this file when conventions change.

## Workflow checklist (entities + DB)

- [ ] Edit TypeORM entity / add `@Column` / modify field.
- [ ] Run `pnpm --filter @giwater/broker migration:generate src/migrations/YourDescriptiveName` against a running dev DB.
- [ ] Review the generated migration file — ensure `up()` and `down()` are correct.
- [ ] Commit the migration file alongside the entity change.
- [ ] Verify broker starts and queries succeed (`migrationsRun: true` applies it on boot).

## DataSource config

`src/data-source.ts` is the TypeORM CLI entry point. It imports all entities and all migration classes.
When adding a new migration, import and register it in both `data-source.ts` and `broker-db.module.ts`.
