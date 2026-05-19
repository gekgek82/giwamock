import { Module } from '@nestjs/common';
import { TradingGateway } from './trading.gateway';
import { WsSubscriptionModule } from './subscription/ws-subscription.module';

@Module({
  imports: [WsSubscriptionModule],
  providers: [TradingGateway],
})
export class WsModule {}
