import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountNotificationModule } from '../account-notifications/account-notification.module';
import { ExchangeModule } from '../exchange/exchange.module';
import { PricingModule } from '../pricing/pricing.module';
import { BrokerPoolFactoryFeeDefaultsEntity } from '../models/config/broker-pool-factory-fee-defaults.entity';
import { SpotPairEntity } from '../models/pair/spot-pair.entity';
import { SpotTokenEntity } from '../models/token/spot-token.entity';
import { SwapLiquidityEdgeEntity } from '../models/swap/swap-liquidity-edge.entity';
import { LiquidityHistogramBucketEntity } from '../models/tick/liquidity-histogram-bucket.entity';
import { TickEntity } from '../models/tick/tick.entity';
import { SwapLiquidityGraphService } from './swap-liquidity-graph.service';
import { SwapRouteSpotPairQuoteService } from './swap-route-spot-pair-quote.service';

@Module({
  imports: [
    AccountNotificationModule,
    ExchangeModule,
    PricingModule,
    TypeOrmModule.forFeature([
      SwapLiquidityEdgeEntity,
      BrokerPoolFactoryFeeDefaultsEntity,
      SpotPairEntity,
      SpotTokenEntity,
      TickEntity,
      LiquidityHistogramBucketEntity,
    ]),
  ],
  providers: [SwapLiquidityGraphService, SwapRouteSpotPairQuoteService],
  exports: [SwapLiquidityGraphService, SwapRouteSpotPairQuoteService],
})
export class SwapLiquidityModule {}
