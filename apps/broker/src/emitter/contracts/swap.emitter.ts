import type {
  BrokerGatewayWsEmitV1,
  SwapIndexerBrokerPayload,
} from '@giwater/shared';
import { tokenChannel } from '../channel-names';
import { wsEmit } from '../ws-emit';

const EVENT = 'onchain.Swap';

export function buildSwapEmits(
  payload: SwapIndexerBrokerPayload,
): BrokerGatewayWsEmitV1[] {
  const out: BrokerGatewayWsEmitV1[] = [];
  const tin = tokenChannel(payload.tokenIn);
  const tout = tokenChannel(payload.tokenOut);
  if (tin) out.push(wsEmit(tin, EVENT, payload));
  if (tout) out.push(wsEmit(tout, EVENT, payload));
  return out;
}
