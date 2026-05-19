import { Module } from '@nestjs/common';
import { ConfigRpcInvokeModule } from '../gateway-rpc/config-rpc-invoke.module.js';
import { ConfigRabbitmqService } from './config-rabbitmq.service.js';

@Module({
  imports: [ConfigRpcInvokeModule],
  providers: [ConfigRabbitmqService],
})
export class ConfigRabbitmqModule {}
