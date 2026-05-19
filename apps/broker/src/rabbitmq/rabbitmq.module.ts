import { Global, Module, forwardRef } from '@nestjs/common';
import { AggregationModule } from '../aggregation/aggregation.module';
import { EmitterModule } from '../emitter/emitter.module';
import { GatewayRpcInvokeModule } from '../gateway-rpc/gateway-rpc-invoke.module';
import { RabbitmqService } from './rabbitmq.service';

@Global()
@Module({
  imports: [
    AggregationModule,
    GatewayRpcInvokeModule,
    forwardRef(() => EmitterModule),
  ],
  providers: [RabbitmqService],
  exports: [RabbitmqService],
})
export class RabbitmqModule {}
