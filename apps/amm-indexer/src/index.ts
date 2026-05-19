import { POOL_REWARD_REGISTRY_ADDRESS } from "@giwater/shared";
import { ponder } from "ponder:registry";
import { handleCLLiquidityAdded } from "./handlers/clLiquidityAdded";
import { handleCLPoolCreated } from "./handlers/clPoolCreated";
import { handleCLFactoryDefaultUnstakedFeeChanged, handleCLFactorySwapFeeModuleChanged } from "./handlers/clFactoryFeeEvents";
import {
  handleCustomFeeSet,
  handleDefaultFeeCapSet,
  handleDefaultScalingFactorSet,
  handleDiscountedDeregistered,
  handleDiscountedRegistered,
  handleDynamicFeeReset,
  handleFeeCapSet,
  handleScalingFactorSet,
  handleSecondsAgoSet,
} from "./handlers/dynamicSwapFeeEvents";
import { handleLiquidityAdded } from "./handlers/liquidityAdded";
import { handlePoolCreated } from "./handlers/poolCreated";
import { handlePoolRewardRegistryPoolRegistered } from "./handlers/poolRewardRegistryPoolRegistered";
import { handleVoterGaugeCreated } from "./handlers/voterGaugeCreated";
import { handleVoterWhitelistToken } from "./handlers/voterWhitelistToken";
import {
  handlePoolFactorySetCustomFee,
  handlePoolFactorySetFee,
  handlePoolFactorySetFeeManager,
  handlePoolFactorySetPauser,
  handlePoolFactorySetPauseState,
  handlePoolFactorySetVoter,
} from "./handlers/poolFactoryEvents";
import { handleSetup } from "./handlers/setup";
import { handleSwap } from "./handlers/swap";
import { handleGaugeDeposit } from "./handlers/gaugeDeposit";
import { handleGaugeWithdraw } from "./handlers/gaugeWithdraw";
import { handleCLGaugeDeposit } from "./handlers/clGaugeDeposit";
import { handleCLGaugeWithdraw } from "./handlers/clGaugeWithdraw";
import { handleNfpmIncreaseLiquidity } from "./handlers/nfpmIncreaseLiquidity";
import { handleVeDeposit } from "./handlers/veDeposit";
import { handleVeWithdraw } from "./handlers/veWithdraw";
import { handleVeLockPermanent } from "./handlers/veLockPermanent";
import { handleVeUnlockPermanent } from "./handlers/veUnlockPermanent";
import { handleVeMerge } from "./handlers/veMerge";
import { handleVeSplit } from "./handlers/veSplit";
import { handleVoterVoted } from "./handlers/voterVoted";
import { handleVoterAbstained } from "./handlers/voterAbstained";
import { handleFeeVotingRewardClaim } from "./handlers/feeVotingRewardClaim";
import { handleBribeVotingRewardClaim } from "./handlers/bribeVotingRewardClaim";

ponder.on("GiwaUniversalRouter:setup" as any, (args: any) =>
  handleSetup({ ...args, source: "GiwaUniversalRouter:setup" }),
);

ponder.on("GiwaUniversalRouter:PoolCreated" as any, (args: any) =>
  handlePoolCreated({ ...args, source: "GiwaUniversalRouter:PoolCreated" }),
);
ponder.on(
  "GiwaUniversalRouter:CLPoolCreated" as any,
  (args: any) =>
    handleCLPoolCreated({
      ...args,
      source: "GiwaUniversalRouter:CLPoolCreated",
    }),
);
ponder.on(
  "GiwaUniversalRouter:LiquidityAdded" as any,
  (args: any) =>
    handleLiquidityAdded({
      ...args,
      source: "GiwaUniversalRouter:LiquidityAdded",
    }),
);
ponder.on(
  "GiwaUniversalRouter:CLLiquidityAdded" as any,
  (args: any) =>
    handleCLLiquidityAdded({
      ...args,
      source: "GiwaUniversalRouter:CLLiquidityAdded",
    }),
);
ponder.on("GiwaUniversalRouter:Swap" as any, (args: any) =>
  handleSwap({ ...args, source: "GiwaUniversalRouter:Swap" }),
);
ponder.on("DynamicSwapFeeModule:CustomFeeSet" as any, (args: any) =>
  handleCustomFeeSet({ ...args, source: "DynamicSwapFeeModule:CustomFeeSet" }),
);
ponder.on(
  "DynamicSwapFeeModule:DynamicFeeReset" as any,
  (args: any) =>
    handleDynamicFeeReset({
      ...args,
      source: "DynamicSwapFeeModule:DynamicFeeReset",
    }),
);

// CLFactory:PoolCreated — direct CL pool creation (no token info in event; broker enriches later).
ponder.on("CLFactory:PoolCreated" as any, (args: any) =>
  handleCLPoolCreated({ ...args, source: "CLFactory:PoolCreated" }),
);
ponder.on("CLFactory:DefaultUnstakedFeeChanged" as any, (args: any) =>
  handleCLFactoryDefaultUnstakedFeeChanged({ ...args, source: "CLFactory:DefaultUnstakedFeeChanged" }),
);
ponder.on("CLFactory:SwapFeeModuleChanged" as any, (args: any) =>
  handleCLFactorySwapFeeModuleChanged({ ...args, source: "CLFactory:SwapFeeModuleChanged" }),
);

// NonfungiblePositionManager:IncreaseLiquidity — CL liquidity added directly via NFPM (not through GiwaUniversalRouter).
ponder.on("NonfungiblePositionManager:IncreaseLiquidity" as any, (args: any) =>
  handleNfpmIncreaseLiquidity(args),
);

// PoolFactory events (registered in ponder.config.ts).
// PoolCreated / CLPoolCreated are indexed only from GiwaUniversalRouter (TokenInfo ABI).
ponder.on("PoolFactory:SetCustomFee" as any, (args: any) =>
  handlePoolFactorySetCustomFee({ ...args, source: "PoolFactory:SetCustomFee" }),
);
ponder.on("PoolFactory:SetFee" as any, (args: any) =>
  handlePoolFactorySetFee({ ...args, source: "PoolFactory:SetFee" }),
);
ponder.on("PoolFactory:SetFeeManager" as any, (args: any) =>
  handlePoolFactorySetFeeManager({ ...args, source: "PoolFactory:SetFeeManager" }),
);
ponder.on("PoolFactory:SetPauseState" as any, (args: any) =>
  handlePoolFactorySetPauseState({ ...args, source: "PoolFactory:SetPauseState" }),
);
ponder.on("PoolFactory:SetPauser" as any, (args: any) =>
  handlePoolFactorySetPauser({ ...args, source: "PoolFactory:SetPauser" }),
);
ponder.on("PoolFactory:SetVoter" as any, (args: any) =>
  handlePoolFactorySetVoter({ ...args, source: "PoolFactory:SetVoter" }),
);

ponder.on("Voter:GaugeCreated" as any, (args: any) =>
  handleVoterGaugeCreated({ ...args, source: "Voter:GaugeCreated" }),
);
ponder.on("Voter:WhitelistToken" as any, (args: any) =>
  handleVoterWhitelistToken({ ...args, source: "Voter:WhitelistToken" }),
);

const ZERO = "0x0000000000000000000000000000000000000000";
const poolRewardRegistryAddr = (
  process.env.PONDER_POOL_REWARD_REGISTRY_ADDRESS ?? POOL_REWARD_REGISTRY_ADDRESS
).toLowerCase();
if (
  poolRewardRegistryAddr.startsWith("0x") &&
  poolRewardRegistryAddr.length === 42 &&
  poolRewardRegistryAddr !== ZERO
) {
  ponder.on("PoolRewardRegistry:PoolRegistered" as any, (args: any) =>
    handlePoolRewardRegistryPoolRegistered({
      ...args,
      source: "PoolRewardRegistry:PoolRegistered",
    }),
  );
}

// DynamicSwapFeeModule events (registered in ponder.config.ts)
ponder.on(
  "DynamicSwapFeeModule:DefaultFeeCapSet" as any,
  (args: any) =>
    handleDefaultFeeCapSet({
      ...args,
      source: "DynamicSwapFeeModule:DefaultFeeCapSet",
    }),
);
ponder.on(
  "DynamicSwapFeeModule:DefaultScalingFactorSet" as any,
  (args: any) =>
    handleDefaultScalingFactorSet({
      ...args,
      source: "DynamicSwapFeeModule:DefaultScalingFactorSet",
    }),
);
ponder.on(
  "DynamicSwapFeeModule:DiscountedDeregistered" as any,
  (args: any) =>
    handleDiscountedDeregistered({
      ...args,
      source: "DynamicSwapFeeModule:DiscountedDeregistered",
    }),
);
ponder.on(
  "DynamicSwapFeeModule:DiscountedRegistered" as any,
  (args: any) =>
    handleDiscountedRegistered({
      ...args,
      source: "DynamicSwapFeeModule:DiscountedRegistered",
    }),
);
ponder.on(
  "DynamicSwapFeeModule:FeeCapSet" as any,
  (args: any) =>
    handleFeeCapSet({
      ...args,
      source: "DynamicSwapFeeModule:FeeCapSet",
    }),
);
ponder.on(
  "DynamicSwapFeeModule:ScalingFactorSet" as any,
  (args: any) =>
    handleScalingFactorSet({
      ...args,
      source: "DynamicSwapFeeModule:ScalingFactorSet",
    }),
);
ponder.on(
  "DynamicSwapFeeModule:SecondsAgoSet" as any,
  (args: any) =>
    handleSecondsAgoSet({
      ...args,
      source: "DynamicSwapFeeModule:SecondsAgoSet",
    }),
);

ponder.on("BasicGauge:Deposit" as any, (args: any) =>
  handleGaugeDeposit({ ...args, source: "BasicGauge:Deposit" }),
);
ponder.on("BasicGauge:Withdraw" as any, (args: any) =>
  handleGaugeWithdraw({ ...args, source: "BasicGauge:Withdraw" }),
);
ponder.on("CLGauge:Deposit" as any, (args: any) =>
  handleCLGaugeDeposit({ ...args, source: "CLGauge:Deposit" }),
);
ponder.on("CLGauge:Withdraw" as any, (args: any) =>
  handleCLGaugeWithdraw({ ...args, source: "CLGauge:Withdraw" }),
);

ponder.on("VotingEscrow:Deposit" as any, (args: any) =>
  handleVeDeposit({ ...args, source: "VotingEscrow:Deposit" }),
);
ponder.on("VotingEscrow:Withdraw" as any, (args: any) =>
  handleVeWithdraw({ ...args, source: "VotingEscrow:Withdraw" }),
);
ponder.on("VotingEscrow:LockPermanent" as any, (args: any) =>
  handleVeLockPermanent({ ...args, source: "VotingEscrow:LockPermanent" }),
);
ponder.on("VotingEscrow:UnlockPermanent" as any, (args: any) =>
  handleVeUnlockPermanent({ ...args, source: "VotingEscrow:UnlockPermanent" }),
);
ponder.on("VotingEscrow:Merge" as any, (args: any) =>
  handleVeMerge({ ...args, source: "VotingEscrow:Merge" }),
);
ponder.on("VotingEscrow:Split" as any, (args: any) =>
  handleVeSplit({ ...args, source: "VotingEscrow:Split" }),
);
ponder.on("Voter:Voted" as any, (args: any) =>
  handleVoterVoted({ ...args, source: "Voter:Voted" }),
);
ponder.on("Voter:Abstained" as any, (args: any) =>
  handleVoterAbstained({ ...args, source: "Voter:Abstained" }),
);
ponder.on("FeeVotingReward:ClaimRewards" as any, (args: any) =>
  handleFeeVotingRewardClaim({ ...args, source: "FeeVotingReward:ClaimRewards" }),
);
ponder.on("BribeVotingReward:ClaimRewards" as any, (args: any) =>
  handleBribeVotingRewardClaim({ ...args, source: "BribeVotingReward:ClaimRewards" }),
);
