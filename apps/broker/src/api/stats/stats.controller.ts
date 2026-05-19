import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { GlobalStats } from '@giwater/shared';
import { SpotPairEntity } from '../../models/pair/spot-pair.entity';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(
    @InjectRepository(SpotPairEntity)
    private readonly pairRepo: Repository<SpotPairEntity>,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Global protocol stats',
    description:
      'Aggregates `spot_pairs` for total TVL, 24h volume, 24h fees, and listed pool count. ' +
      '7d aggregates are returned as "0" until 7-day rollup columns exist on `spot_pairs`.',
  })
  async getGlobalStats(): Promise<GlobalStats> {
    const row = await this.pairRepo
      .createQueryBuilder('p')
      .select(
        'COALESCE(SUM(COALESCE(p.dayBaseTvlUSD, 0) + COALESCE(p.dayQuoteTvlUSD, 0)), 0)',
        'totalTvl',
      )
      .addSelect(
        'COALESCE(SUM(COALESCE(p.dayBaseVolumeUSD, 0) + COALESCE(p.dayQuoteVolumeUSD, 0)), 0)',
        'totalVolume24h',
      )
      .addSelect(
        'COALESCE(SUM(COALESCE(p.daySwapFeesUsd, 0)), 0)',
        'totalFees24h',
      )
      .addSelect('COUNT(*) FILTER (WHERE p.listed = true)', 'poolCount')
      .getRawOne<{
        totalTvl: string | number | null;
        totalVolume24h: string | number | null;
        totalFees24h: string | number | null;
        poolCount: string | number | null;
      }>();

    return {
      totalTVL: String(row?.totalTvl ?? 0),
      totalVolume24h: String(row?.totalVolume24h ?? 0),
      totalVolume7d: '0',
      totalFees24h: String(row?.totalFees24h ?? 0),
      totalFees7d: '0',
      poolCount: Number(row?.poolCount ?? 0),
      updatedAt: new Date().toISOString(),
    };
  }
}
