import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrokerDynamicSwapFeeGlobalEntity } from '../models/dynamic-fee/broker-dynamic-swap-fee-global.entity';
import { BrokerDynamicSwapFeeDiscountEntity } from '../models/dynamic-fee/broker-dynamic-swap-fee-discount.entity';
import { BrokerDynamicSwapFeePoolEntity } from '../models/dynamic-fee/broker-dynamic-swap-fee-pool.entity';
import { DynamicSwapFeeReadModelService } from './dynamic-swap-fee-read-model.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BrokerDynamicSwapFeeGlobalEntity,
      BrokerDynamicSwapFeePoolEntity,
      BrokerDynamicSwapFeeDiscountEntity,
    ]),
  ],
  providers: [DynamicSwapFeeReadModelService],
  exports: [DynamicSwapFeeReadModelService],
})
export class DynamicSwapFeeModule {}
