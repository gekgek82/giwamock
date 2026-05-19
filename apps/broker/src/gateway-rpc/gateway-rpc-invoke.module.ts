import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DynamicSwapFeeModule } from '../dynamic-fee/dynamic-swap-fee.module';
import { SpotCatalogModule } from '../spot-catalog/spot-catalog.module';
import { SwapLiquidityModule } from '../swap-liquidity/swap-liquidity.module';
import { BrokerSwapHopModule } from '../swap-hop/broker-swap-hop.module';
import { VeLockModule } from '../ve-lock/ve-lock.module';
import { VotingModule } from '../voting/voting.module';
import { UdfModule } from '../api/udf/udf.module';
import { AdminLockService } from '../api/admin-lock/admin-lock.service';
import { AdminVoteService } from '../api/admin-vote/admin-vote.service';
import { VeLockPositionEntity } from '../models/ve-lock/ve-lock-position.entity';
import { VeLockEventEntity } from '../models/ve-lock/ve-lock-event.entity';
import { VoterVotePositionEntity } from '../models/voting/voter-vote-position.entity';
import { VoterVoteEventEntity } from '../models/voting/voter-vote-event.entity';
import { SpotPairEntity } from '../models/pair/spot-pair.entity';
import { SpotTokenEntity } from '../models/token/spot-token.entity';
import { LiquidityHistogramBucketEntity } from '../models/tick/liquidity-histogram-bucket.entity';
import { GatewayRpcInvokeService } from './gateway-rpc-invoke.service';

@Module({
  imports: [
    SpotCatalogModule,
    SwapLiquidityModule,
    DynamicSwapFeeModule,
    BrokerSwapHopModule,
    VeLockModule,
    VotingModule,
    UdfModule,
    TypeOrmModule.forFeature([
      VeLockPositionEntity,
      VeLockEventEntity,
      VoterVotePositionEntity,
      VoterVoteEventEntity,
      SpotPairEntity,
      SpotTokenEntity,
      LiquidityHistogramBucketEntity,
    ]),
  ],
  providers: [GatewayRpcInvokeService, AdminLockService, AdminVoteService],
  exports: [GatewayRpcInvokeService],
})
export class GatewayRpcInvokeModule {}
