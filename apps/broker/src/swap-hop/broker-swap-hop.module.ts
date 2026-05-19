import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrokerSwapHopEntity } from '../models/swap/broker-swap-hop.entity';
import { BrokerSwapHopMaterializationService } from './broker-swap-hop-materialization.service';
import { BrokerSwapHopQueryService } from './broker-swap-hop-query.service';

@Module({
  imports: [TypeOrmModule.forFeature([BrokerSwapHopEntity])],
  providers: [BrokerSwapHopMaterializationService, BrokerSwapHopQueryService],
  exports: [BrokerSwapHopMaterializationService, BrokerSwapHopQueryService],
})
export class BrokerSwapHopModule {}
