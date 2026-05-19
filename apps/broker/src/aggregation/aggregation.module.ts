import { Module } from '@nestjs/common';
import { DynamicSwapFeeModule } from '../dynamic-fee/dynamic-swap-fee.module';
import { PricingModule } from '../pricing/pricing.module';
import { BrokerSwapHopModule } from '../swap-hop/broker-swap-hop.module';
import { SwapLiquidityModule } from '../swap-liquidity/swap-liquidity.module';
import { SwapOhlcvModule } from '../swap-ohlcv/swap-ohlcv.module';
import { IndexerAggregationService } from './indexer-aggregation.service';

@Module({
  imports: [
    SwapLiquidityModule,
    SwapOhlcvModule,
    PricingModule,
    DynamicSwapFeeModule,
    BrokerSwapHopModule,
  ],
  providers: [IndexerAggregationService],
  exports: [IndexerAggregationService, PricingModule],
})
export class AggregationModule {}
