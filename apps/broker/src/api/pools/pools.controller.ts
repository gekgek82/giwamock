import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  LiquidityBar,
  LiquidityDistributionResponse,
  PoolStats,
  PoolsStatsResponse,
} from '@giwater/shared';
import { SpotPairEntity } from '../../models/pair/spot-pair.entity';
import { LiquidityHistogramBucketEntity } from '../../models/tick/liquidity-histogram-bucket.entity';

type PoolSortBy = 'tvl' | 'volume24h' | 'fees24h' | 'apr';
type SortOrder = 'asc' | 'desc';

function mapPairToPoolStats(row: SpotPairEntity): PoolStats {
  const baseIsToken0 =
    row.base.trim().toLowerCase() === row.token0.trim().toLowerCase();
  const token0Symbol = baseIsToken0 ? row.baseSymbol : row.quoteSymbol;
  const token1Symbol = baseIsToken0 ? row.quoteSymbol : row.baseSymbol;
  const token0Name = baseIsToken0 ? row.baseName : row.quoteName;
  const token1Name = baseIsToken0 ? row.quoteName : row.baseName;
  const token0Decimals = baseIsToken0 ? row.bDecimal : row.qDecimal;
  const token1Decimals = baseIsToken0 ? row.qDecimal : row.bDecimal;

  const tvl = (row.dayBaseTvlUSD ?? 0) + (row.dayQuoteTvlUSD ?? 0);
  const volume24h = (row.dayBaseVolumeUSD ?? 0) + (row.dayQuoteVolumeUSD ?? 0);

  return {
    poolAddress: row.id,
    token0Address: row.token0,
    token1Address: row.token1,
    token0Symbol,
    token1Symbol,
    token0Decimals,
    token1Decimals,
    token0Name,
    token1Name,
    isStable: false,
    poolType: row.isConcentratedLiquidity ? 'cl' : 'basic',
    tickSpacing: null,
    tvl: String(tvl),
    reserve0: String(row.baseLiquidity ?? 0),
    reserve1: String(row.quoteLiquidity ?? 0),
    reserve0Usd: String(row.dayBaseTvlUSD ?? 0),
    reserve1Usd: String(row.dayQuoteTvlUSD ?? 0),
    volume24h: String(volume24h),
    volume7d: '0',
    fees24h: String(row.daySwapFeesUsd ?? 0),
    fees7d: '0',
    feesTotal: String(row.totalSwapFeesUsd ?? 0),
    txCount24h: 0,
    apr24h: '0',
    apr7d: '0',
    feeBps: row.effectiveFeeBps ?? undefined,
    feePercent:
      row.effectiveFeeBps != null ? String(row.effectiveFeeBps / 100) : undefined,
    gaugeAddress: null,
    hasGauge: false,
    isGaugeAlive: false,
    emissionApr: null,
    annualEmissionUsd: null,
    grade: 0,
    updatedAt: new Date().toISOString(),
  };
}

function parseSortBy(raw: string | undefined): PoolSortBy {
  const v = (raw ?? 'tvl').trim().toLowerCase();
  if (v === 'tvl' || v === 'volume24h' || v === 'fees24h' || v === 'apr') {
    return v;
  }
  return 'tvl';
}

function parseSortOrder(raw: string | undefined): SortOrder {
  const v = (raw ?? 'desc').trim().toLowerCase();
  return v === 'asc' ? 'asc' : 'desc';
}

/**
 * Raw-SQL sort key for a pool by metric.
 * Uses DB column names because these strings are evaluated as raw SQL (see CLAUDE.md).
 * Note: `baseTvl` / `quoteTvl` are entity-renamed columns (`baseLiquidity` / `quoteLiquidity`).
 */
function sortKeyExpression(sortBy: PoolSortBy): string {
  switch (sortBy) {
    case 'tvl':
      return 'COALESCE(p.dayBaseTvlUSD, 0) + COALESCE(p.dayQuoteTvlUSD, 0)';
    case 'volume24h':
      return 'COALESCE(p.dayBaseVolumeUSD, 0) + COALESCE(p.dayQuoteVolumeUSD, 0)';
    case 'fees24h':
      return 'COALESCE(p.daySwapFeesUsd, 0)';
    case 'apr':
      // No APR column yet — proxy by 24h volume.
      return 'COALESCE(p.dayBaseVolumeUSD, 0) + COALESCE(p.dayQuoteVolumeUSD, 0)';
  }
}

@ApiTags('pools')
@Controller('pools')
export class PoolsController {
  constructor(
    @InjectRepository(SpotPairEntity)
    private readonly pairRepo: Repository<SpotPairEntity>,
    @InjectRepository(LiquidityHistogramBucketEntity)
    private readonly histogramRepo: Repository<LiquidityHistogramBucketEntity>,
  ) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Paginated pool stats',
    description:
      'Lists `spot_pairs` rows with `listed = true`, mapped to `PoolStats`. ' +
      'Pre-TGE: `volume7d`, `fees7d`, `apr24h`, `apr7d`, gauge fields, and `grade` are placeholders.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['tvl', 'volume24h', 'fees24h', 'apr'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async listPoolsStats(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('sortBy') sortByRaw?: string,
    @Query('sortOrder') sortOrderRaw?: string,
  ): Promise<PoolsStatsResponse> {
    const sortBy = parseSortBy(sortByRaw);
    const sortOrder = parseSortOrder(sortOrderRaw);
    const ord: 'ASC' | 'DESC' = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const clampedLimit = Math.min(200, Math.max(1, Math.floor(limit)));
    const clampedOffset = Math.max(0, Math.floor(offset));

    const sortExpr = sortKeyExpression(sortBy);

    const qb = this.pairRepo
      .createQueryBuilder('p')
      .where('p.listed = :listed', { listed: true })
      .addSelect(sortExpr, 'pool_sort_key')
      .orderBy('pool_sort_key', ord)
      .addOrderBy('p.id', 'ASC');

    const total = await qb.getCount();
    const rows = await qb.clone().skip(clampedOffset).take(clampedLimit).getMany();

    return {
      pools: rows.map((r) => mapPairToPoolStats(r)),
      pagination: {
        total,
        limit: clampedLimit,
        offset: clampedOffset,
      },
    };
  }

  @Get(':address/stats')
  @ApiOperation({ summary: 'Single pool stats' })
  @ApiParam({ name: 'address', description: 'Pool contract address' })
  async getPoolStats(@Param('address') address: string): Promise<PoolStats> {
    if (!address?.trim()) {
      throw new BadRequestException('Path parameter `address` is required');
    }
    const id = address.trim().toLowerCase();
    const row = await this.pairRepo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('No spot_pairs row for this address');
    }
    return mapPairToPoolStats(row);
  }

  @Get(':address/liquidity-distribution')
  @ApiOperation({
    summary: 'Liquidity histogram (tick buckets) for a CL pool',
    description:
      'Returns `tick`-type histogram buckets from `liquidity_histogram_buckets` for the pool, ordered ascending by `bucketStartTick`. `currentTick` is 0 until `spot_pairs` exposes a current-tick column.',
  })
  @ApiParam({ name: 'address', description: 'Pool contract address' })
  async getLiquidityDistribution(
    @Param('address') address: string,
  ): Promise<LiquidityDistributionResponse> {
    if (!address?.trim()) {
      throw new BadRequestException('Path parameter `address` is required');
    }
    const id = address.trim().toLowerCase();
    const pair = await this.pairRepo.findOne({ where: { id } });
    if (!pair) {
      throw new NotFoundException('No spot_pairs row for this address');
    }

    const buckets = await this.histogramRepo
      .createQueryBuilder('b')
      .where('b.poolId = :id', { id })
      .andWhere("b.bucketType = :bucketType", { bucketType: 'tick' })
      .orderBy('b.bucketStartTick', 'ASC')
      .getMany();

    const bars: LiquidityBar[] = buckets.map((b) => ({
      tickLower: b.bucketStartTick,
      tickUpper: b.bucketEndTick,
      liquidity: b.liquidityAmount,
      price: b.priceLower,
    }));

    return {
      currentTick: 0,
      currentPrice: pair.price ?? 0,
      tickSpacing: 1,
      bars,
    };
  }
}
