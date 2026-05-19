import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type {
  AddPairToSpotGroupDto,
  CreateSpotGroupDto,
  SpotPairLeaderboardPageDto,
  SpotGroupPairMemberDto,
  SpotGroupPairMembersPageDto,
  SpotGroupRecordDto,
} from '@giwater/shared';
import { parseListedQueryParam } from '../../spot-catalog/parse-listed-query';
import { parseSpotLeaderboardSortParam } from '../../spot-catalog/parse-spot-leaderboard-sort';
import { SpotGroupsService } from '../../spot-catalog/spot-groups.service';

@ApiTags('spot-pair-groups')
@Controller('spot-pair-groups')
export class SpotPairGroupsController {
  constructor(private readonly groups: SpotGroupsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a spot group (for pair lists)',
    description:
      'Inserts into `spot_groups`. Same table as token groups; use distinct `id` namespaces if needed.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', example: 'giwater_major_pools' },
        name: { type: 'string' },
        description: { type: 'string' },
      },
    },
  })
  @ApiCreatedResponse({
    description: '`SpotGroupRecordDto`',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
      },
    },
  })
  @ApiConflictResponse({ description: 'Group id already exists' })
  async createGroup(@Body() body: CreateSpotGroupDto): Promise<SpotGroupRecordDto> {
    return this.groups.createGroup(body);
  }

  @Post(':groupId/pairs')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Add a pair (pool) to a group',
    description:
      'Inserts into `spot_group_pairs`. Requires an existing `spot_pairs` row for `pairAddress`.',
  })
  @ApiParam({ name: 'groupId', description: '`spot_groups.id`', example: 'giwater_major_pools' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['pairAddress'],
      properties: {
        pairAddress: { type: 'string', example: '0x...' },
      },
    },
  })
  @ApiOkResponse({
    description: '`SpotGroupPairMemberDto` (existing membership returns same shape)',
    schema: {
      type: 'object',
      properties: {
        pairId: { type: 'string' },
        groupId: { type: 'string' },
        symbol: { type: 'string' },
        base: { type: 'string' },
        quote: { type: 'string' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Unknown group id or unknown pair address' })
  async addPairToGroup(
    @Param('groupId') groupId: string,
    @Body() body: AddPairToSpotGroupDto,
  ): Promise<SpotGroupPairMemberDto> {
    return this.groups.addPairToGroup(groupId, body);
  }

  @Get(':groupId/pairs')
  @ApiOperation({ summary: 'List pairs in a group' })
  @ApiParam({ name: 'groupId', description: '`spot_groups.id`' })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 200 })
  @ApiOkResponse({ description: '`SpotGroupPairMembersPageDto`' })
  @ApiNotFoundResponse({ description: 'Unknown group id' })
  async listPairs(
    @Param('groupId') groupId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<SpotGroupPairMembersPageDto> {
    return this.groups.listPairsInGroup({
      groupId,
      offset: query.offset as number | undefined,
      limit: query.limit as number | undefined,
    });
  }

  @Delete(':groupId/pairs/:pairAddress')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a pair (pool) from a group' })
  @ApiParam({ name: 'groupId', description: '`spot_groups.id`' })
  @ApiParam({ name: 'pairAddress', description: 'Pair (pool) contract address' })
  @ApiNoContentResponse({ description: 'Removed (idempotent)' })
  @ApiNotFoundResponse({ description: 'Unknown group id' })
  async removePair(
    @Param('groupId') groupId: string,
    @Param('pairAddress') pairAddress: string,
  ): Promise<void> {
    await this.groups.removePairFromGroup(groupId, pairAddress);
  }

  @Get(':groupId/leaderboard/:metric/:sort')
  @ApiOperation({ summary: 'Group leaderboard for pairs' })
  @ApiParam({ name: 'groupId', description: '`spot_groups.id`' })
  @ApiParam({ name: 'metric', enum: ['day-change', 'tvl', 'volume'] })
  @ApiParam({ name: 'sort', enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'listed', required: false, type: Boolean, example: true })
  async leaderboard(
    @Param('groupId') groupId: string,
    @Param('metric') metricRaw: string,
    @Param('sort') sortRaw: string,
    @Query('offset') offsetRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('listed') listedRaw?: string,
  ): Promise<SpotPairLeaderboardPageDto> {
    const metric = (metricRaw ?? '').trim().toLowerCase() as any;
    if (metric !== 'day-change' && metric !== 'tvl' && metric !== 'volume') {
      throw new BadRequestException('metric must be day-change, tvl, or volume');
    }
    const sort = parseSpotLeaderboardSortParam(sortRaw);
    const offset = Number(offsetRaw ?? 0) || 0;
    const limit = Number(limitRaw ?? 50) || 50;
    const listed = parseListedQueryParam(listedRaw, true);
    return this.groups.listPairsGroupLeaderboard({
      groupId,
      metric,
      sort,
      offset,
      limit,
      listed,
    });
  }
}
