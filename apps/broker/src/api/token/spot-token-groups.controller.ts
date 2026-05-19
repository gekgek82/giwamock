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
  AddTokenToSpotGroupDto,
  CreateSpotGroupDto,
  SpotGroupRecordDto,
  SpotTokenLeaderboardPageDto,
  SpotGroupTokenMemberDto,
  SpotGroupTokenMembersPageDto,
} from '@giwater/shared';
import { parseListedQueryParam } from '../../spot-catalog/parse-listed-query';
import { parseSpotLeaderboardSortParam } from '../../spot-catalog/parse-spot-leaderboard-sort';
import { SpotGroupsService } from '../../spot-catalog/spot-groups.service';

@ApiTags('spot-token-groups')
@Controller('spot-token-groups')
export class SpotTokenGroupsController {
  constructor(private readonly groups: SpotGroupsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a spot group (for token lists)',
    description:
      'Inserts into `spot_groups`. Same table as pair groups; use distinct `id` namespaces if needed.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', example: 'giwater_memecoin' },
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

  @Post(':groupId/tokens')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Add a token to a group',
    description:
      'Upserts `spot_group_tokens` (`groupId`, `tokenId`). Symbol is copied from `spot_tokens` when present.',
  })
  @ApiParam({ name: 'groupId', description: '`spot_groups.id`', example: 'giwater_memecoin' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['tokenAddress'],
      properties: {
        tokenAddress: { type: 'string', example: '0x...' },
      },
    },
  })
  @ApiOkResponse({
    description: '`SpotGroupTokenMemberDto` (existing membership returns same shape)',
    schema: {
      type: 'object',
      properties: {
        groupId: { type: 'string' },
        tokenId: { type: 'string' },
        symbol: { type: 'string' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Unknown group id' })
  async addTokenToGroup(
    @Param('groupId') groupId: string,
    @Body() body: AddTokenToSpotGroupDto,
  ): Promise<SpotGroupTokenMemberDto> {
    return this.groups.addTokenToGroup(groupId, body);
  }

  @Get(':groupId/tokens')
  @ApiOperation({ summary: 'List tokens in a group' })
  @ApiParam({ name: 'groupId', description: '`spot_groups.id`' })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 200 })
  @ApiOkResponse({ description: '`SpotGroupTokenMembersPageDto`' })
  @ApiNotFoundResponse({ description: 'Unknown group id' })
  async listTokens(
    @Param('groupId') groupId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<SpotGroupTokenMembersPageDto> {
    return this.groups.listTokensInGroup({
      groupId,
      offset: query.offset as number | undefined,
      limit: query.limit as number | undefined,
    });
  }

  @Delete(':groupId/tokens/:tokenAddress')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a token from a group' })
  @ApiParam({ name: 'groupId', description: '`spot_groups.id`' })
  @ApiParam({ name: 'tokenAddress', description: 'Token contract address' })
  @ApiNoContentResponse({ description: 'Removed (idempotent)' })
  @ApiNotFoundResponse({ description: 'Unknown group id' })
  async removeToken(
    @Param('groupId') groupId: string,
    @Param('tokenAddress') tokenAddress: string,
  ): Promise<void> {
    await this.groups.removeTokenFromGroup(groupId, tokenAddress);
  }

  @Get(':groupId/leaderboard/:metric/:sort')
  @ApiOperation({ summary: 'Group leaderboard for tokens' })
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
  ): Promise<SpotTokenLeaderboardPageDto> {
    const metric = (metricRaw ?? '').trim().toLowerCase() as any;
    if (metric !== 'day-change' && metric !== 'tvl' && metric !== 'volume') {
      throw new BadRequestException('metric must be day-change, tvl, or volume');
    }
    const sort = parseSpotLeaderboardSortParam(sortRaw);
    const offset = Number(offsetRaw ?? 0) || 0;
    const limit = Number(limitRaw ?? 50) || 50;
    const listed = parseListedQueryParam(listedRaw, true);
    return this.groups.listTokensGroupLeaderboard({
      groupId,
      metric,
      sort,
      offset,
      limit,
      listed,
    });
  }
}
