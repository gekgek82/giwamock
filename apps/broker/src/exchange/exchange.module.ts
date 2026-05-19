import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpotExchangeEntity } from '../models/exchange/spot-exchange.entity';
import { SpotExchangeTimeBucketEntity } from '../models/exchange/spot-exchange-time-bucket.entity';
import { ExchangeAdminService } from './exchange-admin.service';
import { ExchangeRollupService } from './exchange-rollup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SpotExchangeEntity,
      SpotExchangeTimeBucketEntity,
    ]),
  ],
  providers: [ExchangeRollupService, ExchangeAdminService],
  exports: [ExchangeRollupService, ExchangeAdminService],
})
export class ExchangeModule {}
