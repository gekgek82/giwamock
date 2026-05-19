# Railway Deployment Guide

## Project: GiWaTer DEX

Railway project ID: `c1e82970-da7f-4658-a0c0-a3c216efcb91`

---

## Service Map

| Railway Service | App | URL | Database |
|---|---|---|---|
| Giwater AMM broker Service | `apps/broker` | admin.giwater.finance | Postgres (broker) |
| Giwater Config Service | `apps/config-service` | — (internal RPC only) | Postgres-U1-Y (config) |
| Giwater Gateway | `apps/gateway` | gateway.giwater.finance | — (proxies to broker + config) |
| Giwater AMM Indexer Writer | `apps/amm-indexer` | indexer.giwater.finance | Indexer Database (Postgres) |
| RabbitMQ | — | rabbitmq-web-ui-production-d5fd.up.railway.app | — |

### Databases

| Railway Name | Used By |
|---|---|
| Postgres (`postgres-volume-0Ie1`) | broker |
| Postgres-U1-Y (`postgres-volume-yh75`) | config-service |
| Indexer Database (`postgres-volume`) | amm-indexer |
| Redis | broker (cache / pub-sub) |

### Cron Jobs

| Name | Schedule | Uses | Notes |
|---|---|---|---|
| AMM OHLCV | `*/5 * * * *` | broker DB + RabbitMQ | Writes OHLCV buckets to broker DB |

---

## Normal Deployment (no schema change)

Each service deploys independently via GitHub push to `main`. Railway auto-builds the affected service based on the root directory configured in the service settings.

To trigger a manual redeploy from the CLI:

```bash
railway up --service "Giwater AMM broker Service"
railway up --service "Giwater Config Service"
railway up --service "Giwater Gateway"
railway up --service "Giwater AMM Indexer Writer"
```

---

## Broker Schema Change Deployment

The broker uses TypeORM migrations (`synchronize: false`, `migrationsRun: true`). Pending migrations run automatically at boot. However, **the AMM OHLCV cron job writes directly to the broker database** — if it fires while the schema migration is in progress, it can write to a table with an old schema or cause conflicts.

### Required workflow for any broker entity / migration change

1. **Disable the AMM OHLCV cron job** in the Railway dashboard before deploying:
   - Railway Dashboard → GiWaTer DEX → AMM OHLCV → Settings → Disable (or delete the cron trigger temporarily)

2. **Verify the migration is registered** in both files:
   - `apps/broker/src/broker-db/broker-db.module.ts` — `migrations: [...]` array (controls what runs at app boot)
   - `apps/broker/src/data-source.ts` — `migrations: [...]` array (controls what the TypeORM CLI sees)
   - Both arrays must be identical and in chronological order by timestamp prefix.

3. **Deploy the broker service:**
   ```bash
   railway up --service "Giwater AMM broker Service"
   ```
   On boot, NestJS runs all pending migrations before accepting traffic.

4. **Confirm the service is Online** and not Crashed:
   ```bash
   railway status
   ```

5. **Re-enable the AMM OHLCV cron job** in the Railway dashboard.

### Broker migration checklist

- [ ] Entity edited under `apps/broker/src/models/**`
- [ ] Migration generated: `pnpm --filter @giwater/broker migration:generate src/migrations/DescriptiveName`
- [ ] Migration file reviewed — `up()` and `down()` are correct
- [ ] Migration imported and added to `broker-db/broker-db.module.ts` migrations array
- [ ] Migration imported and added to `data-source.ts` migrations array
- [ ] AMM OHLCV cron job **disabled** before deploy
- [ ] Broker service deployed and confirmed Online
- [ ] AMM OHLCV cron job **re-enabled**

---

## Config Service Schema Change Deployment

The config-service manages its own Postgres database (Postgres-U1-Y) independently from the broker. Schema changes follow the same TypeORM migration pattern.

- Migration files: `apps/config-service/src/migrations/`
- Module: `apps/config-service/src/config-db/config-db.module.ts`
- No cron jobs use the config DB — a normal redeploy is safe without disabling anything.

Tables owned by config-service: `banners`, `referral_codes`, `referral_relationships`, `referral_tier_badges`, `admin_watched_wallets`, `token_faucets`.

---

## Common Errors

### `QueryFailedError: column X does not exist`

A migration exists as a file but is not registered in `broker-db.module.ts`. The app boots, skips the migration, and crashes when querying the missing column.

**Fix:** Add the import and register it in the `migrations: [...]` array in `broker-db.module.ts` (and `data-source.ts`), then follow the Broker Schema Change Deployment workflow above.

### Service Crashed on boot

Check Railway logs:
```bash
railway logs --service "Giwater AMM broker Service"
```

Look for `QueryFailedError` or `MigrationExecutionError` near the top of the log.
