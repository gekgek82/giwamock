import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { GatewayConfig } from '../config/configuration';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly configService: ConfigService) {}

  private get redisConfig(): GatewayConfig['redis'] {
    return this.configService.getOrThrow<GatewayConfig['redis']>('redis');
  }

  onModuleInit(): void {
    const { url } = this.redisConfig;
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    this.client.on('error', (err) =>
      this.logger.error(`Redis error: ${err.message}`),
    );
    this.client.on('connect', () => this.logger.log('Redis connected'));
  }

  onModuleDestroy(): void {
    void this.client?.quit();
  }

  private fullKey(key: string): string {
    return `${this.redisConfig.keyPrefix}${key}`;
  }

  async getJson(key: string): Promise<unknown | null> {
    const raw = await this.client.get(this.fullKey(key));
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSec: number,
  ): Promise<void> {
    await this.client.set(
      this.fullKey(key),
      JSON.stringify(value),
      'EX',
      Math.max(1, ttlSec),
    );
  }

  async del(key: string): Promise<void> {
    await this.client.del(this.fullKey(key));
  }

  /**
   * Deletes all full Redis keys where internal cache key starts with `internalPrefix`
   * (e.g. `GET:/swap-routes` matches `GET:/swap-routes?from=...`).
   */
  async unlinkByInternalCacheKeyPrefix(internalPrefix: string): Promise<number> {
    const pattern = `${this.redisConfig.keyPrefix}${escapeRedisGlob(internalPrefix)}*`;
    let cursor = '0';
    let deleted = 0;
    do {
      const [next, keys] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        128,
      );
      cursor = next;
      if (keys.length > 0) {
        deleted += await this.client.unlink(...keys);
      }
    } while (cursor !== '0');
    return deleted;
  }
}

function escapeRedisGlob(s: string): string {
  let out = '';
  for (const ch of s) {
    if (ch === '*' || ch === '?' || ch === '[' || ch === '\\') {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return out;
}
