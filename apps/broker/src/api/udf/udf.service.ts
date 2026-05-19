// apps/broker/src/api/udf/udf.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  UdfConfigResponseDto,
  UdfHistoryResponseDto,
  UdfSearchResultItemDto,
  UdfSymbolInfoDto,
} from '@giwater/shared';
import { SpotPairEntity } from '../../models/pair/spot-pair.entity';
import { SpotPairTimeBucketEntity } from '../../models/pair/spot-pair-time-bucket.entity';
import { SpotTokenEntity } from '../../models/token/spot-token.entity';
import { SpotTokenTimeBucketEntity } from '../../models/token/spot-token-time-bucket.entity';

const SUPPORTED_RESOLUTIONS = ['5', '60', '1D', '1W', '1M'];

const TV_TO_BROKER_RES: Record<string, string> = {
  '5': '1m',
  '60': '1h',
  '1D': '1d',
  '1W': '1w',
  '1M': '1mo',
};

const PERIOD_SECONDS: Record<string, number> = {
  '5': 300,
  '60': 3600,
  '1D': 86400,
  '1W': 604800,
  '1M': 2592000,
};

function computePricescale(close: number): number {
  if (!close || close <= 0 || !Number.isFinite(close)) return 100;
  const raw = Math.pow(10, Math.ceil(Math.log10(1 / close)));
  return Math.min(1e8, Math.max(1, raw));
}

@Injectable()
export class UdfService {
  constructor(
    @InjectRepository(SpotPairEntity)
    private readonly pairs: Repository<SpotPairEntity>,
    @InjectRepository(SpotPairTimeBucketEntity)
    private readonly pairBuckets: Repository<SpotPairTimeBucketEntity>,
    @InjectRepository(SpotTokenEntity)
    private readonly tokens: Repository<SpotTokenEntity>,
    @InjectRepository(SpotTokenTimeBucketEntity)
    private readonly tokenBuckets: Repository<SpotTokenTimeBucketEntity>,
  ) {}

  getConfig(): UdfConfigResponseDto {
    return {
      supported_resolutions: SUPPORTED_RESOLUTIONS,
      exchanges: [{ value: 'GIWATER', name: 'GiWaTer DEX', desc: '' }],
      symbols_types: [
        { name: 'Pair', value: 'pair' },
        { name: 'Token', value: 'token' },
      ],
      supports_search: true,
      supports_group_request: false,
      supports_marks: false,
      supports_timescale_marks: false,
      supports_time: true,
    };
  }

  getTime(): number {
    return Math.floor(Date.now() / 1000);
  }

  async resolveSymbol(
    ticker: string,
  ): Promise<UdfSymbolInfoDto | { s: 'error'; errmsg: string }> {
    const colonIdx = ticker.indexOf(':');
    if (colonIdx === -1) return { s: 'error', errmsg: 'Invalid ticker format' };

    const prefix = ticker.slice(0, colonIdx).toUpperCase();
    const address = ticker.slice(colonIdx + 1).toLowerCase();

    if (prefix === 'PAIR') {
      const [pair, lastBucket] = await Promise.all([
        this.pairs.findOne({ where: { id: address } }),
        this.pairBuckets.findOne({
          where: { pair: address, resolution: '1d' },
          order: { bucketStartTs: 'DESC' },
        }),
      ]);
      if (!pair) return { s: 'error', errmsg: 'Symbol not found' };
      return {
        name: pair.symbol,
        ticker,
        description: `${pair.baseName} / ${pair.quoteName}`,
        type: 'pair',
        exchange: 'GIWATER',
        listed_exchange: 'GIWATER',
        timezone: 'Etc/UTC',
        session: '24x7',
        minmov: 1,
        pricescale: computePricescale(lastBucket?.close ?? 0),
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: true,
        supported_resolutions: SUPPORTED_RESOLUTIONS,
        volume_precision: 2,
        data_status: 'pulsed',
      };
    }

    if (prefix === 'TOKEN') {
      const [token, lastBucket] = await Promise.all([
        this.tokens.findOne({ where: { id: address } }),
        this.tokenBuckets.findOne({
          where: { token: address, resolution: '1d' },
          order: { bucketStartTs: 'DESC' },
        }),
      ]);
      if (!token) return { s: 'error', errmsg: 'Symbol not found' };
      return {
        name: token.symbol,
        ticker,
        description: token.name?.trim() || token.symbol,
        type: 'token',
        exchange: 'GIWATER',
        listed_exchange: 'GIWATER',
        timezone: 'Etc/UTC',
        session: '24x7',
        minmov: 1,
        pricescale: computePricescale(lastBucket?.close ?? 0),
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: true,
        supported_resolutions: SUPPORTED_RESOLUTIONS,
        volume_precision: 2,
        data_status: 'pulsed',
      };
    }

    return { s: 'error', errmsg: 'Invalid ticker format' };
  }

  async search(
    query: string,
    type: string,
    limit: number,
  ): Promise<UdfSearchResultItemDto[]> {
    const q = query.trim();
    const safeLimit = Math.min(100, Math.max(1, limit || 30));

    if (type === 'pair') {
      const qb = this.pairs.createQueryBuilder('p').where('COALESCE(p.listed, false) = true');
      if (q) {
        qb.andWhere(
          '(p.symbol ILIKE :q OR p."baseName" ILIKE :q OR p."quoteName" ILIKE :q)',
          { q: `%${q}%` },
        );
      }
      const rows = await qb.take(safeLimit).getMany();
      return rows.map((p) => ({
        symbol: p.symbol,
        full_name: `GIWATER:${p.symbol}`,
        description: `${p.baseName} / ${p.quoteName}`,
        exchange: 'GIWATER',
        ticker: `PAIR:${p.id}`,
        type: 'pair' as const,
      }));
    }

    if (type === 'token') {
      const qb = this.tokens.createQueryBuilder('t').where('COALESCE(t.listed, false) = true');
      if (q) {
        qb.andWhere('(t.symbol ILIKE :q OR t.name ILIKE :q)', {
          q: `%${q}%`,
        });
      }
      const rows = await qb.take(safeLimit).getMany();
      return rows.map((t) => ({
        symbol: t.symbol,
        full_name: `GIWATER:${t.symbol}`,
        description: t.name?.trim() || t.symbol,
        exchange: 'GIWATER',
        ticker: `TOKEN:${t.id}`,
        type: 'token' as const,
      }));
    }

    return [];
  }

  async getHistory(
    ticker: string,
    resolution: string,
    from: number,
    to: number,
    countback?: number,
  ): Promise<UdfHistoryResponseDto> {
    const brokerRes = TV_TO_BROKER_RES[resolution];
    if (!brokerRes) return { s: 'error', errmsg: 'Unsupported resolution' };

    const colonIdx = ticker.indexOf(':');
    if (colonIdx === -1) return { s: 'error', errmsg: 'Invalid ticker format' };

    const prefix = ticker.slice(0, colonIdx).toUpperCase();
    const address = ticker.slice(colonIdx + 1).toLowerCase();

    let effectiveFrom = from;
    if (countback != null && countback > 0) {
      effectiveFrom = to - countback * (PERIOD_SECONDS[resolution] ?? 300);
    }

    if (prefix === 'PAIR') {
      const useCountback = countback != null && countback > 0;
      const pairQb = this.pairBuckets
        .createQueryBuilder('b')
        .where('b.pair = :addr', { addr: address })
        .andWhere('b.resolution = :res', { res: brokerRes })
        .andWhere('b.bucketStartTs >= :from', { from: effectiveFrom })
        .andWhere('b.bucketStartTs <= :to', { to })
        .orderBy('b.bucketStartTs', useCountback ? 'DESC' : 'ASC');

      if (useCountback) {
        pairQb.take(countback);
      }

      const pairRows = useCountback
        ? (await pairQb.getMany()).reverse()
        : await pairQb.getMany();

      if (pairRows.length === 0) return { s: 'no_data' };
      return {
        s: 'ok',
        t: pairRows.map((r) => r.bucketStartTs),
        o: pairRows.map((r) => r.open),
        h: pairRows.map((r) => r.high),
        l: pairRows.map((r) => r.low),
        c: pairRows.map((r) => r.close),
        v: pairRows.map((r) => r.baseVolumeUSD),
      };
    }

    if (prefix === 'TOKEN') {
      const useCountbackToken = countback != null && countback > 0;
      const tokenQb = this.tokenBuckets
        .createQueryBuilder('b')
        .where('b.token = :addr', { addr: address })
        .andWhere('b.resolution = :res', { res: brokerRes })
        .andWhere('b.bucketStartTs >= :from', { from: effectiveFrom })
        .andWhere('b.bucketStartTs <= :to', { to })
        .orderBy('b.bucketStartTs', useCountbackToken ? 'DESC' : 'ASC');

      if (useCountbackToken) {
        tokenQb.take(countback);
      }

      const tokenRows = useCountbackToken
        ? (await tokenQb.getMany()).reverse()
        : await tokenQb.getMany();

      if (tokenRows.length === 0) return { s: 'no_data' };
      return {
        s: 'ok',
        t: tokenRows.map((r) => r.bucketStartTs),
        o: tokenRows.map((r) => r.open),
        h: tokenRows.map((r) => r.high),
        l: tokenRows.map((r) => r.low),
        c: tokenRows.map((r) => r.close),
        v: tokenRows.map((r) => r.volumeUSD),
      };
    }

    return { s: 'error', errmsg: 'Invalid ticker format' };
  }
}
