import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type {
  SetSpotListedDto,
  SpotTokenLeaderboardPageDto,
  SpotTokenRecordDto,
  SpotTokensBySymbolResponseDto,
} from '@giwater/shared';
import { parseListedQueryParam } from '../../spot-catalog/parse-listed-query';
import { parseSpotLeaderboardSortParam } from '../../spot-catalog/parse-spot-leaderboard-sort';
import { SpotCatalogService } from '../../spot-catalog/spot-catalog.service';

@ApiTags('spot-tokens')
@Controller('spot-tokens')
export class SpotTokensController {
  constructor(private readonly spot: SpotCatalogService) {}

  @Get('leaderboard/day-change/:sort')
  @ApiOperation({
    summary: 'Paginated tokens: day % change leaderboard',
    description:
      'Orders by `spot_tokens.dayPriceDifferencePercentage` in the requested direction (UTC-day field on row), tie-break `id` ascending. Use `desc` for largest positive moves first, `asc` for most negative first.',
  })
  @ApiParam({
    name: 'sort',
    enum: ['asc', 'desc'],
    description: '`desc` — top gainers first; `asc` — top losers (most negative) first.',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Rows to skip (default 0)',
    example: 0,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size (default 50, max 200)',
    example: 50,
  })
  @ApiQuery({
    name: 'listed',
    required: false,
    type: Boolean,
    description:
      'When true (default), only rows with `listed === true`. When false, only `listed === false`.',
    example: true,
  })
  @ApiOkResponse({
    description: '`SpotTokenLeaderboardPageDto`',
    schema: {
      type: 'object',
      properties: {
        offset: { type: 'number' },
        limit: { type: 'number' },
        total: { type: 'number' },
        items: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
      },
    },
  })
  async listLeaderboardDayChange(
    @Param('sort') sortRaw: string,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('listed') listedRaw?: string,
  ): Promise<SpotTokenLeaderboardPageDto> {
    const listed = parseListedQueryParam(listedRaw);
    const sort = parseSpotLeaderboardSortParam(sortRaw);
    return this.spot.listTokensLeaderboardDayChange(offset, limit, listed, sort);
  }

  @Get('leaderboard/tvl/:sort')
  @ApiOperation({
    summary: 'Paginated tokens: day TVL leaderboard',
    description:
      'Orders by `dayTvlUSD`, then `dayTvl` (on-chain / non-USD hint column), in the requested direction.',
  })
  @ApiParam({ name: 'sort', enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({
    name: 'listed',
    required: false,
    type: Boolean,
    description:
      'When true (default), only rows with `listed === true`. When false, only `listed === false`.',
    example: true,
  })
  @ApiOkResponse({
    description: '`SpotTokenLeaderboardPageDto`',
    schema: {
      type: 'object',
      properties: {
        offset: { type: 'number' },
        limit: { type: 'number' },
        total: { type: 'number' },
        items: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
      },
    },
  })
  async listLeaderboardTvl(
    @Param('sort') sortRaw: string,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('listed') listedRaw?: string,
  ): Promise<SpotTokenLeaderboardPageDto> {
    const listed = parseListedQueryParam(listedRaw);
    const sort = parseSpotLeaderboardSortParam(sortRaw);
    return this.spot.listTokensLeaderboardTvl(offset, limit, listed, sort);
  }

  @Get('leaderboard/volume/:sort')
  @ApiOperation({
    summary: 'Paginated tokens: day volume leaderboard',
    description:
      'Orders by `dayVolumeUSD`, then `dayVolume` (absolute units on row), in the requested direction.',
  })
  @ApiParam({ name: 'sort', enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({
    name: 'listed',
    required: false,
    type: Boolean,
    description:
      'When true (default), only rows with `listed === true`. When false, only `listed === false`.',
    example: true,
  })
  @ApiOkResponse({
    description: '`SpotTokenLeaderboardPageDto`',
    schema: {
      type: 'object',
      properties: {
        offset: { type: 'number' },
        limit: { type: 'number' },
        total: { type: 'number' },
        items: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
      },
    },
  })
  async listLeaderboardVolume(
    @Param('sort') sortRaw: string,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('listed') listedRaw?: string,
  ): Promise<SpotTokenLeaderboardPageDto> {
    const listed = parseListedQueryParam(listedRaw);
    const sort = parseSpotLeaderboardSortParam(sortRaw);
    return this.spot.listTokensLeaderboardVolume(offset, limit, listed, sort);
  }

  @Get('recently-created')
  @ApiOperation({
    summary: 'Paginated tokens: recently created',
    description:
      'Orders by `spot_tokens.listingDate` descending (tie-break `id` DESC). Default `listed=true` matches public catalog; pass `listed=false` for unlisted / pending curation.',
  })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({
    name: 'listed',
    required: false,
    type: Boolean,
    description:
      'When true (default), only `listed === true` rows. When false, only `listed === false`.',
    example: true,
  })
  @ApiOkResponse({
    description: '`SpotTokenLeaderboardPageDto`',
    schema: {
      type: 'object',
      properties: {
        offset: { type: 'number' },
        limit: { type: 'number' },
        total: { type: 'number' },
        items: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
      },
    },
  })
  async listRecentlyCreated(
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('listed') listedRaw?: string,
  ): Promise<SpotTokenLeaderboardPageDto> {
    const listed = parseListedQueryParam(listedRaw, true);
    return this.spot.listTokensRecentlyCreated(offset, limit, listed);
  }

  @Post('create')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Admin: create or upsert a spot token from ERC20 metadata',
    description:
      'Inserts a new row (or updates symbol/name/decimals if the row already exists) and sets listed=true.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['address', 'symbol', 'decimals'],
      properties: {
        address: { type: 'string' },
        symbol: { type: 'string' },
        name: { type: 'string' },
        decimals: { type: 'number' },
      },
    },
  })
  async createToken(
    @Body() body: { address?: string; symbol?: string; name?: string; decimals?: number },
  ): Promise<SpotTokenRecordDto> {
    if (!body.address || !body.symbol || typeof body.decimals !== 'number') {
      throw new BadRequestException('address, symbol, and decimals are required');
    }
    return this.spot.upsertTokenByErc20({
      address: body.address,
      symbol: body.symbol,
      name: body.name ?? body.symbol,
      decimals: body.decimals,
    });
  }

  @Post('by-address/:address/listing')
  @HttpCode(200)
  @ApiOperation({
    summary: 'List or unlist a token',
    description: 'Sets `spot_tokens.listed` for catalog visibility.',
  })
  @ApiParam({
    name: 'address',
    description: 'Token contract address',
    example: '0x0000000000000000000000000000000000000000',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['listed'],
      properties: { listed: { type: 'boolean', example: true } },
    },
  })
  @ApiOkResponse({
    description: 'Updated `SpotTokenRecordDto`',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiNotFoundResponse({ description: 'No row for this address' })
  async setTokenListing(
    @Param('address') address: string,
    @Body() body: SetSpotListedDto,
  ): Promise<SpotTokenRecordDto> {
    if (typeof body?.listed !== 'boolean') {
      throw new BadRequestException('body.listed must be a boolean');
    }
    return this.spot.setTokenListed(address, body.listed);
  }

  @Get('by-address/:address')
  @ApiOperation({
    summary: 'Get spot token by contract address',
    description:
      'Looks up `spot_tokens` by primary key (`id`). Address is normalized with trim + lowercase.',
  })
  @ApiParam({
    name: 'address',
    description: 'Token contract address (0x-prefixed hex)',
    example: '0x0000000000000000000000000000000000000000',
  })
  @ApiQuery({
    name: 'listed',
    required: false,
    type: Boolean,
    description:
      'When true (default), only return the row if `listed === true`. When false, only if `listed === false`.',
    example: true,
  })
  @ApiOkResponse({
    description: 'Full `spot_tokens` row (`SpotTokenRecordDto`)',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiNotFoundResponse({ description: 'No row for this address' })
  async getByAddress(
    @Param('address') address: string,
    @Query('listed') listedRaw?: string,
  ): Promise<SpotTokenRecordDto> {
    if (typeof address !== 'string' || !address.trim()) {
      throw new BadRequestException('Path parameter `address` is required');
    }
    const listed = parseListedQueryParam(listedRaw);
    const row = await this.spot.findTokenByAddress(address, listed);
    if (!row) {
      throw new NotFoundException('No spot_tokens row for this address');
    }
    return row;
  }

  @Get('by-symbol/:symbol')
  @ApiOperation({
    summary: 'List spot tokens by symbol',
    description:
      'Case-insensitive match on `spot_tokens.symbol`. Returns every matching row (symbols may collide across chains).',
  })
  @ApiParam({
    name: 'symbol',
    description: 'Token symbol as stored on the row',
    example: 'WETH',
  })
  @ApiQuery({
    name: 'listed',
    required: false,
    type: Boolean,
    description:
      'When true (default), only rows with `listed === true`. When false, only `listed === false`.',
    example: true,
  })
  @ApiOkResponse({
    description: '`{ items: SpotTokenRecordDto[] }`',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'No rows for this symbol' })
  async getBySymbol(
    @Param('symbol') symbol: string,
    @Query('listed') listedRaw?: string,
  ): Promise<SpotTokensBySymbolResponseDto> {
    if (typeof symbol !== 'string' || !symbol.trim()) {
      throw new BadRequestException('Path parameter `symbol` is required');
    }
    const listed = parseListedQueryParam(listedRaw);
    const items = await this.spot.findTokensBySymbol(symbol, listed);
    if (items.length === 0) {
      throw new NotFoundException('No spot_tokens rows for this symbol');
    }
    return { items };
  }
}
