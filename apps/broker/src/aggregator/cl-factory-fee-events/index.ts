import { Logger } from '@nestjs/common';
import type {
  CLFactoryDefaultUnstakedFeeChangedIndexerBrokerPayload,
  CLFactorySwapFeeModuleChangedIndexerBrokerPayload,
} from '@giwater/shared';
import type { DynamicSwapFeeReadModelService } from '../../dynamic-fee/dynamic-swap-fee-read-model.service';

const logger = new Logger('CLFactoryFeeAggregator');

export async function aggregateCLFactoryDefaultUnstakedFeeChanged(
  payload: CLFactoryDefaultUnstakedFeeChangedIndexerBrokerPayload,
  readModel: DynamicSwapFeeReadModelService,
): Promise<void> {
  await readModel.onCLFactoryDefaultUnstakedFeeChanged(payload);
  logger.debug(
    `CLFactoryDefaultUnstakedFeeChanged aggregated newUnstakedFee=${payload.newUnstakedFee} id=${payload.id}`,
  );
}

export async function aggregateCLFactorySwapFeeModuleChanged(
  payload: CLFactorySwapFeeModuleChangedIndexerBrokerPayload,
  readModel: DynamicSwapFeeReadModelService,
): Promise<void> {
  await readModel.onCLFactorySwapFeeModuleChanged(payload);
  logger.debug(
    `CLFactorySwapFeeModuleChanged aggregated newFeeModule=${payload.newFeeModule} id=${payload.id}`,
  );
}
