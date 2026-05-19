/**
 * GiwaTer Protocol Contract Addresses (Giwa Sepolia - Chain ID 91342)
 *
 * All contract addresses are hardcoded here as the single source of truth.
 * Both `apps/api` and `apps/web` import from this file via `@giwater/shared`.
 */

type Address = `0x${string}`;

// ============================================================================
// Core Contracts
// ============================================================================

export const TER_TOKEN_ADDRESS: Address =
  "0xE42d2BddA6c2818a8447992DF29eb8390dFB434f";
export const VOTING_ESCROW_ADDRESS: Address =
  "0x12731A3d1d468F41A5Daf6cA8dF764c74E6bAe6c";
export const VOTER_ADDRESS: Address =
  "0x4eDf766Bef6f1b16E5d99C72f907E93afD06bf6F";
export const MINTER_ADDRESS: Address =
  "0x04B4216e06716F80914c7571BEb71320fF8F2Da6";
export const REWARDS_DISTRIBUTOR_ADDRESS: Address =
  "0xd49d2C0b5A65d3794395c23Bc2451dA7ED0660a9";

// ============================================================================
// Factory Contracts
// ============================================================================

export const POOL_IMPLEMENTATION_ADDRESS: Address =
  "0x1a5270007b1341fe70b996E8b1105072e4523b17";
export const POOL_FACTORY_ADDRESS: Address =
  "0xE5Bf56730647F5dfe36E29BdD96e368f24A56364";
export const CL_POOL_FACTORY_ADDRESS: Address =
  "0x75f88696390cc77A3df12EAeE6Fe2cfE5d24fF0f";
export const CL_POOL_IMPLEMENTATION_ADDRESS: Address =
  "0xAd92Fdc8DC0aAB7233B375c7996669Fc9dFc63Ba";
export const FACTORY_REGISTRY_ADDRESS: Address =
  "0x61Abd3C1D82B1e08De82eDf43d33ed3c3Ed80453";
export const GAUGE_FACTORY_ADDRESS: Address =
  "0xD7A3c0d17dE240E3c571a244E7652BdaEa3A307f";
export const CL_GAUGE_FACTORY_ADDRESS: Address =
  "0xbC20F4a3Ff84F0f8BF8D555a51A4C5A5C6fa19AB";
export const CL_GAUGE_IMPLEMENTATION_ADDRESS: Address =
  "0xeb3F35aAABc5bF8d6300c46f815f84DAe1DC8b0E";
export const VOTING_REWARDS_FACTORY_ADDRESS: Address =
  "0x547a0E3Bdb3AE335729DA6d3cd2DcEf4E369C09b";
export const MANAGED_REWARDS_FACTORY_ADDRESS: Address =
  "0xc2e94ebc889fe7F76B92D28D2acfe757EE4A1bbF";

// ============================================================================
// Governance Contracts
// ============================================================================

export const TER_GOVERNOR_ADDRESS: Address =
  "0x37E20c1027c3aB5E0897E1717b59BCce0bA3568b";
export const EPOCH_GOVERNOR_ADDRESS: Address =
  "0x2034F8e6cEE05C0f261D9aA7740312F4A7d15E62";

// ============================================================================
// Periphery Contracts
// ============================================================================

export const ROUTER_ADDRESS: Address =
  "0x8f0799E30E5c2Ca06b23E1233CF8DE5b92ad4437";
export const SWAP_ROUTER_ADDRESS: Address =
  "0x3Ca775f5e228C3C93B7eD9F2070D2b9F8C59C599";
export const NFT_POSITION_MANAGER_ADDRESS: Address =
  "0x6aCa0A935d2F3e824206EfAe28513fc7612644E1";
export const VE_ART_PROXY_ADDRESS: Address =
  "0x0DA4aA44b33B544eC6e8b19dC39079d1321108FB";

// ============================================================================
// Point System Contracts
// (Not present in the 2026-04-30 Giwa Sepolia deployment manifest; addresses unchanged.)
// ============================================================================

export const TER_POINT_ADDRESS: Address =
  "0xF6e3A7a0dc35B89711C213fe5fFdb766A1c29db6";
export const POINT_EXCHANGER_ADDRESS: Address =
  "0x25aE18a0C21e5eA83DF547a77810F101FA7d5e2A";

// ============================================================================
// Fee Module Contracts
// ============================================================================

export const DYNAMIC_SWAP_FEE_MODULE_ADDRESS: Address =
  "0x1C11082CDD897Fb6C2CdB08105c6610871a52C73";

// ============================================================================
// External Contracts (Permit2, Universal Router, WGIWA)
// ============================================================================

export const PERMIT2_ADDRESS: Address =
  "0x000000000022D473030F116dDEE9F6B43aC78BA3";
export const UNIVERSAL_ROUTER_ADDRESS: Address =
  "0xA6Cd45F606Ed54d44F9F83f136222c9Dc70791Ab";
export const WGIWA_ADDRESS: Address =
  "0x4200000000000000000000000000000000000006";

/// @dev Set after deployment; `0x0` means not configured (admin UI can use address override).
export const MULTI_TOKEN_FAUCET_ADDRESS: Address =
  "0x0000000000000000000000000000000000000000";

/// @dev `PoolRewardRegistry` for AMM pool discovery (`PoolRegistered`); `0x0` until deployed.
export const POOL_REWARD_REGISTRY_ADDRESS: Address =
  "0xAA423671Ce92F1ce618bD4Df2d5ff5614c11c01d";

// ============================================================================
// Deployment Start Blocks (Giwa Sepolia - 2026-05-13 deployment)
// Keep in sync with Giwater-Contracts/deployments.json when redeploying.
// ============================================================================

export const CONTRACT_START_BLOCKS = {
  poolFactory: 25469259,
  clPoolFactory: 25469259,
  nftPositionManager: 25469259,
  poolRewardRegistry: 25469263,
  votingEscrow: 25469306,
  voter: 25469314,
  dynamicSwapFeeModule: 25469399,
  giwaUniversalRouter: 25469405,
} as const;

// ============================================================================
// Grouped object (for API responses, etc.)
// ============================================================================

export const CONTRACT_ADDRESSES = {
  // Core
  terToken: TER_TOKEN_ADDRESS,
  votingEscrow: VOTING_ESCROW_ADDRESS,
  voter: VOTER_ADDRESS,
  minter: MINTER_ADDRESS,
  rewardsDistributor: REWARDS_DISTRIBUTOR_ADDRESS,
  // Factory
  poolImplementation: POOL_IMPLEMENTATION_ADDRESS,
  poolFactory: POOL_FACTORY_ADDRESS,
  clPoolFactory: CL_POOL_FACTORY_ADDRESS,
  clPoolImplementation: CL_POOL_IMPLEMENTATION_ADDRESS,
  factoryRegistry: FACTORY_REGISTRY_ADDRESS,
  gaugeFactory: GAUGE_FACTORY_ADDRESS,
  clGaugeFactory: CL_GAUGE_FACTORY_ADDRESS,
  clGaugeImplementation: CL_GAUGE_IMPLEMENTATION_ADDRESS,
  votingRewardsFactory: VOTING_REWARDS_FACTORY_ADDRESS,
  managedRewardsFactory: MANAGED_REWARDS_FACTORY_ADDRESS,
  // Governance
  terGovernor: TER_GOVERNOR_ADDRESS,
  epochGovernor: EPOCH_GOVERNOR_ADDRESS,
  // Periphery
  router: ROUTER_ADDRESS,
  swapRouter: SWAP_ROUTER_ADDRESS,
  nftPositionManager: NFT_POSITION_MANAGER_ADDRESS,
  veArtProxy: VE_ART_PROXY_ADDRESS,
  // Point System
  terPoint: TER_POINT_ADDRESS,
  pointExchanger: POINT_EXCHANGER_ADDRESS,
  // Fee Module
  dynamicSwapFeeModule: DYNAMIC_SWAP_FEE_MODULE_ADDRESS,
  // External
  permit2: PERMIT2_ADDRESS,
  universalRouter: UNIVERSAL_ROUTER_ADDRESS,
  wgiwa: WGIWA_ADDRESS,
  multiTokenFaucet: MULTI_TOKEN_FAUCET_ADDRESS,
  poolRewardRegistry: POOL_REWARD_REGISTRY_ADDRESS,
} as const;
