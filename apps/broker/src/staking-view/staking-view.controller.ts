import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { StakingViewService } from './staking-view.service';

@ApiTags('staking')
@Controller('staking')
export class StakingViewController {
  constructor(private readonly staking: StakingViewService) {}

  @Get('users/:userAddress/summary')
  @ApiOperation({
    summary: 'LP staked per gauge for a user',
    description:
      'Uses latest `VoterGaugeCreated` rows from indexer + on-chain `Gauge.balanceOf`.',
  })
  @ApiParam({ name: 'userAddress', description: 'Wallet (checksummed or any case)' })
  @ApiOkResponse({ description: 'Staking balances keyed by gauge/pool' })
  async userSummary(@Param('userAddress') userAddress: string) {
    return this.staking.getUserStakingSummary(userAddress);
  }

  @Get('pairs/:poolAddress/reward-metrics')
  @ApiOperation({
    summary: 'Emission / TVL fields for a pool gauge',
    description:
      'Returns on-chain rewardRate, totalSupply, periodFinish. Not a USD APY without prices.',
  })
  @ApiParam({ name: 'poolAddress', description: 'AMM pool contract' })
  @ApiOkResponse({ description: 'Gauge reward metrics' })
  async pairMetrics(@Param('poolAddress') poolAddress: string) {
    return this.staking.getPairRewardMetrics(poolAddress);
  }

  @Get('users/:userAddress/rewards')
  @ApiOperation({
    summary: 'Claimable-style rewards per gauge',
    description:
      'Calls `earned` and reads `rewards` / `periodFinish` / `rewardRate` for gauges with non-zero stake.',
  })
  @ApiParam({ name: 'userAddress', description: 'Wallet' })
  @ApiOkResponse({ description: 'Per-gauge reward snapshot' })
  async userRewards(@Param('userAddress') userAddress: string) {
    return this.staking.getUserRewardSchedule(userAddress);
  }
}
