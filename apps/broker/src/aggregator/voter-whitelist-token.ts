import type { VoterWhitelistTokenIndexerBrokerPayload } from '@giwater/shared';
import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';

const logger = new Logger('VoterWhitelistTokenAggregator');

/**
 * Handles Voter.WhitelistToken events.
 *
 * 1. Upserts the token's whitelist status into `voter_whitelisted_tokens`.
 * 2. Recalculates `gaugeWhitelisted` on every `spot_pairs` row that contains
 *    this token — true when BOTH token0 and token1 appear in the whitelist table
 *    with `whitelisted = true`.
 */
export async function aggregateVoterWhitelistToken(
  payload: VoterWhitelistTokenIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { token, whitelisted } = payload;
  if (!token) {
    logger.warn('aggregateVoterWhitelistToken: missing token, skipping');
    return;
  }

  const tokenAddr = token.toLowerCase();

  // Ensure the tracking table exists (idempotent).
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS voter_whitelisted_tokens (
      token text PRIMARY KEY,
      whitelisted boolean NOT NULL DEFAULT false
    )
  `);

  // Upsert the token's whitelist status.
  await dataSource.query(
    `INSERT INTO voter_whitelisted_tokens (token, whitelisted)
     VALUES ($1, $2)
     ON CONFLICT (token) DO UPDATE SET whitelisted = EXCLUDED.whitelisted`,
    [tokenAddr, whitelisted],
  );

  // Update gaugeWhitelisted on all pairs where this token appears.
  const result = await dataSource.query(`
    UPDATE spot_pairs sp
    SET "gaugeWhitelisted" = (
      COALESCE(
        (SELECT vt.whitelisted FROM voter_whitelisted_tokens vt WHERE vt.token = LOWER(sp.token0)),
        false
      )
      AND
      COALESCE(
        (SELECT vt.whitelisted FROM voter_whitelisted_tokens vt WHERE vt.token = LOWER(sp.token1)),
        false
      )
    )
    WHERE LOWER(sp.token0) = $1 OR LOWER(sp.token1) = $1
  `, [tokenAddr]);

  logger.log(
    `aggregateVoterWhitelistToken: token=${tokenAddr} whitelisted=${whitelisted} — ${result[1] ?? 0} pairs updated`,
  );
}
