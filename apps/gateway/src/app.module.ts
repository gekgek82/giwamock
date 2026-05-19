import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { ApiModule } from './api/api.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { HttpCacheModule } from './http-cache';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { RedisModule } from './redis/redis.module';
import { WsModule } from './ws/ws.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    EventsModule,
    RedisModule,
    HttpCacheModule,
    RabbitmqModule,
    HealthModule,
    ApiModule,
    WsModule,
  ],
})
export class AppModule {}
