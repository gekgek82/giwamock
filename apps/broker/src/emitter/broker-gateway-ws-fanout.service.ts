import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { PairOhlcvUpdateDto } from '@giwater/shared';
import type { BrokerConfig } from '../config/configuration';
import { SpotPairEntity } from '../models/pair/spot-pair.entity';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { routeIndexerPayloadToHttpCacheInvalidate } from './onchain-http-cache-invalidate.router';
import { routeIndexerPayloadToWsEmits } from './onchain-ws-emits.router';
import { buildPairOhlcvEmit } from './contracts/pair-ohlcv.emitter';

/**
 * Publishes structured `BrokerGatewayWsEmitV1` messages to the gateway exchange
 * so each gateway replica can forward them to Socket.IO rooms.
 */
@Injectable()
export class BrokerGatewayWsFanoutService {
  private readonly logger = new Logger(BrokerGatewayWsFanoutService.name);

  private readonly spotPairRepo: Repository<SpotPairEntity>;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => RabbitmqService))
    private readonly rabbitmq: RabbitmqService,
    @InjectDataSource()
    dataSource: DataSource,
  ) {
    this.spotPairRepo = dataSource.getRepository(SpotPairEntity);
  }

  private get rabbit(): BrokerConfig['rabbitmq'] {
    return this.configService.getOrThrow<BrokerConfig['rabbitmq']>('rabbitmq');
  }

  /**
   * Best-effort OHLCV push after swap aggregation.
   * Reads the updated `spot_pairs` row and emits `pair.ohlcv` to the pair room.
   */
  async fanOutPairOhlcvFromPool(pool: string, blockTs: number): Promise<void> {
    const { gatewayWsEmitRoutingKey } = this.rabbit;
    try {
      const pair = await this.spotPairRepo.findOne({ where: { id: pool } });
      if (!pair) return;
      const dto: PairOhlcvUpdateDto = {
        pool,
        ts: blockTs,
        price: pair.price,
        open: pair.dayOpen,
        high: pair.dayHigh,
        low: pair.dayLow,
        baseVolume: pair.dayBaseVolume,
        quoteVolume: pair.dayQuoteVolume,
      };
      const emit = buildPairOhlcvEmit(dto);
      if (!emit) return;
      const ok = await this.rabbitmq.publishToGateway(gatewayWsEmitRoutingKey, emit);
      if (!ok) {
        this.logger.warn(`fanOutPairOhlcvFromPool: publish failed pool=${pool}`);
      }
    } catch (err) {
      this.logger.error(
        `fanOutPairOhlcvFromPool failed pool=${pool}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Best-effort: failures are logged and do not propagate (indexer ack must not depend on WS fan-out).
   */
  async fanOutFromIndexerPayload(parsed: unknown): Promise<void> {
    const { gatewayWsEmitRoutingKey } = this.rabbit;
    try {
      const emits = routeIndexerPayloadToWsEmits(parsed);
      for (const emit of emits) {
        const ok = await this.rabbitmq.publishToGateway(
          gatewayWsEmitRoutingKey,
          emit,
        );
        if (!ok) {
          this.logger.warn(
            `publishToGateway returned false for ${emit.channel} ${emit.event}`,
          );
        }
      }

      const cacheInv = routeIndexerPayloadToHttpCacheInvalidate(parsed);
      if (cacheInv) {
        const ok = await this.rabbitmq.publishToGateway(
          gatewayWsEmitRoutingKey,
          cacheInv,
        );
        if (!ok) {
          this.logger.warn(
            'publishToGateway returned false for http-cache-invalidate',
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `WS fan-out failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
