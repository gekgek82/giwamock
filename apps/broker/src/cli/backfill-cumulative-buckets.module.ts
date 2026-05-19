import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '../config/configuration';
import { BrokerDbModule } from '../broker-db/broker-db.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    BrokerDbModule,
  ],
})
export class BackfillCumulativeBucketsModule {}

