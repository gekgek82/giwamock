import { Logger } from '@nestjs/common';
import type {
  PoolFactorySetCustomFeeIndexerBrokerPayload,
  PoolFactorySetFeeIndexerBrokerPayload,
  PoolFactorySetFeeManagerIndexerBrokerPayload,
  PoolFactorySetPauserIndexerBrokerPayload,
  PoolFactorySetPauseStateIndexerBrokerPayload,
  PoolFactorySetVoterIndexerBrokerPayload,
} from '@giwater/shared';
import type { SwapLiquidityGraphService } from '../../swap-liquidity/swap-liquidity-graph.service';

const logger = new Logger('PoolFactoryAggregator');

export async function aggregatePoolFactorySetCustomFee(
  payload: PoolFactorySetCustomFeeIndexerBrokerPayload,
  swapGraph: SwapLiquidityGraphService,
): Promise<void> {
  await swapGraph.onPoolFactorySetCustomFee(payload);
  logger.debug(`PoolFactorySetCustomFee aggregated id=${payload.id}`);
}

export async function aggregatePoolFactorySetFee(
  payload: PoolFactorySetFeeIndexerBrokerPayload,
  swapGraph: SwapLiquidityGraphService,
): Promise<void> {
  await swapGraph.onPoolFactorySetFee(payload);
  logger.debug(`PoolFactorySetFee aggregated id=${payload.id}`);
}

export async function aggregatePoolFactorySetFeeManager(
  payload: PoolFactorySetFeeManagerIndexerBrokerPayload,
): Promise<void> {
  logger.debug(
    `PoolFactorySetFeeManager observed: feeManager=${payload.feeManager} id=${payload.id}`,
  );
}

export async function aggregatePoolFactorySetPauseState(
  payload: PoolFactorySetPauseStateIndexerBrokerPayload,
): Promise<void> {
  logger.debug(
    `PoolFactorySetPauseState observed: state=${payload.state} id=${payload.id}`,
  );
}

export async function aggregatePoolFactorySetPauser(
  payload: PoolFactorySetPauserIndexerBrokerPayload,
): Promise<void> {
  logger.debug(
    `PoolFactorySetPauser observed: pauser=${payload.pauser} id=${payload.id}`,
  );
}

export async function aggregatePoolFactorySetVoter(
  payload: PoolFactorySetVoterIndexerBrokerPayload,
): Promise<void> {
  logger.debug(
    `PoolFactorySetVoter observed: voter=${payload.voter} id=${payload.id}`,
  );
}
