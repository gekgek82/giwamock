import { Logger } from '@nestjs/common';
import type {
  DynamicSwapFeeModuleCustomFeeSetIndexerBrokerPayload,
  DynamicSwapFeeModuleDefaultFeeCapSetIndexerBrokerPayload,
  DynamicSwapFeeModuleDefaultScalingFactorSetIndexerBrokerPayload,
  DynamicSwapFeeModuleDiscountedDeregisteredIndexerBrokerPayload,
  DynamicSwapFeeModuleDiscountedRegisteredIndexerBrokerPayload,
  DynamicSwapFeeModuleDynamicFeeResetIndexerBrokerPayload,
  DynamicSwapFeeModuleFeeCapSetIndexerBrokerPayload,
  DynamicSwapFeeModuleScalingFactorSetIndexerBrokerPayload,
  DynamicSwapFeeModuleSecondsAgoSetIndexerBrokerPayload,
} from '@giwater/shared';
import type { DynamicSwapFeeReadModelService } from '../../dynamic-fee/dynamic-swap-fee-read-model.service';
import type { SwapLiquidityGraphService } from '../../swap-liquidity/swap-liquidity-graph.service';

const logger = new Logger('DynamicSwapFeeModuleAggregator');

export async function aggregateDynamicSwapFeeModuleCustomFeeSet(
  payload: DynamicSwapFeeModuleCustomFeeSetIndexerBrokerPayload,
  swapGraph: SwapLiquidityGraphService,
  readModel: DynamicSwapFeeReadModelService,
): Promise<void> {
  await Promise.all([
    swapGraph.onDynamicSwapFeeModuleCustomFeeSet(payload),
    readModel.onCustomFeeSet(payload),
  ]);
  logger.debug(`DynamicSwapFeeModuleCustomFeeSet aggregated id=${payload.id}`);
}

export async function aggregateDynamicSwapFeeModuleDynamicFeeReset(
  payload: DynamicSwapFeeModuleDynamicFeeResetIndexerBrokerPayload,
  swapGraph: SwapLiquidityGraphService,
  readModel: DynamicSwapFeeReadModelService,
): Promise<void> {
  await Promise.all([
    swapGraph.onDynamicSwapFeeModuleDynamicFeeReset(payload),
    readModel.onDynamicFeeReset(payload),
  ]);
  logger.debug(`DynamicSwapFeeModuleDynamicFeeReset aggregated id=${payload.id}`);
}

export async function aggregateDynamicSwapFeeModuleDefaultFeeCapSet(
  payload: DynamicSwapFeeModuleDefaultFeeCapSetIndexerBrokerPayload,
  readModel: DynamicSwapFeeReadModelService,
): Promise<void> {
  await readModel.onDefaultFeeCapSet(payload);
  logger.debug(
    `DynamicSwapFeeModuleDefaultFeeCapSet aggregated defaultFeeCap=${payload.defaultFeeCap} id=${payload.id}`,
  );
}

export async function aggregateDynamicSwapFeeModuleDefaultScalingFactorSet(
  payload: DynamicSwapFeeModuleDefaultScalingFactorSetIndexerBrokerPayload,
  readModel: DynamicSwapFeeReadModelService,
): Promise<void> {
  await readModel.onDefaultScalingFactorSet(payload);
  logger.debug(
    `DynamicSwapFeeModuleDefaultScalingFactorSet aggregated defaultScalingFactor=${payload.defaultScalingFactor} id=${payload.id}`,
  );
}

export async function aggregateDynamicSwapFeeModuleDiscountedDeregistered(
  payload: DynamicSwapFeeModuleDiscountedDeregisteredIndexerBrokerPayload,
  readModel: DynamicSwapFeeReadModelService,
): Promise<void> {
  await readModel.onDiscountedDeregistered(payload);
  logger.debug(
    `DynamicSwapFeeModuleDiscountedDeregistered aggregated discountOver=${payload.discountOver} id=${payload.id}`,
  );
}

export async function aggregateDynamicSwapFeeModuleDiscountedRegistered(
  payload: DynamicSwapFeeModuleDiscountedRegisteredIndexerBrokerPayload,
  readModel: DynamicSwapFeeReadModelService,
): Promise<void> {
  await readModel.onDiscountedRegistered(payload);
  logger.debug(
    `DynamicSwapFeeModuleDiscountedRegistered aggregated discountReceiver=${payload.discountReceiver} id=${payload.id}`,
  );
}

export async function aggregateDynamicSwapFeeModuleFeeCapSet(
  payload: DynamicSwapFeeModuleFeeCapSetIndexerBrokerPayload,
  readModel: DynamicSwapFeeReadModelService,
): Promise<void> {
  await readModel.onFeeCapSet(payload);
  logger.debug(
    `DynamicSwapFeeModuleFeeCapSet aggregated pool=${payload.pool} feeCap=${payload.feeCap} id=${payload.id}`,
  );
}

export async function aggregateDynamicSwapFeeModuleScalingFactorSet(
  payload: DynamicSwapFeeModuleScalingFactorSetIndexerBrokerPayload,
  readModel: DynamicSwapFeeReadModelService,
): Promise<void> {
  await readModel.onScalingFactorSet(payload);
  logger.debug(
    `DynamicSwapFeeModuleScalingFactorSet aggregated pool=${payload.pool} scalingFactor=${payload.scalingFactor} id=${payload.id}`,
  );
}

export async function aggregateDynamicSwapFeeModuleSecondsAgoSet(
  payload: DynamicSwapFeeModuleSecondsAgoSetIndexerBrokerPayload,
  readModel: DynamicSwapFeeReadModelService,
): Promise<void> {
  await readModel.onSecondsAgoSet(payload);
  logger.debug(
    `DynamicSwapFeeModuleSecondsAgoSet aggregated secondsAgo=${payload.secondsAgo} id=${payload.id}`,
  );
}
