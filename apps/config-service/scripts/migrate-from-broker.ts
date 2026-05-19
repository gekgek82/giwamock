/**
 * One-time data migration: copies config tables from broker DB to config DB.
 *
 * Usage:
 *   BROKER_DATABASE_URL=postgres://... CONFIG_DATABASE_URL=postgres://... \
 *   node --loader ts-node/esm scripts/migrate-from-broker.ts
 *
 * Safe to re-run: skips tables where config DB already has rows.
 */
import pg from 'pg';

const SERIAL_TABLES: Record<string, string> = {
  banners: 'id',
  referral_relationships: 'id',
  referral_tier_badges: 'id',
};

const BROKER_URL = process.env.BROKER_DATABASE_URL;
const CONFIG_URL = process.env.CONFIG_DATABASE_URL;

if (!BROKER_URL) { console.error('ERROR: BROKER_DATABASE_URL not set'); process.exit(1); }
if (!CONFIG_URL) { console.error('ERROR: CONFIG_DATABASE_URL not set'); process.exit(1); }

const brokerClient = new pg.Client({ connectionString: BROKER_URL });
const configClient = new pg.Client({ connectionString: CONFIG_URL });

const TABLES: Array<{ table: string; columns: string[] }> = [
  {
    table: 'banners',
    columns: ['id', 'title', 'page', 'link_url', 'click_target', 'image_pc_data', 'image_mobile_data', 'start_at', 'end_at', 'impressions', 'clicks', 'created_at', 'updated_at'],
  },
  {
    table: 'referral_codes',
    columns: ['address', 'code', '"createdAt"'],
  },
  {
    table: 'referral_relationships',
    columns: ['id', '"referrerAddress"', '"refereeAddress"', '"createdAt"'],
  },
  {
    table: 'referral_tier_badges',
    columns: ['id', 'address', '"badgeType"', '"isActive"', '"grantedAt"', '"expiresAt"', '"grantedBy"'],
  },
  {
    table: 'admin_watched_wallets',
    columns: ['id', 'address', 'label', '"createdAt"'],
  },
  {
    table: 'token_faucets',
    columns: ['faucet_address', 'token_address', 'token_name', 'token_symbol', 'token_decimals', 'created_at'],
  },
];

async function migrateTable(table: string, columns: string[]): Promise<void> {
  const colList = columns.join(', ');
  const { rows: brokerRows } = await brokerClient.query<Record<string, unknown>>(
    `SELECT ${colList} FROM "${table}"`,
  );
  console.log(`  [${table}] broker has ${brokerRows.length} rows`);

  const { rows: configRows } = await configClient.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "${table}"`,
  );
  const configCount = parseInt(configRows[0]?.count ?? '0', 10);

  if (configCount > 0) {
    console.log(`  [${table}] config already has ${configCount} rows — skipping`);
    return;
  }
  if (brokerRows.length === 0) {
    console.log(`  [${table}] nothing to migrate`);
    return;
  }

  const BATCH = 100;
  for (let i = 0; i < brokerRows.length; i += BATCH) {
    const batch = brokerRows.slice(i, i + BATCH);
    const valuePlaceholders = batch.map((_, rowIdx) => {
      const placeholders = columns.map((_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`);
      return `(${placeholders.join(', ')})`;
    });
    const rawColNames = columns.map((col) => col.replace(/"/g, ''));
    const values = batch.flatMap((row) => rawColNames.map((col) => row[col] ?? null));
    await configClient.query(
      `INSERT INTO "${table}" (${colList}) VALUES ${valuePlaceholders.join(', ')} ON CONFLICT DO NOTHING`,
      values,
    );
  }

  const { rows: verifyRows } = await configClient.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "${table}"`,
  );
  const migratedCount = parseInt(verifyRows[0]?.count ?? '0', 10);
  if (migratedCount !== brokerRows.length) {
    throw new Error(`[${table}] row count mismatch: broker=${brokerRows.length} config=${migratedCount}`);
  }
  console.log(`  [${table}] migrated ${migratedCount} rows ✓`);

  const pkCol = SERIAL_TABLES[table];
  if (pkCol) {
    await configClient.query(
      `SELECT setval(pg_get_serial_sequence('"${table}"', '${pkCol}'), COALESCE((SELECT MAX("${pkCol}") FROM "${table}"), 1))`,
    );
    console.log(`  [${table}] sequence advanced to MAX(${pkCol})`);
  }
}

async function main(): Promise<void> {
  await brokerClient.connect();
  await configClient.connect();
  console.log('Connected to both databases.');

  for (const { table, columns } of TABLES) {
    console.log(`Migrating ${table}...`);
    await migrateTable(table, columns);
  }

  console.log('\nMigration complete.');
  await brokerClient.end();
  await configClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
