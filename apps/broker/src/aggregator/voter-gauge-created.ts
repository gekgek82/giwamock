import type { VoterGaugeCreatedIndexerBrokerPayload } from '@giwater/shared';
import { Logger } from '@nestjs/common';

const logger = new Logger('VoterGaugeCreatedAggregator');

/**
 * Gauge wiring is persisted in `indexed_events`; staking APIs read from there + on-chain views.
 */
export async function aggregateVoterGaugeCreated(
  _payload: VoterGaugeCreatedIndexerBrokerPayload,
): Promise<void> {
  logger.debug('aggregateVoterGaugeCreated: no-op (payload stored in indexed_events)');
}
