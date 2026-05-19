import { ApiProperty } from '@nestjs/swagger';
import type { GetProtocolContractsResponseDto, ProtocolContractsMap } from './protocol-contracts';

/**
 * Full OpenAPI shape for {@link ProtocolContractsMap} — matches runtime `CONTRACT_ADDRESSES`
 * (same keys as `apps/api` `ContractsAddressesDto` plus deployment extras).
 */
export class ProtocolContractsMapSwaggerDto implements ProtocolContractsMap {
  @ApiProperty({ description: 'TER token contract address (ERC20)' })
  terToken!: string;

  @ApiProperty({ description: 'Voting Escrow contract address (veTER NFT)' })
  votingEscrow!: string;

  @ApiProperty({ description: 'Voter contract address' })
  voter!: string;

  @ApiProperty({ description: 'Minter contract address' })
  minter!: string;

  @ApiProperty({ description: 'Rewards Distributor contract address' })
  rewardsDistributor!: string;

  @ApiProperty({ description: 'Pool implementation (logic) contract address' })
  poolImplementation!: string;

  @ApiProperty({ description: 'Pool Factory contract address' })
  poolFactory!: string;

  @ApiProperty({ description: 'CL Pool Factory contract address' })
  clPoolFactory!: string;

  @ApiProperty({ description: 'CL Pool implementation contract address' })
  clPoolImplementation!: string;

  @ApiProperty({ description: 'Factory Registry contract address' })
  factoryRegistry!: string;

  @ApiProperty({ description: 'Gauge Factory contract address' })
  gaugeFactory!: string;

  @ApiProperty({ description: 'CL Gauge Factory contract address' })
  clGaugeFactory!: string;

  @ApiProperty({ description: 'CL Gauge implementation contract address' })
  clGaugeImplementation!: string;

  @ApiProperty({ description: 'Voting Rewards Factory contract address' })
  votingRewardsFactory!: string;

  @ApiProperty({ description: 'Managed Rewards Factory contract address' })
  managedRewardsFactory!: string;

  @ApiProperty({ description: 'TerGovernor contract address' })
  terGovernor!: string;

  @ApiProperty({ description: 'Epoch Governor contract address' })
  epochGovernor!: string;

  @ApiProperty({ description: 'Router contract address' })
  router!: string;

  @ApiProperty({ description: 'Swap Router contract address (CL)' })
  swapRouter!: string;

  @ApiProperty({ description: 'NFT Position Manager contract address' })
  nftPositionManager!: string;

  @ApiProperty({ description: 'VeArtProxy contract address' })
  veArtProxy!: string;

  @ApiProperty({ description: 'TerPoint contract address' })
  terPoint!: string;

  @ApiProperty({ description: 'Point Exchanger contract address' })
  pointExchanger!: string;

  @ApiProperty({ description: 'Dynamic Swap Fee Module contract address' })
  dynamicSwapFeeModule!: string;

  @ApiProperty({ description: 'Permit2 contract address' })
  permit2!: string;

  @ApiProperty({ description: 'Universal Router contract address' })
  universalRouter!: string;

  @ApiProperty({ description: 'WGIWA (Wrapped GIWA) contract address' })
  wgiwa!: string;

  @ApiProperty({
    description:
      'Multi-token faucet (testnet); 0x0 if unset. Token owners must setMinter(faucet).',
  })
  multiTokenFaucet!: string;

  @ApiProperty({
    description:
      'PoolRewardRegistry (AMM pool discovery via PoolRegistered); 0x0 if unset.',
  })
  poolRewardRegistry!: string;
}

/**
 * OpenAPI envelope for {@link GetProtocolContractsResponseDto}.
 */
export class GetProtocolContractsResponseSwaggerDto
  implements GetProtocolContractsResponseDto
{
  @ApiProperty({ type: ProtocolContractsMapSwaggerDto })
  contracts!: ProtocolContractsMapSwaggerDto;
}
