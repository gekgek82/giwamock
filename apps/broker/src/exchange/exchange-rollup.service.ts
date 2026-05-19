import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpotExchangeEntity } from '../models/exchange/spot-exchange.entity';
import { SpotExchangeTimeBucketEntity } from '../models/exchange/spot-exchange-time-bucket.entity';
import {
  alignBucketStart,
  SWAP_BUCKET_RESOLUTIONS,
  type SwapBucketResolution,
} from '../swap-ohlcv/swap-bucket-resolution';

/** Matches `spot_pairs.exchange` for GiwaTer pools. */
export const BROKER_SPOT_EXCHANGE_ID = 'giwater';

/** Exchange-wide rows use day/week/month streams only (avoids 5× trade counts). */
const EXCHANGE_ROLLUP_RESOLUTIONS: SwapBucketResolution[] = ['1d', '1w', '1mo'];

function bucketStreamIndex(res: SwapBucketResolution): number {
  const i = SWAP_BUCKET_RESOLUTIONS.indexOf(res);
  return i >= 0 ? i + 1 : 1;
}

function resolutionFromStreamIndex(index: number): SwapBucketResolution | null {
  const i = index - 1;
  if (i < 0 || i >= SWAP_BUCKET_RESOLUTIONS.length) return null;
  return SWAP_BUCKET_RESOLUTIONS[i]!;
}

/**
 * Rolls up protocol-wide stats into `spot_exchange_time_buckets` and keeps `spot_exchanges` row present.
 * Used by swap + liquidity aggregators (`BROKER_SPOT_EXCHANGE_ID`).
 */
@Injectable()
export class ExchangeRollupService {
  private readonly logger = new Logger(ExchangeRollupService.name);

  constructor(
    @InjectRepository(SpotExchangeTimeBucketEntity)
    private readonly bucketRepo: Repository<SpotExchangeTimeBucketEntity>,
    @InjectRepository(SpotExchangeEntity)
    private readonly exchangeRepo: Repository<SpotExchangeEntity>,
  ) {}

  private async ensureExchangeRow(protocolId: string): Promise<void> {
    await this.exchangeRepo.upsert(
      {
        id: protocolId,
        networkName: '',
        bytecode: '',
        deployer: '',
        totalDayBuckets: 0,
        totalWeekBuckets: 0,
        totalMonthBuckets: 0,
      },
      ['id'],
    );
  }

  private async bumpMetaBucketCount(
    protocolId: string,
    streamIndex: number,
    created: boolean,
  ): Promise<void> {
    if (!created) return;
    const res = resolutionFromStreamIndex(streamIndex);
    if (!res) return;
    await this.ensureExchangeRow(protocolId);
    const ex = await this.exchangeRepo.findOne({ where: { id: protocolId } });
    if (!ex) return;
    if (res === '1d') {
      ex.totalDayBuckets = (ex.totalDayBuckets ?? 0) + 1;
    } else if (res === '1w') {
      ex.totalWeekBuckets = (ex.totalWeekBuckets ?? 0) + 1;
    } else if (res === '1mo') {
      ex.totalMonthBuckets = (ex.totalMonthBuckets ?? 0) + 1;
    }
    await this.exchangeRepo.save(ex);
  }

  private async bumpBucket(args: {
    protocolId: string;
    resolution: SwapBucketResolution;
    blockTs: number;
    dVolumeUsd: number;
    dFeesUsd: number;
    dTvlUsd: number;
    dTrades: number;
    dPairs: number;
  }): Promise<void> {
    const {
      protocolId,
      resolution,
      blockTs,
      dVolumeUsd,
      dFeesUsd,
      dTvlUsd,
      dTrades,
      dPairs,
    } = args;
    const index = bucketStreamIndex(resolution);
    const timestamp = alignBucketStart(blockTs, resolution);

    let row = await this.bucketRepo.findOne({
      where: { index, protocolId, timestamp },
    });
    const created = !row;
    if (!row) {
      row = this.bucketRepo.create({
        index,
        protocolId,
        timestamp,
        networkName: '',
        totalVolume: 0,
        totalFeesUsd: 0,
        tvl: 0,
        totalGlobalTrades: 0,
        totalGlobalPairs: 0,
        totalGlobalTraders: 0,
      });
    }
    if (Number.isFinite(dVolumeUsd) && dVolumeUsd !== 0) {
      row.totalVolume += dVolumeUsd;
    }
    if (Number.isFinite(dFeesUsd) && dFeesUsd !== 0) {
      row.totalFeesUsd += dFeesUsd;
    }
    if (Number.isFinite(dTvlUsd) && dTvlUsd !== 0) {
      row.tvl += dTvlUsd;
    }
    if (Number.isFinite(dTrades) && dTrades !== 0) {
      row.totalGlobalTrades += dTrades;
    }
    if (Number.isFinite(dPairs) && dPairs !== 0) {
      row.totalGlobalPairs += dPairs;
    }
    await this.bucketRepo.save(row);
    await this.bumpMetaBucketCount(protocolId, index, created);
  }

  /**
   * Adds swap volume (USD estimate) and trade count across all OHLCV-aligned resolutions.
   */
  async recordSwapVolumeAndTrade(args: {
    protocolId?: string;
    blockTs: number;
    volumeUsd: number;
    feeUsd?: number;
  }): Promise<void> {
    const protocolId = args.protocolId ?? BROKER_SPOT_EXCHANGE_ID;
    const vol = Number.isFinite(args.volumeUsd) ? Math.max(0, args.volumeUsd) : 0;
    const fee = Number.isFinite(args.feeUsd) ? Math.max(0, args.feeUsd as number) : 0;
    try {
      await this.ensureExchangeRow(protocolId);
      for (const res of EXCHANGE_ROLLUP_RESOLUTIONS) {
        await this.bumpBucket({
          protocolId,
          resolution: res,
          blockTs: args.blockTs,
          dVolumeUsd: vol,
          dFeesUsd: fee,
          dTvlUsd: 0,
          dTrades: res === '1d' ? 1 : 0,
          dPairs: 0,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Exchange swap rollup failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Adds TVL (USD) across all resolutions (same bucket alignment as swaps).
   */
  async recordLiquidityTvlUsd(args: {
    protocolId?: string;
    blockTs: number;
    tvlUsdDelta: number;
  }): Promise<void> {
    const protocolId = args.protocolId ?? BROKER_SPOT_EXCHANGE_ID;
    const d = Number.isFinite(args.tvlUsdDelta) ? Math.max(0, args.tvlUsdDelta) : 0;
    if (d === 0) return;
    try {
      await this.ensureExchangeRow(protocolId);
      for (const res of EXCHANGE_ROLLUP_RESOLUTIONS) {
        await this.bumpBucket({
          protocolId,
          resolution: res,
          blockTs: args.blockTs,
          dVolumeUsd: 0,
          dFeesUsd: 0,
          dTvlUsd: d,
          dTrades: 0,
          dPairs: 0,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Exchange liquidity rollup failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Counts a new pool/pair for exchange-wide `totalGlobalPairs` (per resolution bucket).
   */
  async recordNewPair(args: { protocolId?: string; blockTs: number }): Promise<void> {
    const protocolId = args.protocolId ?? BROKER_SPOT_EXCHANGE_ID;
    try {
      await this.ensureExchangeRow(protocolId);
      for (const res of EXCHANGE_ROLLUP_RESOLUTIONS) {
        await this.bumpBucket({
          protocolId,
          resolution: res,
          blockTs: args.blockTs,
          dVolumeUsd: 0,
          dFeesUsd: 0,
          dTvlUsd: 0,
          dTrades: 0,
          dPairs: res === '1d' ? 1 : 0,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Exchange new-pair rollup failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Cron: ensure current UTC-aligned buckets exist even with zero swaps.
   * Creates empty buckets for 1d/1w/1mo so charts don't show gaps.
   */
  async ensureWallClockBuckets(args?: { protocolId?: string; nowSec?: number }): Promise<void> {
    const protocolId = args?.protocolId ?? BROKER_SPOT_EXCHANGE_ID;
    const nowSec = args?.nowSec ?? Math.floor(Date.now() / 1000);
    try {
      await this.ensureExchangeRow(protocolId);
      for (const res of EXCHANGE_ROLLUP_RESOLUTIONS) {
        await this.bumpBucket({
          protocolId,
          resolution: res,
          blockTs: nowSec,
          dVolumeUsd: 0,
          dFeesUsd: 0,
          dTvlUsd: 0,
          dTrades: 0,
          dPairs: 0,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Exchange wall-clock rollup failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
