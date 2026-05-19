import { Module } from '@nestjs/common';
import { BrokerDbModule } from '../broker-db/broker-db.module';
import { SwapOhlcvModule } from '../swap-ohlcv/swap-ohlcv.module';
import { BrokerCronService } from './cron.service';

@Module({
  imports: [BrokerDbModule, SwapOhlcvModule],
  providers: [BrokerCronService],
})
export class CronModule {}
