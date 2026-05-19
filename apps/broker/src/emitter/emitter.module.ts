import { Module, forwardRef } from '@nestjs/common';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module';
import { SpotCatalogModule } from '../spot-catalog/spot-catalog.module';
import { BrokerGatewayHttpCachePublishService } from './broker-gateway-http-cache-publish.service';
import { BrokerGatewayWsFanoutService } from './broker-gateway-ws-fanout.service';

@Module({
  imports: [SpotCatalogModule, forwardRef(() => RabbitmqModule)],
  providers: [BrokerGatewayWsFanoutService, BrokerGatewayHttpCachePublishService],
  exports: [BrokerGatewayWsFanoutService, BrokerGatewayHttpCachePublishService],
})
export class EmitterModule {}
