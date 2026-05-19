import { Global, Module } from '@nestjs/common';
import { GatewayRabbitmqService } from './gateway-rabbitmq.service';

@Global()
@Module({
  providers: [GatewayRabbitmqService],
  exports: [GatewayRabbitmqService],
})
export class RabbitmqModule {}
