import { CONTRACT_ADDRESSES } from '../constants/contracts';

/**
 * Same contract roles as `ContractsAddressesDto` in `apps/api` (core + factories + governance +
 * periphery + points + external). Does **not** include pool/gauge **implementation** deployments or
 * `dynamicSwapFeeModule`.
 */
export interface ContractsAddresses {
  terToken: string;
  votingEscrow: string;
  voter: string;
  minter: string;
  rewardsDistributor: string;
  poolFactory: string;
  clPoolFactory: string;
  factoryRegistry: string;
  gaugeFactory: string;
  clGaugeFactory: string;
  votingRewardsFactory: string;
  terGovernor: string;
  epochGovernor: string;
  router: string;
  swapRouter: string;
  nftPositionManager: string;
  veArtProxy: string;
  terPoint: string;
  pointExchanger: string;
  permit2: string;
  universalRouter: string;
  wgiwa: string;
  /** Multi-asset test faucet; `0x0` if not deployed. */
  multiTokenFaucet: string;
  /** Pool discovery registry (`PoolRegistered`); `0x0` if not deployed. */
  poolRewardRegistry: string;
}

/** Implementation deployments + managed rewards factory + dynamic swap fee module (Giwa Sepolia). */
export interface ContractsDeploymentExtras {
  poolImplementation: string;
  clPoolImplementation: string;
  clGaugeImplementation: string;
  managedRewardsFactory: string;
  dynamicSwapFeeModule: string;
}

/**
 * Full broker/gateway `contracts` JSON: {@link ContractsAddresses} ∪ {@link ContractsDeploymentExtras}.
 * Alias of `CONTRACT_ADDRESSES` in `constants/contracts.ts`.
 */
export type ProtocolContractsMap = ContractsAddresses & ContractsDeploymentExtras;

export interface GetProtocolContractsResponseDto {
  contracts: ProtocolContractsMap;
}

/** Compile-time guard: `CONTRACT_ADDRESSES` must expose every key required by the API DTO + extras. */
void (CONTRACT_ADDRESSES satisfies ProtocolContractsMap);
