import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  AdminPoolTimeBucketsResponse,
  AdminPoolDetailInfo,
  AdminPoolInfo,
  PoolListResponse,
  UpdatePoolGradeRequest,
} from '@giwater/shared';
import { Repository } from 'typeorm';
import { SpotPairAdminMetaEntity } from '../models/pair/spot-pair-admin-meta.entity';
import { SpotPairEntity } from '../models/pair/spot-pair.entity';
import { SpotPairTimeBucketEntity } from '../models/pair/spot-pair-time-bucket.entity';

function lcAddr(s: string): string {
  return s.trim().toLowerCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Columns needed for {@link pairToAdminInfo} (incl. swap fee USD counters on `spot_pairs`).
 */
const SPOT_PAIR_ADMIN_SELECT: (keyof SpotPairEntity)[] = [
  'id',
  'token0',
  'token1',
  'base',
  'quote',
  'baseSymbol',
  'baseName',
  'quoteSymbol',
  'quoteName',
  'bDecimal',
  'qDecimal',
  'symbol',
  'ticker',
  'description',
  'type',
  'exchange',
  'isConcentratedLiquidity',
  'dynamicFee',
  'effectiveFeeBps',
  'feeSource',
  'listed',
  'gaugeWhitelisted',
  'price',
  'dayOpen',
  'dayHigh',
  'dayLow',
  'scales',
  'sparkline7D',
  'ath',
  'atl',
  'listingDate',
  'metricsDayStartTs',
  'dayPriceDifference',
  'dayPriceDifferencePercentage',
  'baseLiquidity',
  'quoteLiquidity',
  'dayBaseTvl',
  'dayQuoteTvl',
  'dayBaseVolume',
  'dayQuoteVolume',
  'dayBaseTvlUSD',
  'dayQuoteTvlUSD',
  'dayBaseVolumeUSD',
  'dayQuoteVolumeUSD',
  'totalSwapFeesUsd',
  'daySwapFeesUsd',
  'totalMinBuckets',
  'totalHourBuckets',
  'totalDayBuckets',
  'totalWeekBuckets',
  'totalMonthBuckets',
];

/** Per-slot token display/decimals from spot_pairs `base`/`quote` vs on-chain `token0`/`token1`. */
function spotPairSlotTokenFields(row: SpotPairEntity): {
  token0Symbol: string;
  token1Symbol: string;
  token0Name: string | null;
  token1Name: string | null;
  token0Decimals: number;
  token1Decimals: number;
} {
  const t0 = lcAddr(row.token0 || '');
  const t1 = lcAddr(row.token1 || '');
  const b = lcAddr(row.base || '');
  const q = lcAddr(row.quote || '');

  const symbolForAddr = (addr: string): string => {
    if (!addr) return '';
    if (b && addr === b) return (row.baseSymbol ?? '').trim();
    if (q && addr === q) return (row.quoteSymbol ?? '').trim();
    return '';
  };
  const nameForAddr = (addr: string): string | null => {
    if (!addr) return null;
    if (b && addr === b) {
      const n = (row.baseName ?? '').trim();
      return n || null;
    }
    if (q && addr === q) {
      const n = (row.quoteName ?? '').trim();
      return n || null;
    }
    return null;
  };
  const decimalsForAddr = (addr: string): number => {
    if (!addr) return 0;
    if (b && addr === b) return Number(row.bDecimal) || 0;
    if (q && addr === q) return Number(row.qDecimal) || 0;
    return 0;
  };

  return {
    token0Symbol: t0 ? symbolForAddr(t0) : '',
    token1Symbol: t1 ? symbolForAddr(t1) : '',
    token0Name: t0 ? nameForAddr(t0) : null,
    token1Name: t1 ? nameForAddr(t1) : null,
    token0Decimals: t0 ? decimalsForAddr(t0) : 0,
    token1Decimals: t1 ? decimalsForAddr(t1) : 0,
  };
}

@Injectable()
export class PoolAdminService {
  private readonly logger = new Logger(PoolAdminService.name);

  constructor(
    @InjectRepository(SpotPairEntity)
    private readonly pairRepo: Repository<SpotPairEntity>,
    @InjectRepository(SpotPairAdminMetaEntity)
    private readonly metaRepo: Repository<SpotPairAdminMetaEntity>,
    @InjectRepository(SpotPairTimeBucketEntity)
    private readonly pairBucketRepo: Repository<SpotPairTimeBucketEntity>,
  ) {}

  private qbSelectAdminPairColumns(
    qb: ReturnType<Repository<SpotPairEntity>['createQueryBuilder']>,
    keys: readonly (keyof SpotPairEntity)[],
  ): ReturnType<Repository<SpotPairEntity>['createQueryBuilder']> {
    return qb.select(keys.map((c) => `p.${String(c)}`));
  }

  private async listPairsForAdminQuery(): Promise<SpotPairEntity[]> {
    const baseQb = () =>
      this.pairRepo
        .createQueryBuilder('p')
        .orderBy('p.listed', 'DESC')
        .addOrderBy('p.listingDate', 'DESC')
        .addOrderBy('p.id', 'ASC');
    return this.qbSelectAdminPairColumns(baseQb(), SPOT_PAIR_ADMIN_SELECT).getMany();
  }

  private async findOnePairForAdmin(id: string): Promise<SpotPairEntity | null> {
    return this.pairRepo.findOne({
      where: { id },
      select: SPOT_PAIR_ADMIN_SELECT,
    });
  }

  private pairToAdminInfo(pair: SpotPairEntity, meta: SpotPairAdminMetaEntity | null): AdminPoolInfo {
    const iso = nowIso();
    const slot = spotPairSlotTokenFields(pair);
    const listingDateSec = Number(pair.listingDate) || 0;
    const ts =
      listingDateSec > 0 ? new Date(listingDateSec * 1000).toISOString() : iso;

    const bn = (pair.baseName ?? '').trim();
    const qn = (pair.quoteName ?? '').trim();

    return {
      address: lcAddr(pair.id),
      token0Address: lcAddr(pair.token0 || ''),
      token1Address: lcAddr(pair.token1 || ''),
      token0Symbol: slot.token0Symbol,
      token1Symbol: slot.token1Symbol,
      token0Decimals: slot.token0Decimals,
      token1Decimals: slot.token1Decimals,
      token0Name: slot.token0Name,
      token1Name: slot.token1Name,

      baseAddress: lcAddr(pair.base || ''),
      quoteAddress: lcAddr(pair.quote || ''),
      baseSymbol: (pair.baseSymbol ?? '').trim(),
      quoteSymbol: (pair.quoteSymbol ?? '').trim(),
      baseName: bn || null,
      quoteName: qn || null,
      bDecimal: Number(pair.bDecimal) || 0,
      qDecimal: Number(pair.qDecimal) || 0,

      spotPairSymbol: (pair.symbol ?? '').trim(),
      spotPairType: (pair.type ?? '').trim(),
      listed: Boolean(pair.listed),
      gaugeWhitelisted: Boolean(pair.gaugeWhitelisted),
      exchange: (pair.exchange ?? '').trim(),
      feeSource: (pair.feeSource ?? '').trim(),
      dynamicFee: Boolean(pair.dynamicFee),
      listingDate: listingDateSec,
      totalSwapFeesUsd: Number(pair.totalSwapFeesUsd) || 0,
      daySwapFeesUsd: Number(pair.daySwapFeesUsd) || 0,

      poolType: pair.isConcentratedLiquidity ? 'CL' : 'Basic',
      isStable: pair.type === 'stable',
      feeRate: pair.effectiveFeeBps ?? null,
      tickSpacing: null,
      isVotingEnabled: meta?.isVotingEnabled ?? false,
      grade: meta?.grade ?? 3,
      isGradeManualOverride: meta?.isGradeManualOverride ?? false,
      factoryAddress: null,
      /** Mirrors spot_pairs.listingDate when set; otherwise response emission time. */
      createdAt: ts,
      /** Response emission time (spot_pairs has no updatedAt column). */
      updatedAt: iso,
    };
  }

  async listPools(): Promise<PoolListResponse> {
    const rows = await this.listPairsForAdminQuery();

    const ids = rows.map((r) => r.id);
    const metas = ids.length
      ? await this.metaRepo
          .createQueryBuilder('m')
          .where('m.pairId IN (:...ids)', { ids })
          .getMany()
      : [];
    const metaMap = new Map(metas.map((m) => [m.pairId, m]));

    return {
      pools: rows.map((p) => this.pairToAdminInfo(p, metaMap.get(p.id) ?? null)),
      total: rows.length,
    };
  }

  async getPool(address: string): Promise<AdminPoolDetailInfo> {
    const id = lcAddr(address);
    if (!id) throw new BadRequestException('address is required');
    const pair = await this.findOnePairForAdmin(id);
    if (!pair) throw new NotFoundException(`No spot_pairs row for address=${id}`);
    const meta = await this.metaRepo.findOne({ where: { pairId: id } });
    const base = this.pairToAdminInfo(pair, meta);
    return {
      ...base,
      pointTier: 0,
      stats: null,
    };
  }

  async listPoolTimeBuckets(args: {
    address: string;
    resolution: string;
    limit: number;
  }): Promise<AdminPoolTimeBucketsResponse> {
    const id = lcAddr(args.address);
    if (!id) throw new BadRequestException('address is required');
    const resolution = (args.resolution || '').trim();
    if (!resolution) throw new BadRequestException('resolution is required');
    const limit = Math.max(1, Math.min(2000, Math.floor(args.limit || 200)));

    const items = await this.pairBucketRepo.find({
      where: { pair: id, resolution },
      order: { bucketStartTs: 'DESC' },
      take: limit,
    });
    const asc = items.slice().sort((a, b) => a.bucketStartTs - b.bucketStartTs);

    return {
      pair: id,
      resolution,
      items: asc.map((r) => ({
        pair: r.pair,
        resolution: r.resolution,
        bucketIndex: r.bucketIndex,
        bucketStartTs: r.bucketStartTs,
        bucketEndTs: r.bucketEndTs,
        base: r.base,
        quote: r.quote,
        symbol: r.symbol,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        average: r.average,
        difference: r.difference,
        differencePercentage: r.differencePercentage,
        baseVolumeUSD: r.baseVolumeUSD,
        quoteVolumeUSD: r.quoteVolumeUSD,
        baseLiquidityUSD: r.baseLiquidityUSD,
        quoteLiquidityUSD: r.quoteLiquidityUSD,
        count: r.count,
      })),
    };
  }

  async setVoting(address: string, isVotingEnabled: boolean): Promise<AdminPoolInfo> {
    const id = lcAddr(address);
    if (!id) throw new BadRequestException('address is required');
    const pair = await this.findOnePairForAdmin(id);
    if (!pair) throw new NotFoundException(`No spot_pairs row for address=${id}`);

    const existing = await this.metaRepo.findOne({ where: { pairId: id } });
    const meta = existing
      ? existing
      : this.metaRepo.create({
          pairId: id,
          grade: 3,
          isGradeManualOverride: false,
          isVotingEnabled: false,
        });
    meta.isVotingEnabled = isVotingEnabled;
    await this.metaRepo.save(meta);

    return this.pairToAdminInfo(pair, meta);
  }

  async setGrade(address: string, req: UpdatePoolGradeRequest): Promise<AdminPoolInfo> {
    const id = lcAddr(address);
    if (!id) throw new BadRequestException('address is required');
    const pair = await this.findOnePairForAdmin(id);
    if (!pair) throw new NotFoundException(`No spot_pairs row for address=${id}`);

    const grade = req?.grade;
    if (grade !== 1 && grade !== 2 && grade !== 3) {
      throw new BadRequestException('body.grade must be 1, 2, or 3');
    }

    const existing = await this.metaRepo.findOne({ where: { pairId: id } });
    const meta = existing
      ? existing
      : this.metaRepo.create({
          pairId: id,
          grade: 3,
          isGradeManualOverride: false,
          isVotingEnabled: false,
        });
    meta.grade = grade;
    meta.isGradeManualOverride = req?.isManualOverride ?? true;
    await this.metaRepo.save(meta);

    return this.pairToAdminInfo(pair, meta);
  }

  async setListed(address: string, listed: boolean): Promise<AdminPoolInfo> {
    const id = lcAddr(address);
    if (!id) throw new BadRequestException('address is required');
    const pair = await this.findOnePairForAdmin(id);
    if (!pair) throw new NotFoundException(`No spot_pairs row for address=${id}`);

    const patch: Partial<Pick<SpotPairEntity, 'listed' | 'listingDate'>> = { listed };
    if (listed && (!pair.listingDate || Number(pair.listingDate) <= 0)) {
      patch.listingDate = Math.floor(Date.now() / 1000);
    }
    await this.pairRepo.update({ id }, patch);

    const reloaded = await this.pairRepo.findOne({
      where: { id },
      select: SPOT_PAIR_ADMIN_SELECT,
    });
    if (!reloaded) throw new NotFoundException(`No spot_pairs row for address=${id}`);

    const meta = await this.metaRepo.findOne({ where: { pairId: id } });
    return this.pairToAdminInfo(reloaded, meta ?? null);
  }
}

