import type { CLLiquidityAddedIndexerBrokerPayload } from '@giwater/shared';
import type { SwapLiquidityGraphService } from '../../swap-liquidity/swap-liquidity-graph.service';

export async function aggregateCLLiquidityAdded(
  payload: CLLiquidityAddedIndexerBrokerPayload,
  swapGraph: SwapLiquidityGraphService,
): Promise<void> {
  await swapGraph.onCLLiquidityAdded(payload);
}
