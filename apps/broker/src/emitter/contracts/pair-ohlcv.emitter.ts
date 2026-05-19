import type { BrokerGatewayWsEmitV1 } from '@giwater/shared';
import { PAIR_OHLCV_EVENT, type PairOhlcvUpdateDto } from '@giwater/shared';
import { pairChannel } from '../channel-names';
import { wsEmit } from '../ws-emit';

export function buildPairOhlcvEmit(
  data: PairOhlcvUpdateDto,
): BrokerGatewayWsEmitV1 | null {
  const ch = pairChannel(data.pool);
  if (!ch) return null;
  return wsEmit(ch, PAIR_OHLCV_EVENT, data);
}
