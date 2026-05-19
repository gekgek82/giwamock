import { Module } from '@nestjs/common';
import { WsClientChannelsService } from './ws-client-channels.service';

@Module({
  providers: [WsClientChannelsService],
  exports: [WsClientChannelsService],
})
export class WsSubscriptionModule {}
