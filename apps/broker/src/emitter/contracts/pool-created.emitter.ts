import type {
  BrokerGatewayWsEmitV1,
  PoolCreatedIndexerBrokerPayload,
} from '@giwater/shared';
import { pairChannel, tokenChannel } from '../channel-names';
import { wsEmit } from '../ws-emit';

const EVENT = 'onchain.PoolCreated';

export function buildPoolCreatedEmits(
  payload: PoolCreatedIndexerBrokerPayload,
): BrokerGatewayWsEmitV1[] {
  const out: BrokerGatewayWsEmitV1[] = [];
  const pc = pairChannel(payload.pool);
  const t0 = tokenChannel(payload.token0);
  const t1 = tokenChannel(payload.token1);
  if (pc) out.push(wsEmit(pc, EVENT, payload));
  if (t0) out.push(wsEmit(t0, EVENT, payload));
  if (t1) out.push(wsEmit(t1, EVENT, payload));
  return out;
}
