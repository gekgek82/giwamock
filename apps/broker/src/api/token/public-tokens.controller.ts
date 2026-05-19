import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  RegisterTokenResponse,
  TokenInfo,
  TokenPrice,
  TokenPricesResponse,
  TokenSearchResponse,
} from '@giwater/shared';
import { SpotTokenEntity } from '../../models/token/spot-token.entity';

function tokenToInfo(row: SpotTokenEntity): TokenInfo {
  return {
    address: row.id,
    symbol: row.symbol,
    name: row.name,
    decimals: row.decimals,
    iconUrl: row.logoURI && row.logoURI.length > 0 ? row.logoURI : null,
    isWhitelisted: row.listed,
  };
}

function tokenToPrice(row: SpotTokenEntity): TokenPrice {
  return {
    address: row.id,
    symbol: row.symbol,
    priceUSD: String(row.priceUSD ?? 0),
    updatedAt: new Date().toISOString(),
  };
}

@ApiTags('tokens')
@Controller('tokens')
export class PublicTokensController {
  constructor(
    @InjectRepository(SpotTokenEntity)
    private readonly tokenRepo: Repository<SpotTokenEntity>,
  ) {}

  // ── Literal-path routes MUST come before `:address` routes ──

  @Get('prices')
  @ApiOperation({
    summary: 'USD prices for every listed token',
    description: 'Returns one entry per `spot_tokens` row with `listed = true`.',
  })
  async getAllPrices(): Promise<TokenPricesResponse> {
    const rows = await this.tokenRepo
      .createQueryBuilder('t')
      .where('t.listed = :listed', { listed: true })
      .orderBy('t.id', 'ASC')
      .getMany();
    return {
      tokens: rows.map((r) => tokenToPrice(r)),
    };
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search listed tokens by symbol or name',
    description: 'Case-insensitive `ILIKE %q%` on `symbol` or `name`. Limit 20.',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  async search(@Query('q') q?: string): Promise<TokenSearchResponse> {
    const query = (q ?? '').trim();
    if (!query) {
      return { tokens: [], total: 0 };
    }
    const qb = this.tokenRepo
      .createQueryBuilder('t')
      .where('t.listed = :listed', { listed: true });

    if (/^0x[a-fA-F0-9]{40}$/i.test(query)) {
      qb.andWhere('t.id = :addr', { addr: query.toLowerCase() });
    } else {
      qb.andWhere('(t.symbol ILIKE :q OR t.name ILIKE :q)', { q: `%${query}%` });
    }

    const rows = await qb.orderBy('t.symbol', 'ASC').limit(20).getMany();
    const tokens = rows.map((r) => tokenToInfo(r));
    return { tokens, total: tokens.length };
  }

  @Post('register')
  @ApiOperation({
    summary: 'Register a token by address',
    description:
      'Looks up the token in `spot_tokens`. Pre-TGE: tokens must already be indexed by `amm-indexer` — this endpoint never creates rows.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['address'],
      properties: { address: { type: 'string' } },
    },
  })
  async register(
    @Body() body: { address?: unknown },
  ): Promise<RegisterTokenResponse> {
    const address = typeof body?.address === 'string' ? body.address.trim() : '';
    if (!address) {
      throw new BadRequestException('body.address must be a non-empty string');
    }
    const id = address.toLowerCase();
    const row = await this.tokenRepo.findOne({ where: { id } });
    if (!row) {
      return {
        success: false,
        error: 'Token not found in catalog. Index it first via amm-indexer.',
      };
    }
    return {
      success: true,
      token: tokenToInfo(row),
    };
  }

  // ── Param routes ──

  @Get(':address/price')
  @ApiOperation({ summary: 'USD price for a single token' })
  @ApiParam({ name: 'address', description: 'Token contract address' })
  async getPrice(@Param('address') address: string): Promise<TokenPrice> {
    if (!address?.trim()) {
      throw new BadRequestException('Path parameter `address` is required');
    }
    const id = address.trim().toLowerCase();
    const row = await this.tokenRepo.findOne({ where: { id } });
    if (!row || !row.listed) {
      throw new NotFoundException('No spot_tokens row for this address');
    }
    return tokenToPrice(row);
  }
}
