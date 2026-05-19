import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '../config/configuration';
import { BrokerDbModule } from '../broker-db/broker-db.module';
import { TimeBucketPruneService } from '../swap-ohlcv/time-bucket-prune.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    BrokerDbModule,
  ],
  providers: [TimeBucketPruneService],
})
export class PruneTimeBucketsModule {}
