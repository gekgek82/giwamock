import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AggregationModule } from './aggregation/aggregation.module';
import { ApiModule } from './api/api.module';
import configuration from './config/configuration';
import { CronModule } from './cron/cron.module';
import { IndexerEventsModule } from './indexer-events/indexer-events.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { BrokerDbModule } from './broker-db/broker-db.module';
import { SchemaGuardModule } from './schema-guard/schema-guard.module';
import { VeLockModule } from './ve-lock/ve-lock.module';
import { VotingModule } from './voting/voting.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    BrokerDbModule,
    SchemaGuardModule,
    AggregationModule,
    ApiModule,
    RabbitmqModule,
    IndexerEventsModule,
    CronModule,
    VeLockModule,
    VotingModule,
  ],
})
export class AppModule {}
