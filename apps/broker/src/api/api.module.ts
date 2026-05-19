import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm/dist/typeorm.module';
import { HealthController } from './health.controller';
import { IndexedEventsController } from './indexed-events.controller';
import { SpotPairGroupsController } from './pair/spot-pair-groups.controller';
import { SpotPairsController } from './pair/spot-pairs.controller';
import { AdminPoolsController } from './pair/admin-pools.controller';
import { SpotTokenGroupsController } from './token/spot-token-groups.controller';
import { SpotTokensController } from './token/spot-tokens.controller';
import { ContractsController } from './contracts.controller';
import { SwapRoutesController } from './swap-routes.controller';
import { SwapsController } from './swaps.controller';
import { AdminExchangeController } from './exchange/admin-exchange.controller';
import { SpotAccountController } from './account/spot-account.controller';
import { SpotAccountLpService } from './account/spot-account-lp.service';
import { SpotAccountStakeService } from './account/spot-account-stake.service';
import { IndexerEventsModule } from '../indexer-events/indexer-events.module';
import { BrokerSwapHopModule } from '../swap-hop/broker-swap-hop.module';
import { SpotCatalogModule } from '../spot-catalog/spot-catalog.module';
import { DynamicSwapFeeModule } from '../dynamic-fee/dynamic-swap-fee.module';
import { SwapLiquidityModule } from '../swap-liquidity/swap-liquidity.module';
import { ExchangeModule } from '../exchange/exchange.module';
import { SpotTokenEntity } from '../models/token/spot-token.entity';
import { SpotAccountLiquidityProvisionEntity } from '../models/account/spot-account-liquidity-provision.entity';
import { SpotAccountStakeEventEntity } from '../models/account/spot-account-stake-event.entity';
import { SpotPairEntity } from '../models/pair/spot-pair.entity';
import { StakingViewModule } from '../staking-view/staking-view.module';
import { UdfModule } from './udf/udf.module';
import { AdminLockController } from './admin-lock/admin-lock.controller';
import { AdminLockService } from './admin-lock/admin-lock.service';
import { AdminVoteController } from './admin-vote/admin-vote.controller';
import { AdminVoteService } from './admin-vote/admin-vote.service';
import { AdminEventsController } from './admin-events/admin-events.controller';
import { StatsController } from './stats/stats.controller';
import { PoolsController } from './pools/pools.controller';
import { PublicTokensController } from './token/public-tokens.controller';
import { VotePublicController } from './vote/vote-public.controller';
import { VeLockPositionEntity } from '../models/ve-lock/ve-lock-position.entity';
import { VeLockEventEntity } from '../models/ve-lock/ve-lock-event.entity';
import { VoterVotePositionEntity } from '../models/voting/voter-vote-position.entity';
import { VoterVoteEventEntity } from '../models/voting/voter-vote-event.entity';
import { LiquidityHistogramBucketEntity } from '../models/tick/liquidity-histogram-bucket.entity';

@Module({
  imports: [
    IndexerEventsModule,
    BrokerSwapHopModule,
    SwapLiquidityModule,
    SpotCatalogModule,
    DynamicSwapFeeModule,
    ExchangeModule,
    StakingViewModule,
    UdfModule,
    // Needed for SwapRoutesController's InjectRepository(SpotTokenEntity)
    // and SpotAccountLpService's InjectRepository(SpotAccountLiquidityProvisionEntity, SpotPairEntity)
    TypeOrmModule.forFeature([
      SpotTokenEntity,
      SpotAccountLiquidityProvisionEntity,
      SpotAccountStakeEventEntity,
      SpotPairEntity,
      VeLockPositionEntity,
      VeLockEventEntity,
      VoterVotePositionEntity,
      VoterVoteEventEntity,
      LiquidityHistogramBucketEntity,
    ]),
  ],
  controllers: [
    HealthController,
    IndexedEventsController,
    AdminPoolsController,
    AdminExchangeController,
    SpotPairGroupsController,
    SpotPairsController,
    SpotTokenGroupsController,
    SpotTokensController,
    SwapRoutesController,
    SwapsController,
    ContractsController,
    SpotAccountController,
    AdminLockController,
    AdminVoteController,
    AdminEventsController,
    StatsController,
    PoolsController,
    PublicTokensController,
    VotePublicController,
  ],
  providers: [SpotAccountLpService, SpotAccountStakeService, AdminLockService, AdminVoteService],
})
export class ApiModule {}
