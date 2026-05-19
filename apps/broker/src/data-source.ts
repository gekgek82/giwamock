import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AccountBalanceTimeBucketsEntity } from './models/account/account-balance-time-buckets.entity';
import { FollowsEntity } from './models/account/follows.entity';
import { SpotAccountEntity } from './models/account/spot-account.entity';
import { SpotAccountLiquidityProvisionEntity } from './models/account/spot-account-liquidity-provision.entity';
import { SpotAccountNotificationEntity } from './models/account/spot-account-notification.entity';
import { SpotAccountStakeEventEntity } from './models/account/spot-account-stake-event.entity';
import { BrokerPoolFactoryFeeDefaultsEntity } from './models/config/broker-pool-factory-fee-defaults.entity';
import { BrokerDynamicSwapFeeDiscountEntity } from './models/dynamic-fee/broker-dynamic-swap-fee-discount.entity';
import { BrokerDynamicSwapFeeGlobalEntity } from './models/dynamic-fee/broker-dynamic-swap-fee-global.entity';
import { BrokerDynamicSwapFeePoolEntity } from './models/dynamic-fee/broker-dynamic-swap-fee-pool.entity';
import { SpotExchangeTimeBucketEntity } from './models/exchange/spot-exchange-time-bucket.entity';
import { SpotExchangeEntity } from './models/exchange/spot-exchange.entity';
import { SpotGroupEntity } from './models/group/spot-group.entity';
import { IndexerIngestedEventEntity } from './models/indexer-ingested-event.entity';
import { SpotGroupPairEntity } from './models/pair/spot-group-pair.entity';
import { SpotPairAdminMetaEntity } from './models/pair/spot-pair-admin-meta.entity';
import { SpotPairTimeBucketEntity } from './models/pair/spot-pair-time-bucket.entity';
import { SpotPairEntity } from './models/pair/spot-pair.entity';
import { BrokerSwapHopEntity } from './models/swap/broker-swap-hop.entity';
import { SpotSwapEntity } from './models/swap/spot-swap.entity';
import { SwapBucketStateEntity } from './models/swap/swap-bucket-state.entity';
import { SwapLiquidityEdgeEntity } from './models/swap/swap-liquidity-edge.entity';
import { LiquidityHistogramBucketEntity } from './models/tick/liquidity-histogram-bucket.entity';
import { TickEntity } from './models/tick/tick.entity';
import { SpotGroupTokenEntity } from './models/token/spot-group-token.entity';
import { SpotTokenTimeBucketEntity } from './models/token/spot-token-time-bucket.entity';
import { SpotTokenEntity } from './models/token/spot-token.entity';
import { VeLockEventEntity } from './models/ve-lock/ve-lock-event.entity';
import { VeLockPositionEntity } from './models/ve-lock/ve-lock-position.entity';
import { VoterRewardClaimEntity } from './models/voting/voter-reward-claim.entity';
import { VoterVoteEventEntity } from './models/voting/voter-vote-event.entity';
import { VoterVotePositionEntity } from './models/voting/voter-vote-position.entity';
import { InitialSchema1700000000000 } from './migrations/1700000000000-InitialSchema';
import { SpotPairsMissingColumns1747182000000 } from './migrations/1747182000000-SpotPairsMissingColumns';
import { EnsureSpotPairsColumns1747600000000 } from './migrations/1747600000000-EnsureSpotPairsColumns';
import { AddClTickSpacingToSpotPairs1748100000000 } from './migrations/1748100000000-AddClTickSpacingToSpotPairs';
import { AddCLFactoryFeeFieldsToGlobal1748200000000 } from './migrations/1748200000000-AddCLFactoryFeeFieldsToGlobal';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.BROKER_DATABASE_URL ?? process.env.DATABASE_URL,
  entities: [
    AccountBalanceTimeBucketsEntity,
    FollowsEntity,
    SpotAccountEntity,
    SpotAccountLiquidityProvisionEntity,
    SpotAccountNotificationEntity,
    SpotAccountStakeEventEntity,
    BrokerPoolFactoryFeeDefaultsEntity,
    BrokerDynamicSwapFeeDiscountEntity,
    BrokerDynamicSwapFeeGlobalEntity,
    BrokerDynamicSwapFeePoolEntity,
    SpotExchangeTimeBucketEntity,
    SpotExchangeEntity,
    SpotGroupEntity,
    IndexerIngestedEventEntity,
    SpotGroupPairEntity,
    SpotPairAdminMetaEntity,
    SpotPairTimeBucketEntity,
    SpotPairEntity,
    BrokerSwapHopEntity,
    SpotSwapEntity,
    SwapBucketStateEntity,
    SwapLiquidityEdgeEntity,
    LiquidityHistogramBucketEntity,
    TickEntity,
    SpotGroupTokenEntity,
    SpotTokenTimeBucketEntity,
    SpotTokenEntity,
    VeLockEventEntity,
    VeLockPositionEntity,
    VoterRewardClaimEntity,
    VoterVoteEventEntity,
    VoterVotePositionEntity,
  ],
  migrations: [InitialSchema1700000000000, SpotPairsMissingColumns1747182000000, EnsureSpotPairsColumns1747600000000, AddClTickSpacingToSpotPairs1748100000000, AddCLFactoryFeeFieldsToGlobal1748200000000],
  synchronize: false,
  logging: false,
});
