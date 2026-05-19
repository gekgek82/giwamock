import type { SpotTokenLeaderboardPageDto } from '@giwater/shared';

/**
 * Discriminator for Socket.IO `data` on {@link SPOT_TOKEN_LEADERBOARDS_GATEWAY_SOCKET_EVENT}.
 * Emitted after swap aggregation refreshes the spot-token read model.
 */
export const AGGREGATOR_SPOT_TOKEN_LEADERBOARDS_GATEWAY_UPDATE_EVENT =
  'aggregator.spotTokenLeaderboardsGatewayUpdate/v1' as const;

/** Socket.IO room for subscribers who want leaderboard snapshots. */
export const SPOT_TOKEN_LEADERBOARDS_GATEWAY_CHANNEL =
  'spot-tokens:leaderboards' as const;

/** Socket.IO event name delivered to {@link SPOT_TOKEN_LEADERBOARDS_GATEWAY_CHANNEL}. */
export const SPOT_TOKEN_LEADERBOARDS_GATEWAY_SOCKET_EVENT =
  'catalog.spotTokenLeaderboards' as const;

/** Token leaderboard snapshots keyed by metric and sort (HTTP path parity). */
export interface SpotTokenLeaderboardBoardSetV1 {
  dayChangeDesc: SpotTokenLeaderboardPageDto;
  dayChangeAsc: SpotTokenLeaderboardPageDto;
  tvlDesc: SpotTokenLeaderboardPageDto;
  tvlAsc: SpotTokenLeaderboardPageDto;
  volumeDesc: SpotTokenLeaderboardPageDto;
  volumeAsc: SpotTokenLeaderboardPageDto;
}

/**
 * Payload pushed to the gateway (Redis upsert `wsEmit.data` and clients on the leaderboard channel).
 */
export interface SpotTokenLeaderboardsGatewayUpdateEventV1 {
  readonly kind: typeof AGGREGATOR_SPOT_TOKEN_LEADERBOARDS_GATEWAY_UPDATE_EVENT;
  readonly listedDefault: SpotTokenLeaderboardBoardSetV1;
  readonly listedFalse: SpotTokenLeaderboardBoardSetV1;
}

export function buildSpotTokenLeaderboardsGatewayUpdateEvent(
  listedDefault: SpotTokenLeaderboardBoardSetV1,
  listedFalse: SpotTokenLeaderboardBoardSetV1,
): SpotTokenLeaderboardsGatewayUpdateEventV1 {
  return {
    kind: AGGREGATOR_SPOT_TOKEN_LEADERBOARDS_GATEWAY_UPDATE_EVENT,
    listedDefault,
    listedFalse,
  };
}
