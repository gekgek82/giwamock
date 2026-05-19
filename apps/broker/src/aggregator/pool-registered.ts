import type { PoolRegisteredIndexerBrokerPayload } from '@giwater/shared';
import { Logger } from '@nestjs/common';

const logger = new Logger('PoolRegisteredAggregator');

/**
 * Pool discovery rows are already persisted in `indexed_events` before this runs.
 * Reserved for future broker read-models (e.g. cross-check with `spot_pairs`).
 */
export async function aggregatePoolRegistered(
  _payload: PoolRegisteredIndexerBrokerPayload,
): Promise<void> {
  logger.debug('aggregatePoolRegistered: no-op (payload stored in indexed_events)');
}
