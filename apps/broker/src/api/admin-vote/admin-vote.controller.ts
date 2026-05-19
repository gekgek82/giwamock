import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminVoteService } from './admin-vote.service';
import type {
  AdminVoteStatsDto,
  AdminVoteEventsDto,
  AdminVoteDistributionDto,
  AdminVoteByEpochDto,
} from '@giwater/shared';

@ApiTags('admin-vote')
@Controller('admin/vote')
export class AdminVoteController {
  constructor(private readonly voteService: AdminVoteService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Admin: vote stats (weight %, unique voters, current epoch)' })
  @ApiQuery({ name: 'pool', required: false })
  async getStats(@Query('pool') pool?: string): Promise<AdminVoteStatsDto> {
    return this.voteService.getStats(pool);
  }

  @Get('events')
  @ApiOperation({ summary: 'Admin: recent voter_vote_events' })
  @ApiQuery({ name: 'pool', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getEvents(
    @Query('pool') pool?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ): Promise<AdminVoteEventsDto> {
    return this.voteService.getEvents(
      pool,
      limitRaw ? Number(limitRaw) : 20,
      offsetRaw ? Number(offsetRaw) : 0,
    );
  }

  @Get('distribution')
  @ApiOperation({ summary: 'Admin: epoch vote distribution (pie chart data)' })
  @ApiQuery({ name: 'epoch', required: false, type: Number })
  async getDistribution(@Query('epoch') epochRaw?: string): Promise<AdminVoteDistributionDto> {
    return this.voteService.getDistribution(epochRaw ? Number(epochRaw) : undefined);
  }

  @Get('by-epoch')
  @ApiOperation({ summary: 'Admin: total vote weight per epoch (bar chart data)' })
  @ApiQuery({ name: 'pool', required: false })
  @ApiQuery({ name: 'epochs', required: false, type: Number })
  async getByEpoch(
    @Query('pool') pool?: string,
    @Query('epochs') epochsRaw?: string,
  ): Promise<AdminVoteByEpochDto> {
    return this.voteService.getByEpoch(pool, epochsRaw ? Number(epochsRaw) : 8);
  }
}
