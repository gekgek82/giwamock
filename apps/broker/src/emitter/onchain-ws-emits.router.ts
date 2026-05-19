import type {
  BrokerGatewayWsEmitV1,
  CLLiquidityAddedIndexerBrokerPayload,
  CLPoolCreatedIndexerBrokerPayload,
  IndexerBrokerQueuePayload,
  LiquidityAddedIndexerBrokerPayload,
  PoolCreatedIndexerBrokerPayload,
  SwapIndexerBrokerPayload,
} from '@giwater/shared';
import { buildCLLiquidityAddedEmits } from './contracts/cl-liquidity-added.emitter';
import { buildCLPoolCreatedEmits } from './contracts/cl-pool-created.emitter';
import { buildLiquidityAddedEmits } from './contracts/liquidity-added.emitter';
import { buildPoolCreatedEmits } from './contracts/pool-created.emitter';
import { buildSwapEmits } from './contracts/swap.emitter';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * Maps a parsed indexer queue JSON body to zero or more targeted gateway Socket.IO emits.
 */
export function routeIndexerPayloadToWsEmits(
  parsed: unknown,
): BrokerGatewayWsEmitV1[] {
  if (!isRecord(parsed)) return [];
  const type = parsed.type;
  if (typeof type !== 'string') return [];

  /** Avoid `Record<string, unknown>` → payload overlap errors; runtime shape is indexer JSON. */
  const body = parsed as unknown;

  switch (type as IndexerBrokerQueuePayload['type']) {
    case 'setup':
      return [];
    case 'PoolCreated':
      return buildPoolCreatedEmits(body as PoolCreatedIndexerBrokerPayload);
    case 'CLPoolCreated':
      return buildCLPoolCreatedEmits(body as CLPoolCreatedIndexerBrokerPayload);
    case 'LiquidityAdded':
      return buildLiquidityAddedEmits(body as LiquidityAddedIndexerBrokerPayload);
    case 'CLLiquidityAdded':
      return buildCLLiquidityAddedEmits(
        body as CLLiquidityAddedIndexerBrokerPayload,
      );
    case 'Swap':
      return buildSwapEmits(body as SwapIndexerBrokerPayload);
    default:
      return [];
  }
}
