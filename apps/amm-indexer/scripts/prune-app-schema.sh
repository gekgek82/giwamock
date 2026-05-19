#!/usr/bin/env bash
# Drops only the Ponder app schema (indexed tables) so the indexer re-processes
# from the ponder_sync cache on next start — no RPC re-fetch needed.
#
# Usage:
#   INDEXER_DATABASE_SCHEMA_NAME=amm-indexer DATABASE_URL=postgres://... bash scripts/prune-app-schema.sh
#
# On Railway: run as a one-off command via `railway run pnpm railway:indexer:prune`
# then restart the indexer service.
set -euo pipefail

SCHEMA="${INDEXER_DATABASE_SCHEMA_NAME:-amm_indexer}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

echo "Dropping app schema '${SCHEMA}' (ponder_sync is preserved)..."
node --input-type=module <<EOF
import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query('DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE');
await client.end();
EOF
echo "Done. Restart the indexer — it will re-index from the ponder_sync cache."
