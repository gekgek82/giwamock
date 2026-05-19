import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BROKER_GATEWAY_HTTP_CACHE_UPSERT_SCHEMA,
  BROKER_GATEWAY_WS_EMIT_SCHEMA,
  type BrokerGatewayHttpCacheUpsertEntryV1,
  type BrokerGatewayHttpCacheUpsertV1,
  type BrokerGatewayWsEmitV1,
} from '@giwater/shared';
import {
  buildSpotTokenLeaderboardsGatewayUpdateEvent,
  SPOT_TOKEN_LEADERBOARDS_GATEWAY_CHANNEL,
  SPOT_TOKEN_LEADERBOARDS_GATEWAY_SOCKET_EVENT,
} from '../aggregator/event';
import type { BrokerConfig } from '../config/configuration';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { SpotCatalogService } from '../spot-catalog/spot-catalog.service';

/**
 * After indexer-driven aggregation, pushes precomputed HTTP cache rows + optional WS payload
 * so the gateway can refresh Redis without a follow-up broker RPC storm.
 */
@Injectable()
export class BrokerGatewayHttpCachePublishService {
  private readonly logger = new Logger(BrokerGatewayHttpCachePublishService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly spotCatalog: SpotCatalogService,
    @Inject(forwardRef(() => RabbitmqService))
    private readonly rabbitmq: RabbitmqService,
  ) {}

  private get rabbit(): BrokerConfig['rabbitmq'] {
    return this.configService.getOrThrow<BrokerConfig['rabbitmq']>('rabbitmq');
  }

  /**
   * Invoked after `fanOutFromIndexerPayload` so prior HTTP cache invalidations have run;
   * repopulates common spot-token leaderboard keys from the updated read model.
   */
  async publishAfterIndexerFanout(parsed: unknown): Promise<void> {
    if (typeof parsed !== 'object' || parsed === null) return;
    const type = (parsed as Record<string, unknown>).type;
    if (type !== 'Swap') return;

    const { gatewayWsEmitRoutingKey } = this.rabbit;
    try {
      const offset = 0;
      const limit = 50;
      const entries: BrokerGatewayHttpCacheUpsertEntryV1[] = [];

      const dayDescTrue = await this.spotCatalog.listTokensLeaderboardDayChange(
        offset,
        limit,
        true,
        'desc',
      );
      const dayDescFalse = await this.spotCatalog.listTokensLeaderboardDayChange(
        offset,
        limit,
        false,
        'desc',
      );
      const dayAscTrue = await this.spotCatalog.listTokensLeaderboardDayChange(
        offset,
        limit,
        true,
        'asc',
      );
      const dayAscFalse = await this.spotCatalog.listTokensLeaderboardDayChange(
        offset,
        limit,
        false,
        'asc',
      );
      const tvlDescTrue = await this.spotCatalog.listTokensLeaderboardTvl(
        offset,
        limit,
        true,
        'desc',
      );
      const tvlDescFalse = await this.spotCatalog.listTokensLeaderboardTvl(
        offset,
        limit,
        false,
        'desc',
      );
      const tvlAscTrue = await this.spotCatalog.listTokensLeaderboardTvl(
        offset,
        limit,
        true,
        'asc',
      );
      const tvlAscFalse = await this.spotCatalog.listTokensLeaderboardTvl(
        offset,
        limit,
        false,
        'asc',
      );
      const volDescTrue = await this.spotCatalog.listTokensLeaderboardVolume(
        offset,
        limit,
        true,
        'desc',
      );
      const volDescFalse = await this.spotCatalog.listTokensLeaderboardVolume(
        offset,
        limit,
        false,
        'desc',
      );
      const volAscTrue = await this.spotCatalog.listTokensLeaderboardVolume(
        offset,
        limit,
        true,
        'asc',
      );
      const volAscFalse = await this.spotCatalog.listTokensLeaderboardVolume(
        offset,
        limit,
        false,
        'asc',
      );

      const board = (pathSuffix: string, body: unknown, listed: boolean) => {
        const q = `?offset=${offset}&limit=${limit}&listed=${listed}`;
        entries.push({
          key: `GET:/spot-tokens/leaderboard/${pathSuffix}${q}`,
          body,
        });
      };
      board('day-change/desc', dayDescTrue, true);
      board('day-change/desc', dayDescFalse, false);
      board('day-change/asc', dayAscTrue, true);
      board('day-change/asc', dayAscFalse, false);
      board('tvl/desc', tvlDescTrue, true);
      board('tvl/desc', tvlDescFalse, false);
      board('tvl/asc', tvlAscTrue, true);
      board('tvl/asc', tvlAscFalse, false);
      board('volume/desc', volDescTrue, true);
      board('volume/desc', volDescFalse, false);
      board('volume/asc', volAscTrue, true);
      board('volume/asc', volAscFalse, false);

      entries.push(
        {
          key: 'GET:/spot-tokens/leaderboard/day-change/desc',
          body: dayDescTrue,
        },
        {
          key: 'GET:/spot-tokens/leaderboard/day-change/asc',
          body: dayAscTrue,
        },
        { key: 'GET:/spot-tokens/leaderboard/tvl/desc', body: tvlDescTrue },
        { key: 'GET:/spot-tokens/leaderboard/volume/desc', body: volDescTrue },
      );

      const wsEmit: BrokerGatewayWsEmitV1 = {
        schema: BROKER_GATEWAY_WS_EMIT_SCHEMA,
        channel: SPOT_TOKEN_LEADERBOARDS_GATEWAY_CHANNEL,
        event: SPOT_TOKEN_LEADERBOARDS_GATEWAY_SOCKET_EVENT,
        data: buildSpotTokenLeaderboardsGatewayUpdateEvent(
          {
            dayChangeDesc: dayDescTrue,
            dayChangeAsc: dayAscTrue,
            tvlDesc: tvlDescTrue,
            tvlAsc: tvlAscTrue,
            volumeDesc: volDescTrue,
            volumeAsc: volAscTrue,
          },
          {
            dayChangeDesc: dayDescFalse,
            dayChangeAsc: dayAscFalse,
            tvlDesc: tvlDescFalse,
            tvlAsc: tvlAscFalse,
            volumeDesc: volDescFalse,
            volumeAsc: volAscFalse,
          },
        ),
      };

      const upsert: BrokerGatewayHttpCacheUpsertV1 = {
        schema: BROKER_GATEWAY_HTTP_CACHE_UPSERT_SCHEMA,
        entries,
        wsEmit,
      };

      const ok = await this.rabbitmq.publishToGateway(
        gatewayWsEmitRoutingKey,
        upsert,
      );
      if (!ok) {
        this.logger.warn('publishToGateway returned false for http-cache-upsert');
      }
    } catch (err) {
      this.logger.error(
        `HTTP cache upsert publish failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
