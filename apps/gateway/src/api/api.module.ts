import { Module } from '@nestjs/common';
import { BrokerProxyController } from './broker-proxy.controller';
import { BrokerHttpParityController } from './broker-http-parity.controller';

@Module({
  controllers: [BrokerProxyController, BrokerHttpParityController],
})
export class ApiModule {}
