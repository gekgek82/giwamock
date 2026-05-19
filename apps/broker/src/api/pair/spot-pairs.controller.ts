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
  ClDynamicFeeReadModelDto,
  SetSpotListedDto,
  SpotPairLeaderboardPageDto,
  SpotPairRecordDto,
  SpotPairsBySymbolResponseDto,
} from '@giwater/shared';
import { DynamicSwapFeeReadModelService } from '../../dynamic-fee/dynamic-swap-fee-read-model.service';
import { parseListedQueryParam } from '../../spot-catalog/parse-listed-query';
import { parseSpotLeaderboardSortParam } from '../../spot-catalog/parse-spot-leaderboard-sort';
import { SpotCatalogService } from '../../spot-catalog/spot-catalog.service';

@ApiTags('spot-pairs')
@Controller('spot-pairs')
export class SpotPairsController {
  constructor(
    private readonly spot: SpotCatalogService,
    private readonly dynamicSwapFeeReadModel: DynamicSwapFeeReadModelService,
  ) {}

  @Get('leaderboard/day-change/:sort')
  @ApiOperation({
    summary: 'Paginated pairs: day % change leaderboard',
    description:
      'Orders by `spot_pairs.dayPriceDifferencePercentage` in the requested direction, tie-break `id` (pool address) ascending.',
  })
  @ApiParam({
    name: 'sort',
    enum: ['asc', 'desc'],
    description: '`desc` — top gainers first; `asc` — top losers (most negative) first.',
  })
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
    description: '`SpotPairLeaderboardPageDto`',
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
  ): Promise<SpotPairLeaderboardPageDto> {
    const listed = parseListedQueryParam(listedRaw);
    const sort = parseSpotLeaderboardSortParam(sortRaw);
    return this.spot.listPairsLeaderboardDayChange(offset, limit, listed, sort);
  }

  @Get('leaderboard/tvl/:sort')
  @ApiOperation({
    summary: 'Paginated pairs: TVL / depth leaderboard',
    description:
      'Orders by **inventory notionally in quote**: `baseLiquidity * displayPrice + quoteLiquidity` (DTO/JSON names). Under the hood Postgres columns are still `baseTvl` / `quoteTvl` for the same values. Falls back to `dayBaseTvlUSD + dayQuoteTvlUSD` when inventory×price is zero.',
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
    description: '`SpotPairLeaderboardPageDto`',
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
  ): Promise<SpotPairLeaderboardPageDto> {
    const listed = parseListedQueryParam(listedRaw);
    const sort = parseSpotLeaderboardSortParam(sortRaw);
    return this.spot.listPairsLeaderboardTvl(offset, limit, listed, sort);
  }

  @Get('leaderboard/volume/:sort')
  @ApiOperation({
    summary: 'Paginated pairs: day volume leaderboard (USD columns)',
    description:
      'Orders by `dayBaseVolumeUSD + dayQuoteVolumeUSD` (nulls treated as 0) in the requested direction.',
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
    description: '`SpotPairLeaderboardPageDto`',
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
  ): Promise<SpotPairLeaderboardPageDto> {
    const listed = parseListedQueryParam(listedRaw);
    const sort = parseSpotLeaderboardSortParam(sortRaw);
    return this.spot.listPairsLeaderboardVolume(offset, limit, listed, sort);
  }

  @Get('recently-created')
  @ApiOperation({
    summary: 'Paginated pairs: recently created',
    description:
      'Orders by `spot_pairs.listingDate` descending (tie-break `id` DESC). Default `listed=true` matches public catalog; pass `listed=false` for the unlisted / pending curation queue.',
  })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({
    name: 'listed',
    required: false,
    type: Boolean,
    description:
      'When true (default), only `listed === true` rows. When false, only `listed === false` (curation queue).',
    example: true,
  })
  @ApiOkResponse({
    description: '`SpotPairLeaderboardPageDto`',
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
  ): Promise<SpotPairLeaderboardPageDto> {
    const listed = parseListedQueryParam(listedRaw, true);
    return this.spot.listPairsRecentlyCreated(offset, limit, listed);
  }

  @Post('by-address/:address/listing')
  @HttpCode(200)
  @ApiOperation({
    summary: 'List or unlist a pair (pool)',
    description:
      'Sets `spot_pairs.listed` for catalog visibility. When listing (`listed: true`), also sets `listed: true` on existing `spot_tokens` rows for the pair’s `token0` and `token1` (missing rows are ignored). Unlisting the pair does not change tokens.',
  })
  @ApiParam({
    name: 'address',
    description: 'Pair (pool) contract address',
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
    description: 'Updated `SpotPairRecordDto`',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiNotFoundResponse({ description: 'No row for this address' })
  async setPairListing(
    @Param('address') address: string,
    @Body() body: SetSpotListedDto,
  ): Promise<SpotPairRecordDto> {
    if (typeof body?.listed !== 'boolean') {
      throw new BadRequestException('body.listed must be a boolean');
    }
    return this.spot.setPairListed(address, body.listed);
  }

  @Get('by-address/:address/cl-dynamic-fee')
  @ApiOperation({
    summary:
      'CL dynamic fee read model (curve wires, module globals, optional sender discount)',
    description:
      'Aggregated from `DynamicSwapFeeModule` broker tables. Does not call `getFee` on-chain; use an RPC for instantaneous fee at block time.',
  })
  @ApiParam({
    name: 'address',
    description: 'Pool contract address',
    example: '0x0000000000000000000000000000000000000000',
  })
  @ApiQuery({
    name: 'sender',
    required: false,
    description:
      'Optional wallet address (`tx.origin`) to include registered discount wire/bps',
    example: '0x0000000000000000000000000000000000000000',
  })
  @ApiOkResponse({
    description: '`ClDynamicFeeReadModelDto`',
    schema: { type: 'object', additionalProperties: true },
  })
  async getClDynamicFeeReadModel(
    @Param('address') address: string,
    @Query('sender') sender?: string,
  ): Promise<ClDynamicFeeReadModelDto> {
    if (typeof address !== 'string' || !address.trim()) {
      throw new BadRequestException('Path parameter `address` is required');
    }
    return this.dynamicSwapFeeReadModel.getClReadModel(address, sender);
  }

  @Get('by-address/:address')
  @ApiOperation({
    summary: 'Get spot pair by pool contract address',
    description:
      'Looks up `spot_pairs` by primary key (`id`). Address is normalized with trim + lowercase.',
  })
  @ApiParam({
    name: 'address',
    description: 'Pair (pool) contract address',
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
    description: 'Full `spot_pairs` row (`SpotPairRecordDto`)',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiNotFoundResponse({ description: 'No row for this address' })
  async getByAddress(
    @Param('address') address: string,
    @Query('listed') listedRaw?: string,
  ): Promise<SpotPairRecordDto> {
    if (typeof address !== 'string' || !address.trim()) {
      throw new BadRequestException('Path parameter `address` is required');
    }
    const listed = parseListedQueryParam(listedRaw);
    const row = await this.spot.findPairByAddress(address, listed);
    if (!row) {
      throw new NotFoundException('No spot_pairs row for this address');
    }
    return row;
  }

  @Get('by-symbol/:symbol')
  @ApiOperation({
    summary: 'List spot pairs by pair symbol',
    description:
      'Case-insensitive match on `spot_pairs.symbol` (e.g. TV-style `BASE/QUOTE`). Returns every matching row.',
  })
  @ApiParam({
    name: 'symbol',
    description: 'Pair symbol as stored on the row',
    example: 'WETH/USDC',
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
    description: '`{ items: SpotPairRecordDto[] }`',
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
  ): Promise<SpotPairsBySymbolResponseDto> {
    if (typeof symbol !== 'string' || !symbol.trim()) {
      throw new BadRequestException('Path parameter `symbol` is required');
    }
    const listed = parseListedQueryParam(listedRaw);
    const items = await this.spot.findPairsBySymbol(symbol, listed);
    if (items.length === 0) {
      throw new NotFoundException('No spot_pairs rows for this symbol');
    }
    return { items };
  }
}
