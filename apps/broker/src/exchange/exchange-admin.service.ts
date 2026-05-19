import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AdminExchangeTimeBucketsResponse } from '@giwater/shared';
import { Repository } from 'typeorm';
import { SpotExchangeTimeBucketEntity } from '../models/exchange/spot-exchange-time-bucket.entity';
import { SWAP_BUCKET_RESOLUTIONS } from '../swap-ohlcv/swap-bucket-resolution';

function normalizeRes(raw: string): string {
  const r = (raw || '').trim();
  return r;
}

@Injectable()
export class ExchangeAdminService {
  constructor(
    @InjectRepository(SpotExchangeTimeBucketEntity)
    private readonly exchangeBucketRepo: Repository<SpotExchangeTimeBucketEntity>,
  ) {}

  async listExchangeTimeBuckets(args: {
    protocolId: string;
    resolution: string;
    limit: number;
  }): Promise<AdminExchangeTimeBucketsResponse> {
    const protocolId = (args.protocolId || '').trim();
    if (!protocolId) throw new BadRequestException('protocolId is required');
    const resolution = normalizeRes(args.resolution);
    if (!resolution) throw new BadRequestException('resolution is required');

    // We store exchange rollups only for day/week/month at the moment.
    // Accept common aliases but validate against the known resolution list.
    const allowed = new Set(SWAP_BUCKET_RESOLUTIONS);
    const resolutionNorm =
      resolution === '1mo' ? '1mo' : resolution === '1M' ? '1mo' : resolution;
    if (!allowed.has(resolutionNorm as any)) {
      throw new BadRequestException(`Unsupported resolution=${resolution}`);
    }

    const limit = Math.max(1, Math.min(2000, Math.floor(args.limit || 200)));

    // Exchange buckets use composite PK (index, protocolId, timestamp).
    // `index` is derived from resolution (same as swap bucket streams).
    // We filter by protocolId and take latest by timestamp.
    const rows = await this.exchangeBucketRepo.find({
      where: { protocolId, index: this.streamIndexForResolution(resolutionNorm) },
      order: { timestamp: 'DESC' },
      take: limit,
    });
    const asc = rows.slice().sort((a, b) => a.timestamp - b.timestamp);
    return {
      protocolId,
      resolution: resolutionNorm,
      items: asc.map((r) => ({
        protocolId: r.protocolId,
        resolution: resolutionNorm,
        timestamp: r.timestamp,
        networkName: r.networkName,
        totalVolume: r.totalVolume,
        totalFeesUsd: (r as any).totalFeesUsd ?? 0,
        tvl: r.tvl,
        totalGlobalTrades: r.totalGlobalTrades,
        totalGlobalPairs: r.totalGlobalPairs,
        totalGlobalTraders: r.totalGlobalTraders,
      })),
    };
  }

  private streamIndexForResolution(resolution: string): number {
    // Keep consistent with swap bucket resolution ordering.
    // SWAP_BUCKET_RESOLUTIONS: ['5m','1h','1d','1w','1mo']
    const i = SWAP_BUCKET_RESOLUTIONS.indexOf(resolution as any);
    return i >= 0 ? i + 1 : 1;
  }
}

