import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountNotificationModule } from '../account-notifications/account-notification.module';
import { ExchangeModule } from '../exchange/exchange.module';
import { PricingModule } from '../pricing/pricing.module';
import { SpotPairEntity } from '../models/pair/spot-pair.entity';
import { SpotPairTimeBucketEntity } from '../models/pair/spot-pair-time-bucket.entity';
import { SpotTokenEntity } from '../models/token/spot-token.entity';
import { SpotTokenTimeBucketEntity } from '../models/token/spot-token-time-bucket.entity';
import { SwapBucketStateEntity } from '../models/swap/swap-bucket-state.entity';
import { SwapLiquidityEdgeEntity } from '../models/swap/swap-liquidity-edge.entity';
import { SwapOhlcvAggregationService } from './swap-ohlcv-aggregation.service';
import { TimeBucketPruneService } from './time-bucket-prune.service';

@Module({
  imports: [
    AccountNotificationModule,
    ExchangeModule,
    PricingModule,
    TypeOrmModule.forFeature([
      SpotPairEntity,
      SpotPairTimeBucketEntity,
      SpotTokenEntity,
      SpotTokenTimeBucketEntity,
      SwapBucketStateEntity,
      SwapLiquidityEdgeEntity,
    ]),
  ],
  providers: [SwapOhlcvAggregationService, TimeBucketPruneService],
  exports: [SwapOhlcvAggregationService, TimeBucketPruneService],
})
export class SwapOhlcvModule {}
