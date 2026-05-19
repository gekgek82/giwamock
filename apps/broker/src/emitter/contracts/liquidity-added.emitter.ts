import type {
  BrokerGatewayWsEmitV1,
  LiquidityAddedIndexerBrokerPayload,
} from '@giwater/shared';
import { tokenChannel } from '../channel-names';
import { wsEmit } from '../ws-emit';

const EVENT = 'onchain.LiquidityAdded';

export function buildLiquidityAddedEmits(
  payload: LiquidityAddedIndexerBrokerPayload,
): BrokerGatewayWsEmitV1[] {
  const out: BrokerGatewayWsEmitV1[] = [];
  const t0 = tokenChannel(payload.token0);
  const t1 = tokenChannel(payload.token1);
  if (t0) out.push(wsEmit(t0, EVENT, payload));
  if (t1) out.push(wsEmit(t1, EVENT, payload));
  return out;
}
