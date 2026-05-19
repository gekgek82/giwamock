import { Injectable, Logger } from '@nestjs/common';
import type { BrokerGatewayHttpCacheInvalidateV1 } from '@giwater/shared';
import { isBrokerGatewayHttpCacheInvalidateV1 } from '@giwater/shared';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class GatewayHttpCacheInvalidationService {
  private readonly logger = new Logger(GatewayHttpCacheInvalidationService.name);

  constructor(private readonly redis: RedisService) {}

  async applyBrokerPayload(payload: unknown): Promise<boolean> {
    if (!isBrokerGatewayHttpCacheInvalidateV1(payload)) {
      return false;
    }
    const dto: BrokerGatewayHttpCacheInvalidateV1 = payload;
    const n = await this.invalidateMany(dto);
    if (n > 0) {
      this.logger.log(
        `HTTP cache invalidated ${n} keys (${dto.keyPrefixes.length} prefix(es))`,
      );
    }
    return true;
  }

  async invalidateMany(
    dto: BrokerGatewayHttpCacheInvalidateV1,
  ): Promise<number> {
    let total = 0;
    for (const prefix of dto.keyPrefixes) {
      total += await this.redis.unlinkByInternalCacheKeyPrefix(prefix);
    }
    return total;
  }
}
