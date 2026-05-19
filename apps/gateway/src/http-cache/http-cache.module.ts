import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HttpCacheInterceptor } from '../interceptors/http-cache.interceptor';
import { RedisModule } from '../redis/redis.module';
import { GatewayHttpCacheInvalidationService } from './gateway-http-cache-invalidation.service';
import { GatewayHttpCacheUpsertService } from './gateway-http-cache-upsert.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [
    GatewayHttpCacheInvalidationService,
    GatewayHttpCacheUpsertService,
    HttpCacheInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: HttpCacheInterceptor },
  ],
  exports: [
    GatewayHttpCacheInvalidationService,
    GatewayHttpCacheUpsertService,
    HttpCacheInterceptor,
  ],
})
export class HttpCacheModule {}
