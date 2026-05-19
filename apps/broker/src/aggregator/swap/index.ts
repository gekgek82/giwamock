import type { SwapIndexerBrokerPayload } from '@giwater/shared';
import type { SwapLiquidityGraphService } from '../../swap-liquidity/swap-liquidity-graph.service';
import type { SwapOhlcvAggregationService } from '../../swap-ohlcv/swap-ohlcv-aggregation.service';

export async function aggregateSwap(
  payload: SwapIndexerBrokerPayload,
  swapGraph: SwapLiquidityGraphService,
  swapOhlcv: SwapOhlcvAggregationService,
): Promise<{ pool: string | null }> {
  await swapGraph.onSwap(payload);
  return swapOhlcv.onSwap(payload);
}
