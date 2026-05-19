/**
 * Shapes for AMM indexer → broker RabbitMQ JSON.
 *
 * `amm-indexer` serializes `bigint` fields to decimal strings before publish.
 * On-chain payloads include `ts` (ISO) added when the message is sent.
 */

import type { IndexerPairPriceAxis } from '../utils/pair-indexer-price-orientation';

/** Decimal string after JSON serialization of chain `bigint` values. */
export type BrokerJsonBigInt = string;

export type HexAddress = `0x${string}`;

/** JSON-safe `TokenInfo` projection for broker queue payloads. */
export interface IndexerTokenInfoWire {
  token: HexAddress;
  totalSupply: BrokerJsonBigInt;
  decimals: number;
  name: string;
  symbol: string;
}

/** Native `TokenInfo` shape before JSON stringify in `notifyBroker`. */
export interface IndexerTokenInfoNotify {
  token: HexAddress;
  totalSupply: bigint;
  decimals: number;
  name: string;
  symbol: string;
}

/** `publishIndexerEvent` only (indexer setup hook; no `id`). */
export interface SetupIndexerBrokerPayload {
  type: 'setup';
  ts: string;
}

/** Common header for UniversalRouter logs sent via `notifyBroker`. */
export interface IndexerBrokerOnchainWireBase {
  id: string;
  blockNumber: BrokerJsonBigInt;
  blockTimestamp: BrokerJsonBigInt;
  transactionHash: HexAddress;
  logIndex: BrokerJsonBigInt;
  ts: string;
}

export interface PoolCreatedIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'PoolCreated';
  token0: HexAddress;
  token1: HexAddress;
  stable: boolean;
  pool: HexAddress;
  /** Base / quote addresses (see `inferIndexerPairPriceOrientation`). */
  base: HexAddress;
  quote: HexAddress;
  pairPriceAxis: IndexerPairPriceAxis;
  token0Info?: IndexerTokenInfoWire;
  token1Info?: IndexerTokenInfoWire;
}

export interface CLPoolCreatedIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'CLPoolCreated';
  token0: HexAddress;
  token1: HexAddress;
  tickSpacing: BrokerJsonBigInt;
  pool: HexAddress;
  base: HexAddress;
  quote: HexAddress;
  pairPriceAxis: IndexerPairPriceAxis;
  token0Info?: IndexerTokenInfoWire;
  token1Info?: IndexerTokenInfoWire;
}

export interface LiquidityAddedIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'LiquidityAdded';
  sender: HexAddress;
  token0: HexAddress;
  token1: HexAddress;
  stable: boolean;
  amount0: BrokerJsonBigInt;
  amount1: BrokerJsonBigInt;
  liquidity: BrokerJsonBigInt;
  to: HexAddress;
}

export interface CLLiquidityAddedIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'CLLiquidityAdded';
  sender: HexAddress;
  token0: HexAddress;
  token1: HexAddress;
  tickSpacing: BrokerJsonBigInt;
  tickLower: BrokerJsonBigInt;
  tickUpper: BrokerJsonBigInt;
  liquidity: BrokerJsonBigInt;
  amount0: BrokerJsonBigInt;
  amount1: BrokerJsonBigInt;
  to: HexAddress;
}

export interface SwapIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'Swap';
  sender: HexAddress;
  tokenIn: HexAddress;
  tokenOut: HexAddress;
  isCL: boolean;
  stable: boolean;
  hopIndex: BrokerJsonBigInt;
  amountIn: BrokerJsonBigInt;
  amountOut: BrokerJsonBigInt;
  feeAmount: BrokerJsonBigInt;
  feeToken: HexAddress;
  to: HexAddress;
}

export interface PoolFactorySetCustomFeeIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'PoolFactorySetCustomFee';
  pool: HexAddress;
  fee: BrokerJsonBigInt;
}

export interface PoolFactorySetFeeIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'PoolFactorySetFee';
  stable: boolean;
  fee: BrokerJsonBigInt;
}

export interface PoolFactorySetFeeManagerIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'PoolFactorySetFeeManager';
  feeManager: HexAddress;
}

export interface PoolFactorySetPauseStateIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'PoolFactorySetPauseState';
  state: boolean;
}

export interface PoolFactorySetPauserIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'PoolFactorySetPauser';
  pauser: HexAddress;
}

export interface PoolFactorySetVoterIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'PoolFactorySetVoter';
  voter: HexAddress;
}

export interface DynamicSwapFeeModuleDefaultFeeCapSetIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'DynamicSwapFeeModuleDefaultFeeCapSet';
  defaultFeeCap: BrokerJsonBigInt;
}

export interface DynamicSwapFeeModuleCustomFeeSetIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'DynamicSwapFeeModuleCustomFeeSet';
  pool: HexAddress;
  fee: BrokerJsonBigInt;
}

export interface DynamicSwapFeeModuleDynamicFeeResetIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'DynamicSwapFeeModuleDynamicFeeReset';
  pool: HexAddress;
}

export interface DynamicSwapFeeModuleDefaultScalingFactorSetIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'DynamicSwapFeeModuleDefaultScalingFactorSet';
  defaultScalingFactor: BrokerJsonBigInt;
}

export interface DynamicSwapFeeModuleDiscountedDeregisteredIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'DynamicSwapFeeModuleDiscountedDeregistered';
  discountOver: HexAddress;
}

export interface DynamicSwapFeeModuleDiscountedRegisteredIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'DynamicSwapFeeModuleDiscountedRegistered';
  discountReceiver: HexAddress;
  discount: BrokerJsonBigInt;
}

export interface DynamicSwapFeeModuleFeeCapSetIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'DynamicSwapFeeModuleFeeCapSet';
  pool: HexAddress;
  feeCap: BrokerJsonBigInt;
}

export interface DynamicSwapFeeModuleScalingFactorSetIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'DynamicSwapFeeModuleScalingFactorSet';
  pool: HexAddress;
  scalingFactor: BrokerJsonBigInt;
}

export interface DynamicSwapFeeModuleSecondsAgoSetIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'DynamicSwapFeeModuleSecondsAgoSet';
  secondsAgo: BrokerJsonBigInt;
}

export interface CLFactoryDefaultUnstakedFeeChangedIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'CLFactoryDefaultUnstakedFeeChanged';
  oldUnstakedFee: BrokerJsonBigInt;
  newUnstakedFee: BrokerJsonBigInt;
}

export interface CLFactorySwapFeeModuleChangedIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'CLFactorySwapFeeModuleChanged';
  oldFeeModule: HexAddress;
  newFeeModule: HexAddress;
}

/** `PoolRewardRegistry.PoolRegistered` — canonical AMM pool discovery (v2 + CL). */
export interface PoolRegisteredIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'PoolRegistered';
  registry: HexAddress;
  index: BrokerJsonBigInt;
  pool: HexAddress;
  poolFactory: HexAddress;
  kind: number;
  token0: HexAddress;
  token1: HexAddress;
  /** ABI-encoded factory metadata (e.g. tick spacing), hex string. */
  metadata: string;
}

/** `Voter.GaugeCreated` — post-TGE gauge + voting reward wiring per pool. */
export interface VoterGaugeCreatedIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'VoterGaugeCreated';
  poolFactory: HexAddress;
  votingRewardsFactory: HexAddress;
  gaugeFactory: HexAddress;
  pool: HexAddress;
  bribeVotingReward: HexAddress;
  feeVotingReward: HexAddress;
  gauge: HexAddress;
  creator: HexAddress;
}

/** `Voter.WhitelistToken` — token-level whitelist; `gaugeWhitelisted` on a pair becomes true when both tokens are whitelisted. */
export interface VoterWhitelistTokenIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'VoterWhitelistToken';
  whitelister: HexAddress;
  token: HexAddress;
  whitelisted: boolean;
}

/** `Gauge.Deposit` — basic AMM gauge stake deposit. */
export interface GaugeDepositIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'GaugeDeposit';
  gauge: HexAddress;
  pool: HexAddress;
  from: HexAddress;
  to: HexAddress;
  amount: BrokerJsonBigInt;
}

/** `Gauge.Withdraw` — basic AMM gauge stake withdrawal. */
export interface GaugeWithdrawIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'GaugeWithdraw';
  gauge: HexAddress;
  pool: HexAddress;
  from: HexAddress;
  amount: BrokerJsonBigInt;
}

/** `CLGauge.Deposit` — concentrated-liquidity gauge stake deposit. */
export interface CLGaugeDepositIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'CLGaugeDeposit';
  gauge: HexAddress;
  pool: HexAddress;
  user: HexAddress;
  tokenId: BrokerJsonBigInt;
  liquidityToStake: BrokerJsonBigInt;
}

/** `CLGauge.Withdraw` — concentrated-liquidity gauge stake withdrawal. */
export interface CLGaugeWithdrawIndexerBrokerPayload
  extends IndexerBrokerOnchainWireBase {
  type: 'CLGaugeWithdraw';
  gauge: HexAddress;
  pool: HexAddress;
  user: HexAddress;
  tokenId: BrokerJsonBigInt;
  liquidityToStake: BrokerJsonBigInt;
}

/** `VotingEscrow.Deposit` — lock creation or modification. depositType: '0'=DEPOSIT_FOR_TYPE '1'=CREATE_LOCK_TYPE '2'=INCREASE_LOCK_AMOUNT '3'=INCREASE_UNLOCK_TIME */
export interface VeDepositIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'VeDeposit';
  provider: HexAddress;
  tokenId: BrokerJsonBigInt;
  depositType: string;
  value: BrokerJsonBigInt;
  locktime: BrokerJsonBigInt;
}

/** `VotingEscrow.Withdraw` — unlock and burn veNFT. */
export interface VeWithdrawIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'VeWithdraw';
  provider: HexAddress;
  tokenId: BrokerJsonBigInt;
  value: BrokerJsonBigInt;
}

/** `VotingEscrow.LockPermanent` — convert time-based lock to permanent. */
export interface VeLockPermanentIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'VeLockPermanent';
  owner: HexAddress;
  tokenId: BrokerJsonBigInt;
  amount: BrokerJsonBigInt;
}

/** `VotingEscrow.UnlockPermanent` — convert permanent lock back to time-based. */
export interface VeUnlockPermanentIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'VeUnlockPermanent';
  owner: HexAddress;
  tokenId: BrokerJsonBigInt;
  amount: BrokerJsonBigInt;
}

/** `VotingEscrow.Merge` — burn `from` into `to`. */
export interface VeMergeIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'VeMerge';
  sender: HexAddress;
  from: BrokerJsonBigInt;
  to: BrokerJsonBigInt;
  amountFrom: BrokerJsonBigInt;
  amountTo: BrokerJsonBigInt;
  amountFinal: BrokerJsonBigInt;
  locktime: BrokerJsonBigInt;
}

/** `VotingEscrow.Split` — burn `from`, mint `tokenId1` and `tokenId2`. */
export interface VeSplitIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'VeSplit';
  from: BrokerJsonBigInt;
  tokenId1: BrokerJsonBigInt;
  tokenId2: BrokerJsonBigInt;
  sender: HexAddress;
  splitAmount1: BrokerJsonBigInt;
  splitAmount2: BrokerJsonBigInt;
  locktime: BrokerJsonBigInt;
}

/** `Voter.Voted` — veNFT casts votes on a pool for the current epoch. */
export interface VoterVotedIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'VoterVoted';
  voter: HexAddress;
  pool: HexAddress;
  tokenId: BrokerJsonBigInt;
  weight: BrokerJsonBigInt;
  totalWeight: BrokerJsonBigInt;
  epochTimestamp: BrokerJsonBigInt;
}

/** `Voter.Abstained` — veNFT resets votes on a pool (weight returns to 0). */
export interface VoterAbstainedIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'VoterAbstained';
  voter: HexAddress;
  pool: HexAddress;
  tokenId: BrokerJsonBigInt;
  weight: BrokerJsonBigInt;
  totalWeight: BrokerJsonBigInt;
  epochTimestamp: BrokerJsonBigInt;
}

/** `FeesVotingReward.ClaimRewards` — voter claims swap-fee rewards for a pool. */
export interface FeeVotingRewardClaimIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'FeeVotingRewardClaim';
  from: HexAddress;
  reward: HexAddress;
  amount: BrokerJsonBigInt;
  rewardContract: HexAddress;
}

/** `BribeVotingReward.ClaimRewards` — voter claims external-bribe rewards for a pool. */
export interface BribeVotingRewardClaimIndexerBrokerPayload extends IndexerBrokerOnchainWireBase {
  type: 'BribeVotingRewardClaim';
  from: HexAddress;
  reward: HexAddress;
  amount: BrokerJsonBigInt;
  rewardContract: HexAddress;
}

/** On-chain UniversalRouter events on the broker queue (includes `ts`). */
export type IndexerBrokerOnchainQueuePayload =
  | PoolCreatedIndexerBrokerPayload
  | CLPoolCreatedIndexerBrokerPayload
  | LiquidityAddedIndexerBrokerPayload
  | CLLiquidityAddedIndexerBrokerPayload
  | SwapIndexerBrokerPayload
  | PoolFactorySetCustomFeeIndexerBrokerPayload
  | PoolFactorySetFeeIndexerBrokerPayload
  | PoolFactorySetFeeManagerIndexerBrokerPayload
  | PoolFactorySetPauseStateIndexerBrokerPayload
  | PoolFactorySetPauserIndexerBrokerPayload
  | PoolFactorySetVoterIndexerBrokerPayload
  | DynamicSwapFeeModuleDefaultFeeCapSetIndexerBrokerPayload
  | DynamicSwapFeeModuleCustomFeeSetIndexerBrokerPayload
  | DynamicSwapFeeModuleDynamicFeeResetIndexerBrokerPayload
  | DynamicSwapFeeModuleDefaultScalingFactorSetIndexerBrokerPayload
  | DynamicSwapFeeModuleDiscountedDeregisteredIndexerBrokerPayload
  | DynamicSwapFeeModuleDiscountedRegisteredIndexerBrokerPayload
  | DynamicSwapFeeModuleFeeCapSetIndexerBrokerPayload
  | DynamicSwapFeeModuleScalingFactorSetIndexerBrokerPayload
  | DynamicSwapFeeModuleSecondsAgoSetIndexerBrokerPayload
  | CLFactoryDefaultUnstakedFeeChangedIndexerBrokerPayload
  | CLFactorySwapFeeModuleChangedIndexerBrokerPayload
  | PoolRegisteredIndexerBrokerPayload
  | VoterGaugeCreatedIndexerBrokerPayload
  | VoterWhitelistTokenIndexerBrokerPayload
  | GaugeDepositIndexerBrokerPayload
  | GaugeWithdrawIndexerBrokerPayload
  | CLGaugeDepositIndexerBrokerPayload
  | CLGaugeWithdrawIndexerBrokerPayload
  | VeDepositIndexerBrokerPayload
  | VeWithdrawIndexerBrokerPayload
  | VeLockPermanentIndexerBrokerPayload
  | VeUnlockPermanentIndexerBrokerPayload
  | VeMergeIndexerBrokerPayload
  | VeSplitIndexerBrokerPayload
  | VoterVotedIndexerBrokerPayload
  | VoterAbstainedIndexerBrokerPayload
  | FeeVotingRewardClaimIndexerBrokerPayload
  | BribeVotingRewardClaimIndexerBrokerPayload;

/** Full JSON body the broker may receive (including setup pings). */
export type IndexerBrokerQueuePayload =
  | SetupIndexerBrokerPayload
  | IndexerBrokerOnchainQueuePayload;

/** On-chain event body after bigint JSON stringify, before `ts` is merged in `notifyBroker`. */
export type IndexerBrokerOnchainWirePayloadWithoutTs = Omit<
  | PoolCreatedIndexerBrokerPayload
  | CLPoolCreatedIndexerBrokerPayload
  | LiquidityAddedIndexerBrokerPayload
  | CLLiquidityAddedIndexerBrokerPayload
  | SwapIndexerBrokerPayload
  | PoolFactorySetCustomFeeIndexerBrokerPayload
  | PoolFactorySetFeeIndexerBrokerPayload
  | PoolFactorySetFeeManagerIndexerBrokerPayload
  | PoolFactorySetPauseStateIndexerBrokerPayload
  | PoolFactorySetPauserIndexerBrokerPayload
  | PoolFactorySetVoterIndexerBrokerPayload
  | DynamicSwapFeeModuleDefaultFeeCapSetIndexerBrokerPayload
  | DynamicSwapFeeModuleCustomFeeSetIndexerBrokerPayload
  | DynamicSwapFeeModuleDynamicFeeResetIndexerBrokerPayload
  | DynamicSwapFeeModuleDefaultScalingFactorSetIndexerBrokerPayload
  | DynamicSwapFeeModuleDiscountedDeregisteredIndexerBrokerPayload
  | DynamicSwapFeeModuleDiscountedRegisteredIndexerBrokerPayload
  | DynamicSwapFeeModuleFeeCapSetIndexerBrokerPayload
  | DynamicSwapFeeModuleScalingFactorSetIndexerBrokerPayload
  | DynamicSwapFeeModuleSecondsAgoSetIndexerBrokerPayload
  | CLFactoryDefaultUnstakedFeeChangedIndexerBrokerPayload
  | CLFactorySwapFeeModuleChangedIndexerBrokerPayload
  | PoolRegisteredIndexerBrokerPayload
  | VoterGaugeCreatedIndexerBrokerPayload
  | VoterWhitelistTokenIndexerBrokerPayload
  | GaugeDepositIndexerBrokerPayload
  | GaugeWithdrawIndexerBrokerPayload
  | CLGaugeDepositIndexerBrokerPayload
  | CLGaugeWithdrawIndexerBrokerPayload
  | VeDepositIndexerBrokerPayload
  | VeWithdrawIndexerBrokerPayload
  | VeLockPermanentIndexerBrokerPayload
  | VeUnlockPermanentIndexerBrokerPayload
  | VeMergeIndexerBrokerPayload
  | VeSplitIndexerBrokerPayload
  | VoterVotedIndexerBrokerPayload
  | VoterAbstainedIndexerBrokerPayload
  | FeeVotingRewardClaimIndexerBrokerPayload
  | BribeVotingRewardClaimIndexerBrokerPayload,
  'ts'
>;

// --- Notify input (native `bigint` before JSON; `ts` is appended in `notifyBroker`) ---

export interface IndexerBrokerOnchainNotifyBase {
  id: string;
  blockNumber: bigint;
  blockTimestamp: bigint;
  transactionHash: HexAddress;
  logIndex: bigint;
}

export interface PoolCreatedIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'PoolCreated';
  token0: HexAddress;
  token1: HexAddress;
  stable: boolean;
  pool: HexAddress;
  base: HexAddress;
  quote: HexAddress;
  pairPriceAxis: IndexerPairPriceAxis;
  token0Info?: IndexerTokenInfoNotify;
  token1Info?: IndexerTokenInfoNotify;
}

export interface CLPoolCreatedIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'CLPoolCreated';
  token0: HexAddress;
  token1: HexAddress;
  tickSpacing: bigint;
  pool: HexAddress;
  base: HexAddress;
  quote: HexAddress;
  pairPriceAxis: IndexerPairPriceAxis;
  token0Info?: IndexerTokenInfoNotify;
  token1Info?: IndexerTokenInfoNotify;
}

export interface LiquidityAddedIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'LiquidityAdded';
  sender: HexAddress;
  token0: HexAddress;
  token1: HexAddress;
  stable: boolean;
  amount0: bigint;
  amount1: bigint;
  liquidity: bigint;
  to: HexAddress;
}

export interface CLLiquidityAddedIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'CLLiquidityAdded';
  sender: HexAddress;
  token0: HexAddress;
  token1: HexAddress;
  tickSpacing: bigint;
  tickLower: bigint;
  tickUpper: bigint;
  liquidity: bigint;
  amount0: bigint;
  amount1: bigint;
  to: HexAddress;
}

export interface SwapIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'Swap';
  sender: HexAddress;
  tokenIn: HexAddress;
  tokenOut: HexAddress;
  isCL: boolean;
  stable: boolean;
  hopIndex: bigint;
  amountIn: bigint;
  amountOut: bigint;
  feeAmount: bigint;
  feeToken: HexAddress;
  to: HexAddress;
}

export interface PoolFactorySetCustomFeeIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'PoolFactorySetCustomFee';
  pool: HexAddress;
  fee: bigint;
}

export interface PoolFactorySetFeeIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'PoolFactorySetFee';
  stable: boolean;
  fee: bigint;
}

export interface PoolFactorySetFeeManagerIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'PoolFactorySetFeeManager';
  feeManager: HexAddress;
}

export interface PoolFactorySetPauseStateIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'PoolFactorySetPauseState';
  state: boolean;
}

export interface PoolFactorySetPauserIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'PoolFactorySetPauser';
  pauser: HexAddress;
}

export interface PoolFactorySetVoterIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'PoolFactorySetVoter';
  voter: HexAddress;
}

export interface DynamicSwapFeeModuleDefaultFeeCapSetIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'DynamicSwapFeeModuleDefaultFeeCapSet';
  defaultFeeCap: bigint;
}

export interface DynamicSwapFeeModuleCustomFeeSetIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'DynamicSwapFeeModuleCustomFeeSet';
  pool: HexAddress;
  fee: bigint;
}

export interface DynamicSwapFeeModuleDynamicFeeResetIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'DynamicSwapFeeModuleDynamicFeeReset';
  pool: HexAddress;
}

export interface DynamicSwapFeeModuleDefaultScalingFactorSetIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'DynamicSwapFeeModuleDefaultScalingFactorSet';
  defaultScalingFactor: bigint;
}

export interface DynamicSwapFeeModuleDiscountedDeregisteredIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'DynamicSwapFeeModuleDiscountedDeregistered';
  discountOver: HexAddress;
}

export interface DynamicSwapFeeModuleDiscountedRegisteredIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'DynamicSwapFeeModuleDiscountedRegistered';
  discountReceiver: HexAddress;
  discount: bigint;
}

export interface DynamicSwapFeeModuleFeeCapSetIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'DynamicSwapFeeModuleFeeCapSet';
  pool: HexAddress;
  feeCap: bigint;
}

export interface DynamicSwapFeeModuleScalingFactorSetIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'DynamicSwapFeeModuleScalingFactorSet';
  pool: HexAddress;
  scalingFactor: bigint;
}

export interface DynamicSwapFeeModuleSecondsAgoSetIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'DynamicSwapFeeModuleSecondsAgoSet';
  secondsAgo: bigint;
}

export interface CLFactoryDefaultUnstakedFeeChangedIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'CLFactoryDefaultUnstakedFeeChanged';
  oldUnstakedFee: bigint;
  newUnstakedFee: bigint;
}

export interface CLFactorySwapFeeModuleChangedIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'CLFactorySwapFeeModuleChanged';
  oldFeeModule: HexAddress;
  newFeeModule: HexAddress;
}

export interface PoolRegisteredIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'PoolRegistered';
  registry: HexAddress;
  index: bigint;
  pool: HexAddress;
  poolFactory: HexAddress;
  kind: number;
  token0: HexAddress;
  token1: HexAddress;
  metadata: string;
}

export interface VoterGaugeCreatedIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'VoterGaugeCreated';
  poolFactory: HexAddress;
  votingRewardsFactory: HexAddress;
  gaugeFactory: HexAddress;
  pool: HexAddress;
  bribeVotingReward: HexAddress;
  feeVotingReward: HexAddress;
  gauge: HexAddress;
  creator: HexAddress;
}

export interface VoterWhitelistTokenIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'VoterWhitelistToken';
  whitelister: HexAddress;
  token: HexAddress;
  whitelisted: boolean;
}

export interface GaugeDepositIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'GaugeDeposit';
  gauge: HexAddress;
  pool: HexAddress;
  from: HexAddress;
  to: HexAddress;
  amount: bigint;
}

export interface GaugeWithdrawIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'GaugeWithdraw';
  gauge: HexAddress;
  pool: HexAddress;
  from: HexAddress;
  amount: bigint;
}

export interface CLGaugeDepositIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'CLGaugeDeposit';
  gauge: HexAddress;
  pool: HexAddress;
  user: HexAddress;
  tokenId: bigint;
  liquidityToStake: bigint;
}

export interface CLGaugeWithdrawIndexerBrokerNotifyInput
  extends IndexerBrokerOnchainNotifyBase {
  type: 'CLGaugeWithdraw';
  gauge: HexAddress;
  pool: HexAddress;
  user: HexAddress;
  tokenId: bigint;
  liquidityToStake: bigint;
}

export interface VeDepositIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'VeDeposit';
  provider: HexAddress;
  tokenId: bigint;
  depositType: string;
  value: bigint;
  locktime: bigint;
}

export interface VeWithdrawIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'VeWithdraw';
  provider: HexAddress;
  tokenId: bigint;
  value: bigint;
}

export interface VeLockPermanentIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'VeLockPermanent';
  owner: HexAddress;
  tokenId: bigint;
  amount: bigint;
}

export interface VeUnlockPermanentIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'VeUnlockPermanent';
  owner: HexAddress;
  tokenId: bigint;
  amount: bigint;
}

export interface VeMergeIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'VeMerge';
  sender: HexAddress;
  from: bigint;
  to: bigint;
  amountFrom: bigint;
  amountTo: bigint;
  amountFinal: bigint;
  locktime: bigint;
}

export interface VeSplitIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'VeSplit';
  from: bigint;
  tokenId1: bigint;
  tokenId2: bigint;
  sender: HexAddress;
  splitAmount1: bigint;
  splitAmount2: bigint;
  locktime: bigint;
}

export interface VoterVotedIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'VoterVoted';
  voter: HexAddress;
  pool: HexAddress;
  tokenId: bigint;
  weight: bigint;
  totalWeight: bigint;
  epochTimestamp: bigint;
}

export interface VoterAbstainedIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'VoterAbstained';
  voter: HexAddress;
  pool: HexAddress;
  tokenId: bigint;
  weight: bigint;
  totalWeight: bigint;
  epochTimestamp: bigint;
}

export interface FeeVotingRewardClaimIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'FeeVotingRewardClaim';
  from: HexAddress;
  reward: HexAddress;
  amount: bigint;
  rewardContract: HexAddress;
}

export interface BribeVotingRewardClaimIndexerBrokerNotifyInput extends IndexerBrokerOnchainNotifyBase {
  type: 'BribeVotingRewardClaim';
  from: HexAddress;
  reward: HexAddress;
  amount: bigint;
  rewardContract: HexAddress;
}

/** Argument to `notifyBroker` in amm-indexer (before `ts` is merged). */
export type IndexerBrokerNotifyPayload =
  | PoolCreatedIndexerBrokerNotifyInput
  | CLPoolCreatedIndexerBrokerNotifyInput
  | LiquidityAddedIndexerBrokerNotifyInput
  | CLLiquidityAddedIndexerBrokerNotifyInput
  | SwapIndexerBrokerNotifyInput
  | PoolFactorySetCustomFeeIndexerBrokerNotifyInput
  | PoolFactorySetFeeIndexerBrokerNotifyInput
  | PoolFactorySetFeeManagerIndexerBrokerNotifyInput
  | PoolFactorySetPauseStateIndexerBrokerNotifyInput
  | PoolFactorySetPauserIndexerBrokerNotifyInput
  | PoolFactorySetVoterIndexerBrokerNotifyInput
  | DynamicSwapFeeModuleDefaultFeeCapSetIndexerBrokerNotifyInput
  | DynamicSwapFeeModuleCustomFeeSetIndexerBrokerNotifyInput
  | DynamicSwapFeeModuleDynamicFeeResetIndexerBrokerNotifyInput
  | DynamicSwapFeeModuleDefaultScalingFactorSetIndexerBrokerNotifyInput
  | DynamicSwapFeeModuleDiscountedDeregisteredIndexerBrokerNotifyInput
  | DynamicSwapFeeModuleDiscountedRegisteredIndexerBrokerNotifyInput
  | DynamicSwapFeeModuleFeeCapSetIndexerBrokerNotifyInput
  | DynamicSwapFeeModuleScalingFactorSetIndexerBrokerNotifyInput
  | DynamicSwapFeeModuleSecondsAgoSetIndexerBrokerNotifyInput
  | CLFactoryDefaultUnstakedFeeChangedIndexerBrokerNotifyInput
  | CLFactorySwapFeeModuleChangedIndexerBrokerNotifyInput
  | PoolRegisteredIndexerBrokerNotifyInput
  | VoterGaugeCreatedIndexerBrokerNotifyInput
  | VoterWhitelistTokenIndexerBrokerNotifyInput
  | GaugeDepositIndexerBrokerNotifyInput
  | GaugeWithdrawIndexerBrokerNotifyInput
  | CLGaugeDepositIndexerBrokerNotifyInput
  | CLGaugeWithdrawIndexerBrokerNotifyInput
  | VeDepositIndexerBrokerNotifyInput
  | VeWithdrawIndexerBrokerNotifyInput
  | VeLockPermanentIndexerBrokerNotifyInput
  | VeUnlockPermanentIndexerBrokerNotifyInput
  | VeMergeIndexerBrokerNotifyInput
  | VeSplitIndexerBrokerNotifyInput
  | VoterVotedIndexerBrokerNotifyInput
  | VoterAbstainedIndexerBrokerNotifyInput
  | FeeVotingRewardClaimIndexerBrokerNotifyInput
  | BribeVotingRewardClaimIndexerBrokerNotifyInput;
