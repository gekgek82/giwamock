import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { VotingClaimableService } from './voting-claimable.service';
import { VotingService } from './voting.service';

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/i;

@Controller('voting')
export class VotingController {
  constructor(
    private readonly voting: VotingService,
    private readonly claimable: VotingClaimableService,
  ) {}

  @Get('positions')
  async getPositions(@Query('owner') owner: string) {
    if (!owner?.trim() || !ADDR_RE.test(owner.trim())) {
      throw new BadRequestException('owner must be a valid 0x address');
    }
    return this.voting.getPositionsByOwner(owner.trim());
  }

  @Get('events')
  async getVoteEvents(@Query('owner') owner: string) {
    if (!owner?.trim() || !ADDR_RE.test(owner.trim())) {
      throw new BadRequestException('owner must be a valid 0x address');
    }
    return this.voting.getVoteEventsByOwner(owner.trim());
  }

  @Get('claimable/:tokenId')
  async getClaimable(@Param('tokenId') tokenId: string) {
    if (!tokenId?.trim()) {
      throw new BadRequestException('tokenId is required');
    }
    return this.claimable.getClaimableByTokenId(tokenId.trim());
  }

  @Get('claims')
  async getClaims(@Query('owner') owner: string) {
    if (!owner?.trim() || !ADDR_RE.test(owner.trim())) {
      throw new BadRequestException('owner must be a valid 0x address');
    }
    return this.voting.getClaimsByOwner(owner.trim());
  }
}
