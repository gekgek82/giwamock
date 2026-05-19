import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BrokerGatewayHttpCacheUpsertV1 } from '@giwater/shared';
import { isBrokerGatewayHttpCacheUpsertV1 } from '@giwater/shared';
import type { GatewayConfig } from '../config/configuration';
import { GatewayEventsService } from '../events/gateway-events.service';
import { RedisService } from '../redis/redis.service';

interface HttpCacheEnvelope {
  body: unknown;
  storedAtMs: number;
}

@Injectable()
export class GatewayHttpCacheUpsertService {
  private readonly logger = new Logger(GatewayHttpCacheUpsertService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    private readonly gatewayEvents: GatewayEventsService,
  ) {}

  private get redisCfg(): GatewayConfig['redis'] {
    return this.configService.getOrThrow<GatewayConfig['redis']>('redis');
  }

  /**
   * @returns true when this payload was handled (caller should not broadcast it as a generic notify).
   */
  async applyBrokerPayload(payload: unknown): Promise<boolean> {
    if (!isBrokerGatewayHttpCacheUpsertV1(payload)) {
      return false;
    }
    await this.applyUpsert(payload);
    return true;
  }

  async applyUpsert(dto: BrokerGatewayHttpCacheUpsertV1): Promise<void> {
    const { defaultTtlSec: freshSec, staleExtraTtlSec } = this.redisCfg;
    const totalTtlSec = Math.max(1, freshSec) + Math.max(0, staleExtraTtlSec);
    const now = Date.now();

    for (const e of dto.entries) {
      const envelope: HttpCacheEnvelope = { body: e.body, storedAtMs: now };
      await this.redis.setJson(e.key, envelope, totalTtlSec);
    }

    this.logger.log(
      `HTTP cache upsert ${dto.entries.length} key(s)${dto.wsEmit ? ' + ws emit' : ''}`,
    );

    if (dto.wsEmit) {
      this.gatewayEvents.emitBrokerNotification(dto.wsEmit);
    }
  }
}
