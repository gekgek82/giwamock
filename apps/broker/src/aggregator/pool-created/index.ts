import type { PoolCreatedIndexerBrokerPayload } from '@giwater/shared';
import type { SwapLiquidityGraphService } from '../../swap-liquidity/swap-liquidity-graph.service';

export async function aggregatePoolCreated(
  payload: PoolCreatedIndexerBrokerPayload,
  swapGraph: SwapLiquidityGraphService,
): Promise<void> {
  await swapGraph.onPoolCreated(payload);
}
