import type { LiquidityAddedIndexerBrokerPayload } from '@giwater/shared';
import type { SwapLiquidityGraphService } from '../../swap-liquidity/swap-liquidity-graph.service';

export async function aggregateLiquidityAdded(
  payload: LiquidityAddedIndexerBrokerPayload,
  swapGraph: SwapLiquidityGraphService,
): Promise<void> {
  await swapGraph.onLiquidityAdded(payload);
}
