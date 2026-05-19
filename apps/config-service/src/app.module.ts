import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration.js';
import { ConfigDbModule } from './config-db/config-db.module.js';
import { ApiModule } from './api/api.module.js';
import { ConfigRabbitmqModule } from './rabbitmq/config-rabbitmq.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ConfigDbModule,
    ApiModule,
    ConfigRabbitmqModule,
  ],
})
export class AppModule {}
