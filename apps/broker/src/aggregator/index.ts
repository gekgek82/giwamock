import { Logger } from '@nestjs/common';
import type {
  CLGaugeDepositIndexerBrokerPayload,
  CLGaugeWithdrawIndexerBrokerPayload,
  CLPoolCreatedIndexerBrokerPayload,
  CLLiquidityAddedIndexerBrokerPayload,
  DynamicSwapFeeModuleCustomFeeSetIndexerBrokerPayload,
  DynamicSwapFeeModuleDefaultFeeCapSetIndexerBrokerPayload,
  DynamicSwapFeeModuleDefaultScalingFactorSetIndexerBrokerPayload,
  DynamicSwapFeeModuleDiscountedDeregisteredIndexerBrokerPayload,
  DynamicSwapFeeModuleDiscountedRegisteredIndexerBrokerPayload,
  DynamicSwapFeeModuleDynamicFeeResetIndexerBrokerPayload,
  DynamicSwapFeeModuleFeeCapSetIndexerBrokerPayload,
  DynamicSwapFeeModuleScalingFactorSetIndexerBrokerPayload,
  DynamicSwapFeeModuleSecondsAgoSetIndexerBrokerPayload,
  CLFactoryDefaultUnstakedFeeChangedIndexerBrokerPayload,
  CLFactorySwapFeeModuleChangedIndexerBrokerPayload,
  GaugeDepositIndexerBrokerPayload,
  GaugeWithdrawIndexerBrokerPayload,
  LiquidityAddedIndexerBrokerPayload,
  PoolCreatedIndexerBrokerPayload,
  PoolFactorySetCustomFeeIndexerBrokerPayload,
  PoolFactorySetFeeIndexerBrokerPayload,
  PoolFactorySetFeeManagerIndexerBrokerPayload,
  PoolFactorySetPauserIndexerBrokerPayload,
  PoolFactorySetPauseStateIndexerBrokerPayload,
  PoolFactorySetVoterIndexerBrokerPayload,
  PoolRegisteredIndexerBrokerPayload,
  SetupIndexerBrokerPayload,
  SwapIndexerBrokerPayload,
  VoterGaugeCreatedIndexerBrokerPayload,
  VoterWhitelistTokenIndexerBrokerPayload,
  VeDepositIndexerBrokerPayload,
  VeWithdrawIndexerBrokerPayload,
  VeLockPermanentIndexerBrokerPayload,
  VeUnlockPermanentIndexerBrokerPayload,
  VeMergeIndexerBrokerPayload,
  VeSplitIndexerBrokerPayload,
} from '@giwater/shared';
import { aggregateCLLiquidityAdded } from './cl-liquidity-added';
import { aggregateCLPoolCreated } from './cl-pool-created';
import { aggregateLiquidityAdded } from './liquidity-added';
import { aggregatePoolCreated } from './pool-created';
import { aggregateSetup } from './setup';
import { aggregateSwap } from './swap';
import {
  aggregateDynamicSwapFeeModuleCustomFeeSet,
  aggregateDynamicSwapFeeModuleDefaultFeeCapSet,
  aggregateDynamicSwapFeeModuleDefaultScalingFactorSet,
  aggregateDynamicSwapFeeModuleDiscountedDeregistered,
  aggregateDynamicSwapFeeModuleDiscountedRegistered,
  aggregateDynamicSwapFeeModuleDynamicFeeReset,
  aggregateDynamicSwapFeeModuleFeeCapSet,
  aggregateDynamicSwapFeeModuleScalingFactorSet,
  aggregateDynamicSwapFeeModuleSecondsAgoSet,
} from './dynamic-swap-fee-module-events';
import {
  aggregateCLFactoryDefaultUnstakedFeeChanged,
  aggregateCLFactorySwapFeeModuleChanged,
} from './cl-factory-fee-events';
import {
  aggregatePoolFactorySetCustomFee,
  aggregatePoolFactorySetFee,
  aggregatePoolFactorySetFeeManager,
  aggregatePoolFactorySetPauser,
  aggregatePoolFactorySetPauseState,
  aggregatePoolFactorySetVoter,
} from './pool-factory-events';
import { aggregatePoolRegistered } from './pool-registered';
import { aggregateVoterGaugeCreated } from './voter-gauge-created';
import { aggregateVoterWhitelistToken } from './voter-whitelist-token';
import {
  aggregateGaugeDeposit,
  aggregateGaugeWithdraw,
  aggregateCLGaugeDeposit,
  aggregateCLGaugeWithdraw,
} from './gauge-stake-events';
import {
  aggregateVeDeposit,
  aggregateVeWithdraw,
  aggregateVeLockPermanent,
  aggregateVeUnlockPermanent,
  aggregateVeMerge,
  aggregateVeSplit,
} from './ve-lock-events';
import {
  aggregateVoterVoted,
  aggregateVoterAbstained,
  aggregateFeeVotingRewardClaim,
  aggregateBribeVotingRewardClaim,
} from './voting-events';
import type {
  VoterVotedIndexerBrokerPayload,
  VoterAbstainedIndexerBrokerPayload,
  FeeVotingRewardClaimIndexerBrokerPayload,
  BribeVotingRewardClaimIndexerBrokerPayload,
} from '@giwater/shared';
import type { DynamicSwapFeeReadModelService } from '../dynamic-fee/dynamic-swap-fee-read-model.service';
import type { SwapLiquidityGraphService } from '../swap-liquidity/swap-liquidity-graph.service';
import type { SwapOhlcvAggregationService } from '../swap-ohlcv/swap-ohlcv-aggregation.service';
import type { DataSource } from 'typeorm';

const logger = new Logger('BrokerAggregator');

export type AggregatorDeps = {
  swapGraph: SwapLiquidityGraphService;
  swapOhlcv: SwapOhlcvAggregationService;
  dynamicSwapFeeReadModel: DynamicSwapFeeReadModelService;
  dataSource: DataSource;
};

/**
 * Entry point for broker-side value aggregation after raw indexed event persistence.
 *
 * This runs after the event is stored in `indexed_events` so downstream aggregations
 * can always re-read canonical broker-side raw data by `id`.
 */
export async function aggregateIndexedEvent(
  payload: unknown,
  deps: AggregatorDeps,
): Promise<{ swapPool: string | null }> {
  const record =
    typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>)
      : {};
  const id = typeof record.id === 'string' ? record.id : '(no id)';
  const type = typeof record.type === 'string' ? record.type : '(no type)';

  logger.debug(`Aggregator entrypoint invoked for id=${id} type=${type}`);

  switch (type) {
    case 'setup':
      await aggregateSetup(record as unknown as SetupIndexerBrokerPayload);
      return { swapPool: null };
    case 'PoolCreated':
      await aggregatePoolCreated(
        record as unknown as PoolCreatedIndexerBrokerPayload,
        deps.swapGraph,
      );
      return { swapPool: null };
    case 'CLPoolCreated':
      await aggregateCLPoolCreated(
        record as unknown as CLPoolCreatedIndexerBrokerPayload,
        deps.swapGraph,
      );
      return { swapPool: null };
    case 'LiquidityAdded':
      await aggregateLiquidityAdded(
        record as unknown as LiquidityAddedIndexerBrokerPayload,
        deps.swapGraph,
      );
      return { swapPool: null };
    case 'CLLiquidityAdded':
      await aggregateCLLiquidityAdded(
        record as unknown as CLLiquidityAddedIndexerBrokerPayload,
        deps.swapGraph,
      );
      return { swapPool: null };
    case 'Swap': {
      const { pool } = await aggregateSwap(
        record as unknown as SwapIndexerBrokerPayload,
        deps.swapGraph,
        deps.swapOhlcv,
      );
      return { swapPool: pool };
    }
    case 'PoolFactorySetCustomFee':
      await aggregatePoolFactorySetCustomFee(
        record as unknown as PoolFactorySetCustomFeeIndexerBrokerPayload,
        deps.swapGraph,
      );
      return { swapPool: null };
    case 'PoolFactorySetFee':
      await aggregatePoolFactorySetFee(
        record as unknown as PoolFactorySetFeeIndexerBrokerPayload,
        deps.swapGraph,
      );
      return { swapPool: null };
    case 'PoolFactorySetFeeManager':
      await aggregatePoolFactorySetFeeManager(
        record as unknown as PoolFactorySetFeeManagerIndexerBrokerPayload,
      );
      return { swapPool: null };
    case 'PoolFactorySetPauseState':
      await aggregatePoolFactorySetPauseState(
        record as unknown as PoolFactorySetPauseStateIndexerBrokerPayload,
      );
      return { swapPool: null };
    case 'PoolFactorySetPauser':
      await aggregatePoolFactorySetPauser(
        record as unknown as PoolFactorySetPauserIndexerBrokerPayload,
      );
      return { swapPool: null };
    case 'PoolFactorySetVoter':
      await aggregatePoolFactorySetVoter(
        record as unknown as PoolFactorySetVoterIndexerBrokerPayload,
      );
      return { swapPool: null };
    case 'DynamicSwapFeeModuleCustomFeeSet':
      await aggregateDynamicSwapFeeModuleCustomFeeSet(
        record as unknown as DynamicSwapFeeModuleCustomFeeSetIndexerBrokerPayload,
        deps.swapGraph,
        deps.dynamicSwapFeeReadModel,
      );
      return { swapPool: null };
    case 'DynamicSwapFeeModuleDynamicFeeReset':
      await aggregateDynamicSwapFeeModuleDynamicFeeReset(
        record as unknown as DynamicSwapFeeModuleDynamicFeeResetIndexerBrokerPayload,
        deps.swapGraph,
        deps.dynamicSwapFeeReadModel,
      );
      return { swapPool: null };
    case 'DynamicSwapFeeModuleDefaultFeeCapSet':
      await aggregateDynamicSwapFeeModuleDefaultFeeCapSet(
        record as unknown as DynamicSwapFeeModuleDefaultFeeCapSetIndexerBrokerPayload,
        deps.dynamicSwapFeeReadModel,
      );
      return { swapPool: null };
    case 'DynamicSwapFeeModuleDefaultScalingFactorSet':
      await aggregateDynamicSwapFeeModuleDefaultScalingFactorSet(
        record as unknown as DynamicSwapFeeModuleDefaultScalingFactorSetIndexerBrokerPayload,
        deps.dynamicSwapFeeReadModel,
      );
      return { swapPool: null };
    case 'DynamicSwapFeeModuleDiscountedDeregistered':
      await aggregateDynamicSwapFeeModuleDiscountedDeregistered(
        record as unknown as DynamicSwapFeeModuleDiscountedDeregisteredIndexerBrokerPayload,
        deps.dynamicSwapFeeReadModel,
      );
      return { swapPool: null };
    case 'DynamicSwapFeeModuleDiscountedRegistered':
      await aggregateDynamicSwapFeeModuleDiscountedRegistered(
        record as unknown as DynamicSwapFeeModuleDiscountedRegisteredIndexerBrokerPayload,
        deps.dynamicSwapFeeReadModel,
      );
      return { swapPool: null };
    case 'DynamicSwapFeeModuleFeeCapSet':
      await aggregateDynamicSwapFeeModuleFeeCapSet(
        record as unknown as DynamicSwapFeeModuleFeeCapSetIndexerBrokerPayload,
        deps.dynamicSwapFeeReadModel,
      );
      return { swapPool: null };
    case 'DynamicSwapFeeModuleScalingFactorSet':
      await aggregateDynamicSwapFeeModuleScalingFactorSet(
        record as unknown as DynamicSwapFeeModuleScalingFactorSetIndexerBrokerPayload,
        deps.dynamicSwapFeeReadModel,
      );
      return { swapPool: null };
    case 'DynamicSwapFeeModuleSecondsAgoSet':
      await aggregateDynamicSwapFeeModuleSecondsAgoSet(
        record as unknown as DynamicSwapFeeModuleSecondsAgoSetIndexerBrokerPayload,
        deps.dynamicSwapFeeReadModel,
      );
      return { swapPool: null };
    case 'CLFactoryDefaultUnstakedFeeChanged':
      await aggregateCLFactoryDefaultUnstakedFeeChanged(
        record as unknown as CLFactoryDefaultUnstakedFeeChangedIndexerBrokerPayload,
        deps.dynamicSwapFeeReadModel,
      );
      return { swapPool: null };
    case 'CLFactorySwapFeeModuleChanged':
      await aggregateCLFactorySwapFeeModuleChanged(
        record as unknown as CLFactorySwapFeeModuleChangedIndexerBrokerPayload,
        deps.dynamicSwapFeeReadModel,
      );
      return { swapPool: null };
    case 'PoolRegistered':
      await aggregatePoolRegistered(
        record as unknown as PoolRegisteredIndexerBrokerPayload,
      );
      return { swapPool: null };
    case 'VoterGaugeCreated':
      await aggregateVoterGaugeCreated(
        record as unknown as VoterGaugeCreatedIndexerBrokerPayload,
      );
      return { swapPool: null };
    case 'VoterWhitelistToken':
      await aggregateVoterWhitelistToken(
        record as unknown as VoterWhitelistTokenIndexerBrokerPayload,
        deps.dataSource,
      );
      return { swapPool: null };
    case 'GaugeDeposit':
      await aggregateGaugeDeposit(
        record as unknown as GaugeDepositIndexerBrokerPayload,
        deps.dataSource,
      );
      return { swapPool: null };
    case 'GaugeWithdraw':
      await aggregateGaugeWithdraw(
        record as unknown as GaugeWithdrawIndexerBrokerPayload,
        deps.dataSource,
      );
      return { swapPool: null };
    case 'CLGaugeDeposit':
      await aggregateCLGaugeDeposit(
        record as unknown as CLGaugeDepositIndexerBrokerPayload,
        deps.dataSource,
      );
      return { swapPool: null };
    case 'CLGaugeWithdraw':
      await aggregateCLGaugeWithdraw(
        record as unknown as CLGaugeWithdrawIndexerBrokerPayload,
        deps.dataSource,
      );
      return { swapPool: null };
    case 'VeDeposit':
      await aggregateVeDeposit(
        record as unknown as VeDepositIndexerBrokerPayload,
        deps.dataSource,
      );
      return { swapPool: null };
    case 'VeWithdraw':
      await aggregateVeWithdraw(
        record as unknown as VeWithdrawIndexerBrokerPayload,
        deps.dataSource,
      );
      return { swapPool: null };
    case 'VeLockPermanent':
      await aggregateVeLockPermanent(
        record as unknown as VeLockPermanentIndexerBrokerPayload,
        deps.dataSource,
      );
      return { swapPool: null };
    case 'VeUnlockPermanent':
      await aggregateVeUnlockPermanent(
        record as unknown as VeUnlockPermanentIndexerBrokerPayload,
        deps.dataSource,
      );
      return { swapPool: null };
    case 'VeMerge':
      await aggregateVeMerge(
        record as unknown as VeMergeIndexerBrokerPayload,
        deps.dataSource,
      );
      return { swapPool: null };
    case 'VeSplit':
      await aggregateVeSplit(
        record as unknown as VeSplitIndexerBrokerPayload,
        deps.dataSource,
      );
      return { swapPool: null };
    case 'VoterVoted':
      await aggregateVoterVoted(
        record as unknown as VoterVotedIndexerBrokerPayload,
        deps.dataSource,
      );
      return { swapPool: null };
    case 'VoterAbstained':
      await aggregateVoterAbstained(
        record as unknown as VoterAbstainedIndexerBrokerPayload,
        deps.dataSource,
      );
      return { swapPool: null };
    case 'FeeVotingRewardClaim':
      await aggregateFeeVotingRewardClaim(
        record as unknown as FeeVotingRewardClaimIndexerBrokerPayload,
        deps.dataSource,
      );
      return { swapPool: null };
    case 'BribeVotingRewardClaim':
      await aggregateBribeVotingRewardClaim(
        record as unknown as BribeVotingRewardClaimIndexerBrokerPayload,
        deps.dataSource,
      );
      return { swapPool: null };
    default:
      logger.warn(`No aggregator module mapped for event type=${type}`);
      return { swapPool: null };
  }
  return { swapPool: null };
}
