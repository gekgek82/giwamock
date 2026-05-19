import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { VeLockService } from './ve-lock.service';

@ApiTags('ve-locks')
@Controller('ve-locks')
export class VeLockController {
  constructor(private readonly veLock: VeLockService) {}

  @Get()
  @ApiOperation({ summary: 'All veNFT positions for a wallet (active + inactive)' })
  @ApiQuery({ name: 'owner', required: true, description: 'Wallet address (0x…)' })
  @ApiOkResponse({ description: 've_lock_positions rows for the owner' })
  async getPositionsByOwner(@Query('owner') owner: string) {
    return this.veLock.getPositionsByOwner(owner);
  }

  @Get('history')
  @ApiOperation({ summary: 'Full VotingEscrow event history for a wallet' })
  @ApiQuery({ name: 'owner', required: true, description: 'Wallet address (0x…)' })
  @ApiOkResponse({ description: 've_lock_events rows for the owner across all tokenIds' })
  async getEventsByOwner(@Query('owner') owner: string) {
    return this.veLock.getEventsByOwner(owner);
  }

  @Get(':tokenId')
  @ApiOperation({ summary: 'Single veNFT position detail' })
  @ApiParam({ name: 'tokenId', description: 'veNFT token ID (decimal string)' })
  @ApiOkResponse({ description: 'Single ve_lock_positions row' })
  async getPosition(@Param('tokenId') tokenId: string) {
    const pos = await this.veLock.getPositionByTokenId(tokenId);
    if (!pos) throw new NotFoundException(`No position for tokenId=${tokenId}`);
    return pos;
  }

  @Get(':tokenId/history')
  @ApiOperation({ summary: 'VotingEscrow event history for one veNFT' })
  @ApiParam({ name: 'tokenId', description: 'veNFT token ID (decimal string)' })
  @ApiOkResponse({ description: 've_lock_events rows for the tokenId' })
  async getTokenHistory(@Param('tokenId') tokenId: string) {
    return this.veLock.getEventsByTokenId(tokenId);
  }
}
