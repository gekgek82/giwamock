export { default as AirdropDistributorAbi } from './json/AirdropDistributor.json';
export { default as BribeVotingRewardAbi } from './json/BribeVotingReward.json';
export { default as CLFactoryAbi } from './json/CLFactory.json';
export { default as CLGaugeAbi } from './json/CLGauge.json';
export { default as CLPoolAbi } from './json/CLPool.json';
export { default as EpochGovernorAbi } from './json/EpochGovernor.json';
export { default as ERC20Abi } from './json/ERC20.json';
export { default as FactoryRegistryAbi } from './json/FactoryRegistry.json';
export { default as FeesVotingRewardAbi } from './json/FeesVotingReward.json';
export { default as FreeManagedRewardAbi } from './json/FreeManagedReward.json';
export { default as GaugeAbi } from './json/Gauge.json';
export { default as GaugeFactoryAbi } from './json/GaugeFactory.json';
export { default as IERC20Abi } from './json/IERC20.json';
export { default as LockedManagedRewardAbi } from './json/LockedManagedReward.json';
export { default as ManagedRewardsFactoryAbi } from './json/ManagedRewardsFactory.json';
export { default as MinterAbi } from './json/Minter.json';
export { default as NonfungiblePositionManagerAbi } from './json/NonfungiblePositionManager.json';
/** @deprecated Use TerPointAbi instead. PointClaimer has been replaced by TerPoint. */
export { default as PointClaimerAbi } from './json/PointClaimer.json';
export { default as PoolAbi } from './json/Pool.json';
export { default as PoolFactoryAbi } from './json/PoolFactory.json';
export { default as PoolFeesAbi } from './json/PoolFees.json';
export { default as ProtocolForwarderAbi } from './json/ProtocolForwarder.json';
export { default as RewardsDistributorAbi } from './json/RewardsDistributor.json';
export { default as RouterAbi } from './json/Router.json';
export { default as SwapFeeModuleAbi } from './json/SwapFeeModule.json';
export { default as DynamicSwapFeeModuleAbi } from './json/DynamicSwapFeeModule.json';
export { default as SwapRouterAbi } from './json/SwapRouter.json';
export { default as TerAbi } from './json/Ter.json';
export { default as TerPointAbi } from './json/TerPoint.json';
export { default as TerGovernorAbi } from './json/TerGovernor.json';
export { default as TestTokenAbi } from './json/TestToken.json';
export { default as UserMintableTokenAbi } from './json/UserMintableToken.json';
export { default as MultiTokenFaucetAbi } from './json/MultiTokenFaucet.json';
export { default as TokenFaucetAbi } from './json/TokenFaucet.json';
export { default as PoolRewardRegistryAbi } from './json/PoolRewardRegistry.json';
export { default as VeArtProxyAbi } from './json/VeArtProxy.json';
export { default as VoterAbi } from './json/Voter.json';
export { default as VotingEscrowAbi } from './json/VotingEscrow.json';
export { default as VotingRewardsFactoryAbi } from './json/VotingRewardsFactory.json';

export { default as GiwaUniversalRouterAbi } from './json/GiwaUniversalRouter.json';
export { default as Permit2Abi } from './json/Permit2.json';
export { default as PointExchangerAbi } from './json/PointExchanger.json';
// Grouped ABIs object for admin/contract explorer pages
import Ter from './json/Ter.json';
import VotingEscrow from './json/VotingEscrow.json';
import Voter from './json/Voter.json';
import Minter from './json/Minter.json';
import RewardsDistributor from './json/RewardsDistributor.json';
import Pool from './json/Pool.json';
import CLPool from './json/CLPool.json';
import PoolFactory from './json/PoolFactory.json';
import CLFactory from './json/CLFactory.json';
import Gauge from './json/Gauge.json';
import CLGauge from './json/CLGauge.json';
import Router from './json/Router.json';
import SwapRouter from './json/SwapRouter.json';
import NonfungiblePositionManager from './json/NonfungiblePositionManager.json';
import FeesVotingReward from './json/FeesVotingReward.json';
import BribeVotingReward from './json/BribeVotingReward.json';
import TerGovernor from './json/TerGovernor.json';
import EpochGovernor from './json/EpochGovernor.json';
import FactoryRegistry from './json/FactoryRegistry.json';
import IERC20 from './json/IERC20.json';
import ERC20 from './json/ERC20.json';
import TerPoint from './json/TerPoint.json';

import GiwaUniversalRouter from './json/GiwaUniversalRouter.json';
import Permit2 from './json/Permit2.json';
import PointExchanger from './json/PointExchanger.json';
import MultiTokenFaucet from './json/MultiTokenFaucet.json';
import TokenFaucet from './json/TokenFaucet.json';
import PoolRewardRegistry from './json/PoolRewardRegistry.json';
export const ABIs = {
  Ter,
  TerPoint,
  VotingEscrow,
  Voter,
  Minter,
  RewardsDistributor,
  Pool,
  CLPool,
  PoolFactory,
  CLFactory,
  Gauge,
  CLGauge,
  Router,
  SwapRouter,
  NonfungiblePositionManager,
  FeesVotingReward,
  BribeVotingReward,
  TerGovernor,
  EpochGovernor,
  FactoryRegistry,
  IERC20,
  ERC20,
  GiwaUniversalRouter,
  Permit2,
  PointExchanger,
  MultiTokenFaucet,
  TokenFaucet,
  PoolRewardRegistry,
};
