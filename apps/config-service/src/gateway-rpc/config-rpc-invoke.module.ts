import { Module } from '@nestjs/common';
import { ApiModule } from '../api/api.module.js';
import { ConfigRpcInvokeService } from './config-rpc-invoke.service.js';

@Module({
  imports: [ApiModule],
  providers: [ConfigRpcInvokeService],
  exports: [ConfigRpcInvokeService],
})
export class ConfigRpcInvokeModule {}
