import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { WalletLpPositionsResponseDto, WalletStakePositionsResponseDto } from '@giwater/shared';
import { isAddress } from 'viem';
import { SpotAccountLpService } from './spot-account-lp.service';
import { SpotAccountStakeService } from './spot-account-stake.service';

@ApiTags('accounts')
@Controller('accounts')
export class SpotAccountController {
  constructor(
    private readonly lpService: SpotAccountLpService,
    private readonly stakeService: SpotAccountStakeService,
  ) {}

  @Get(':walletAddress/lp-positions')
  @ApiOperation({ summary: 'Get LP positions for a wallet derived from add-liquidity events' })
  @ApiParam({ name: 'walletAddress', description: '0x wallet address' })
  @ApiOkResponse({ description: 'LP positions' })
  async getLpPositions(
    @Param('walletAddress') walletAddress: string,
  ): Promise<WalletLpPositionsResponseDto> {
    if (!isAddress(walletAddress)) {
      throw new NotFoundException('Invalid wallet address');
    }
    return this.lpService.getLpPositions(walletAddress);
  }

  @Get(':walletAddress/stake-positions')
  @ApiOperation({ summary: 'Get gauge staking positions for a wallet derived from Deposit/Withdraw events' })
  @ApiParam({ name: 'walletAddress', description: '0x wallet address' })
  @ApiOkResponse({ description: 'Stake positions' })
  async getStakePositions(
    @Param('walletAddress') walletAddress: string,
  ): Promise<WalletStakePositionsResponseDto> {
    if (!isAddress(walletAddress)) {
      throw new NotFoundException('Invalid wallet address');
    }
    return this.stakeService.getStakePositions(walletAddress);
  }
}
