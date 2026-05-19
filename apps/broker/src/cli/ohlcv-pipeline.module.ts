import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '../config/configuration';
import { BrokerDbModule } from '../broker-db/broker-db.module';
import { SwapOhlcvModule } from '../swap-ohlcv/swap-ohlcv.module';

/**
 * Minimal context for the OHLCV wall-clock job (no HTTP, no RabbitMQ).
 * `SwapOhlcvAggregationService.ensureWallClockBuckets` advances **1m** (period `SWAP_BUCKET_FINEST_PERIOD_SEC`), **1h, 1d, 1w, 1mo**
 * for every known pool and token (see `SWAP_BUCKET_RESOLUTIONS`).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    BrokerDbModule,
    SwapOhlcvModule,
  ],
})
export class OhlcvPipelineModule {}
