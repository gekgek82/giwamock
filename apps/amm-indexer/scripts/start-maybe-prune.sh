#!/usr/bin/env bash
# Start the Ponder indexer, always dropping the app schema first.
#
# The app schema is always dropped so that rolling deployments never hit
# Ponder's "schema was used by a different app" migration error. The
# ponder_sync schema is preserved, so re-indexing reads from the sync cache
# rather than re-fetching from RPC.
set -euo pipefail

SCHEMA="${INDEXER_DATABASE_SCHEMA_NAME:-amm_indexer}"

echo "[start] Dropping app schema '${SCHEMA}' before start (ponder_sync preserved)..."
bash "$(dirname "$0")/prune-app-schema.sh"
echo "[start] Prune complete. Starting indexer..."

exec ponder start --schema "${SCHEMA}"
