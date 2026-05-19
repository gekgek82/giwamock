#!/usr/bin/env bash
# Truncates all broker tables that are derived from indexer events so the broker
# can re-process them after ponder re-indexes (e.g. after an aggregation logic change).
#
# SAFE to wipe: all rows are re-derived from on-chain events.
# NOT touched:  admin/user data (banners, referrals, dynamic-fee config, spot_pair_admin_meta,
#               spot_groups, token_faucets, spot_account_follows, spot_account_notifications,
#               admin_watched_wallets, broker_pool_factory_fee_defaults).
#
# Usage:
#   BROKER_DATABASE_URL=postgres://... bash scripts/prune-indexer-derived.sh
#
# On Railway: set BROKER_DATABASE_URL env var, then run as a one-off command.
set -euo pipefail

DB_URL="${BROKER_DATABASE_URL:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "ERROR: BROKER_DATABASE_URL (or DATABASE_URL) is not set." >&2
  exit 1
fi

echo "Truncating broker indexer-derived tables..."
BROKER_DATABASE_URL="$DB_URL" node --input-type=module <<'EOF'
import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: process.env.BROKER_DATABASE_URL });
await client.connect();

// Truncated together in one statement so PostgreSQL skips FK checks between them.
await client.query(`
  TRUNCATE
    indexed_events,
    spot_pairs,
    spot_tokens,
    spot_swaps,
    swap_hops,
    swap_liquidity_edges,
    swap_bucket_state,
    spot_pair_time_buckets,
    spot_token_time_buckets,
    spot_exchange_time_buckets,
    spot_exchanges,
    spot_accounts,
    spot_account_liquidity_provisions,
    spot_account_stake_events,
    account_balance_time_buckets,
    ticks,
    liquidity_histogram_buckets,
    ve_lock_events,
    ve_lock_positions,
    voter_vote_events,
    voter_vote_positions,
    voter_reward_claims
  RESTART IDENTITY CASCADE
`);

await client.end();
EOF
echo "Done. Restart the broker — it will re-aggregate as ponder re-delivers events."
