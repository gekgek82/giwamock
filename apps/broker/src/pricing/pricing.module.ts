import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpotPairEntity } from '../models/pair/spot-pair.entity';
import { DexUsdQuoteService } from './dex-usd-quote.service';

@Module({
  imports: [TypeOrmModule.forFeature([SpotPairEntity])],
  providers: [DexUsdQuoteService],
  exports: [DexUsdQuoteService],
})
export class PricingModule {}
