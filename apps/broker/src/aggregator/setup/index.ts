import { Logger } from '@nestjs/common';
import type { SetupIndexerBrokerPayload } from '@giwater/shared';

const logger = new Logger('AggSetup');

export async function aggregateSetup(
  payload: SetupIndexerBrokerPayload,
): Promise<void> {
  logger.debug(`aggregateSetup invoked for type=${payload.type}`);
}
