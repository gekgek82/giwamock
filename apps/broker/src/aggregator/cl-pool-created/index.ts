import type { CLPoolCreatedIndexerBrokerPayload } from '@giwater/shared';
import type { SwapLiquidityGraphService } from '../../swap-liquidity/swap-liquidity-graph.service';

export async function aggregateCLPoolCreated(
  payload: CLPoolCreatedIndexerBrokerPayload,
  swapGraph: SwapLiquidityGraphService,
): Promise<void> {
  await swapGraph.onCLPoolCreated(payload);
}
