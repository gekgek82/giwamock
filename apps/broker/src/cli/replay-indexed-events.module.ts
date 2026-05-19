import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '../config/configuration';
import { BrokerDbModule } from '../broker-db/broker-db.module';
import { AggregationModule } from '../aggregation/aggregation.module';
import { ReplayIndexedEventsRunnerService } from './replay-indexed-events.runner';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    BrokerDbModule,
    AggregationModule,
  ],
  providers: [ReplayIndexedEventsRunnerService],
})
export class ReplayIndexedEventsModule {}
