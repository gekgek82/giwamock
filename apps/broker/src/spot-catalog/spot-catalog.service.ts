import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type SpotPairLeaderboardPageDto,
  type SpotPairRecordDto,
  type SpotTokenLeaderboardPageDto,
  type SpotTokenRecordDto,
  computeSpotPairInventoryTvlUsd,
} from '@giwater/shared';
import { In, Repository } from 'typeorm';
import { SpotPairAdminMetaEntity } from '../models/pair/spot-pair-admin-meta.entity';
import { SpotPairEntity } from '../models/pair/spot-pair.entity';
import { SpotTokenEntity } from '../models/token/spot-token.entity';

function lcAddr(s: string): string {
  return s.trim().toLowerCase();
}

/** `spot_pairs.listed` null → treat as unlisted; filter matches query `listed` exactly. */
const PAIR_LISTED_FILTER_SQL = 'COALESCE(p.listed, false) = :listed';

const LEADERBOARD_MAX_LIMIT = 200;

/** `asc` | `desc` — path segment on `/leaderboard/<metric>/<sort>`. */
export type SpotLeaderboardSort = 'asc' | 'desc';

function leaderboardOrder(sort: SpotLeaderboardSort): 'ASC' | 'DESC' {
  return sort === 'asc' ? 'ASC' : 'DESC';
}

function clampLeaderboardPage(offset: number, limit: number): {
  offset: number;
  limit: number;
} {
  return {
    offset: Math.max(0, Math.floor(offset)),
    limit: Math.min(LEADERBOARD_MAX_LIMIT, Math.max(1, Math.floor(limit))),
  };
}

function computeDisplayPriceFromToken1PerToken0(
  priceToken1PerToken0: number,
  token0: string,
  token1: string,
  base: string,
  quote: string,
): number {
  const t0 = token0.trim().toLowerCase();
  const t1 = token1.trim().toLowerCase();
  const b = base.trim().toLowerCase();
  const q = quote.trim().toLowerCase();
  const p = priceToken1PerToken0;
  if (!Number.isFinite(p) || p < 0) return 0;
  if (b === t0 && q === t1) return p;
  if (b === t1 && q === t0) return p === 0 ? 0 : 1 / p;
  return p;
}

/**
 * SQL for **quote per 1 base** (matches `computeDisplayPriceFromToken1PerToken0`).
 * `alias` is the query-builder alias for `spot_pairs` (e.g. `p`).
 */
export function sqlDisplayPricePerBase(alias: string): string {
  return `(
    CASE
      WHEN LOWER(TRIM(COALESCE(${alias}.base, ''))) = LOWER(TRIM(COALESCE(${alias}.token0, '')))
       AND LOWER(TRIM(COALESCE(${alias}.quote, ''))) = LOWER(TRIM(COALESCE(${alias}.token1, '')))
        THEN COALESCE(${alias}.price, 0)::double precision
      WHEN LOWER(TRIM(COALESCE(${alias}.base, ''))) = LOWER(TRIM(COALESCE(${alias}.token1, '')))
       AND LOWER(TRIM(COALESCE(${alias}.quote, ''))) = LOWER(TRIM(COALESCE(${alias}.token0, '')))
       AND COALESCE(${alias}.price, 0) > 0
        THEN (1.0 / NULLIF(${alias}.price::double precision, 0))
      ELSE COALESCE(${alias}.price, 0)::double precision
    END
  )`;
}

/**
 * SQL sort key: inventory notionally in quote
 * (`baseLiquidity * displayPrice + quoteLiquidity` in API/entity terms).
 *
 * In PostgreSQL the same two fields are stored under **legacy column names**
 * `baseTvl` / `quoteTvl` (`SpotPairEntity` maps `baseLiquidity` → `baseTvl`, etc.).
 * Raw SQL here must use those physical column names.
 *
 * Fallback: UTC-day added liquidity USD columns when inventory×price is zero.
 */
export function sqlPairTvlSortUsd(alias: string): string {
  const dp = sqlDisplayPricePerBase(alias);
  return `(
    CASE
      WHEN (
        COALESCE(${alias}.baseTvl, 0)::double precision * ${dp}
        + COALESCE(${alias}.quoteTvl, 0)::double precision
      ) > 0
      THEN (
        COALESCE(${alias}.baseTvl, 0)::double precision * ${dp}
        + COALESCE(${alias}.quoteTvl, 0)::double precision
      )
      ELSE COALESCE(${alias}.dayBaseTvlUSD, 0)::double precision
        + COALESCE(${alias}.dayQuoteTvlUSD, 0)::double precision
    END
  )`;
}

/**
 * Map base/quote display columns to on-chain token0/token1 order for API clients.
 */
function spotPairToken0Token1Fields(row: SpotPairEntity): {
  token0Symbol: string;
  token1Symbol: string;
  token0Name: string;
  token1Name: string;
  token0Decimals: number;
  token1Decimals: number;
} {
  const t0 = row.token0?.trim().toLowerCase() ?? '';
  const t1 = row.token1?.trim().toLowerCase() ?? '';
  const b = row.base?.trim().toLowerCase() ?? '';
  if (!t0 || !t1 || !b) {
    return {
      token0Symbol: '',
      token1Symbol: '',
      token0Name: '',
      token1Name: '',
      token0Decimals: 0,
      token1Decimals: 0,
    };
  }
  const baseIsToken0 = b === t0;
  return {
    token0Symbol: baseIsToken0 ? row.baseSymbol : row.quoteSymbol,
    token1Symbol: baseIsToken0 ? row.quoteSymbol : row.baseSymbol,
    token0Name: baseIsToken0 ? row.baseName : row.quoteName,
    token1Name: baseIsToken0 ? row.quoteName : row.baseName,
    token0Decimals: baseIsToken0 ? row.bDecimal : row.qDecimal,
    token1Decimals: baseIsToken0 ? row.qDecimal : row.bDecimal,
  };
}

@Injectable()
export class SpotCatalogService {
  constructor(
    @InjectRepository(SpotTokenEntity)
    private readonly tokenRepo: Repository<SpotTokenEntity>,
    @InjectRepository(SpotPairEntity)
    private readonly pairRepo: Repository<SpotPairEntity>,
    @InjectRepository(SpotPairAdminMetaEntity)
    private readonly pairMetaRepo: Repository<SpotPairAdminMetaEntity>,
  ) {}

  async findTokenByAddress(
    address: string,
    listed = true,
  ): Promise<SpotTokenRecordDto | null> {
    const id = lcAddr(address);
    if (!id) {
      return null;
    }
    const row = await this.tokenRepo.findOne({ where: { id } });
    if (!row || row.listed !== listed) {
      return null;
    }
    return this.tokenToDto(row);
  }

  async findTokensBySymbol(
    symbol: string,
    listed = true,
  ): Promise<SpotTokenRecordDto[]> {
    const sym = symbol.trim();
    if (!sym) {
      return [];
    }
    const rows = await this.tokenRepo
      .createQueryBuilder('t')
      .where('LOWER(t.symbol) = LOWER(:sym)', { sym })
      .andWhere('t.listed = :listed', { listed })
      .orderBy('t.id', 'ASC')
      .getMany();
    return rows.map((r) => this.tokenToDto(r));
  }

  async findPairByAddress(
    address: string,
    listed = true,
  ): Promise<SpotPairRecordDto | null> {
    const id = lcAddr(address);
    if (!id) {
      return null;
    }
    const row = await this.pairRepo.findOne({ where: { id } });
    if (!row) {
      return null;
    }
    if ((row.listed ?? false) !== listed) {
      return null;
    }
    return (await this.mapPairsToDto([row]))[0]!;
  }

  async findPairsBySymbol(
    symbol: string,
    listed = true,
  ): Promise<SpotPairRecordDto[]> {
    const sym = symbol.trim();
    if (!sym) {
      return [];
    }
    const rows = await this.pairRepo
      .createQueryBuilder('p')
      .where('LOWER(p.symbol) = LOWER(:sym)', { sym })
      .andWhere(PAIR_LISTED_FILTER_SQL, { listed })
      .orderBy('p.id', 'ASC')
      .getMany();
    return await this.mapPairsToDto(rows);
  }

  async listTokensLeaderboardDayChange(
    offset: number,
    limit: number,
    listed: boolean,
    sort: SpotLeaderboardSort,
  ): Promise<SpotTokenLeaderboardPageDto> {
    const { offset: o, limit: l } = clampLeaderboardPage(offset, limit);
    const ord = leaderboardOrder(sort);
    const qb = this.tokenRepo
      .createQueryBuilder('t')
      .where('t.listed = :listed', { listed })
      .orderBy('t.dayPriceDifferencePercentage', ord)
      .addOrderBy('t.id', 'ASC');
    const total = await qb.getCount();
    const rows = await qb.clone().skip(o).take(l).getMany();
    return {
      offset: o,
      limit: l,
      total,
      items: rows.map((r) => this.tokenToDto(r)),
    };
  }

  async listTokensLeaderboardTvl(
    offset: number,
    limit: number,
    listed: boolean,
    sort: SpotLeaderboardSort,
  ): Promise<SpotTokenLeaderboardPageDto> {
    const { offset: o, limit: l } = clampLeaderboardPage(offset, limit);
    const ord = leaderboardOrder(sort);
    const qb = this.tokenRepo
      .createQueryBuilder('t')
      .where('t.listed = :listed', { listed })
      .orderBy('t.dayTvlUSD', ord)
      .addOrderBy('t.dayTvl', ord)
      .addOrderBy('t.id', 'ASC');
    const total = await qb.getCount();
    const rows = await qb.clone().skip(o).take(l).getMany();
    return {
      offset: o,
      limit: l,
      total,
      items: rows.map((r) => this.tokenToDto(r)),
    };
  }

  async listTokensLeaderboardVolume(
    offset: number,
    limit: number,
    listed: boolean,
    sort: SpotLeaderboardSort,
  ): Promise<SpotTokenLeaderboardPageDto> {
    const { offset: o, limit: l } = clampLeaderboardPage(offset, limit);
    const ord = leaderboardOrder(sort);
    const qb = this.tokenRepo
      .createQueryBuilder('t')
      .where('t.listed = :listed', { listed })
      .orderBy('t.dayVolumeUSD', ord)
      .addOrderBy('t.dayVolume', ord)
      .addOrderBy('t.id', 'ASC');
    const total = await qb.getCount();
    const rows = await qb.clone().skip(o).take(l).getMany();
    return {
      offset: o,
      limit: l,
      total,
      items: rows.map((r) => this.tokenToDto(r)),
    };
  }

  async listPairsLeaderboardDayChange(
    offset: number,
    limit: number,
    listed: boolean,
    sort: SpotLeaderboardSort,
  ): Promise<SpotPairLeaderboardPageDto> {
    const { offset: o, limit: l } = clampLeaderboardPage(offset, limit);
    const ord = leaderboardOrder(sort);
    const qb = this.pairRepo
      .createQueryBuilder('p')
      .where(PAIR_LISTED_FILTER_SQL, { listed })
      .orderBy('p.dayPriceDifferencePercentage', ord)
      .addOrderBy('p.id', 'ASC');
    const total = await qb.getCount();
    const rows = await qb.clone().skip(o).take(l).getMany();
    return {
      offset: o,
      limit: l,
      total,
      items: await this.mapPairsToDto(rows),
    };
  }

  async listPairsLeaderboardTvl(
    offset: number,
    limit: number,
    listed: boolean,
    sort: SpotLeaderboardSort,
  ): Promise<SpotPairLeaderboardPageDto> {
    const { offset: o, limit: l } = clampLeaderboardPage(offset, limit);
    const ord = leaderboardOrder(sort);
    const qb = this.pairRepo
      .createQueryBuilder('p')
      .where(PAIR_LISTED_FILTER_SQL, { listed })
      .addSelect(sqlPairTvlSortUsd('p'), 'pair_tvl_sort_usd')
      .orderBy('pair_tvl_sort_usd', ord)
      .addOrderBy('p.id', 'ASC');
    const total = await qb.getCount();
    const rows = await qb.clone().skip(o).take(l).getMany();
    return {
      offset: o,
      limit: l,
      total,
      items: await this.mapPairsToDto(rows),
    };
  }

  async listPairsLeaderboardVolume(
    offset: number,
    limit: number,
    listed: boolean,
    sort: SpotLeaderboardSort,
  ): Promise<SpotPairLeaderboardPageDto> {
    const { offset: o, limit: l } = clampLeaderboardPage(offset, limit);
    const ord = leaderboardOrder(sort);
    const qb = this.pairRepo
      .createQueryBuilder('p')
      .where(PAIR_LISTED_FILTER_SQL, { listed })
      .addSelect(
        'COALESCE(p.dayBaseVolumeUSD, 0) + COALESCE(p.dayQuoteVolumeUSD, 0)',
        'pair_day_volume_usd_total',
      )
      .orderBy('pair_day_volume_usd_total', ord)
      .addOrderBy('p.id', 'ASC');
    const total = await qb.getCount();
    const rows = await qb.clone().skip(o).take(l).getMany();
    return {
      offset: o,
      limit: l,
      total,
      items: await this.mapPairsToDto(rows),
    };
  }

  async listPairsRecentlyCreated(
    offset: number,
    limit: number,
    listed = true,
  ): Promise<SpotPairLeaderboardPageDto> {
    const { offset: o, limit: l } = clampLeaderboardPage(offset, limit);
    const qb = this.pairRepo
      .createQueryBuilder('p')
      .where(PAIR_LISTED_FILTER_SQL, { listed })
      .orderBy('p.listingDate', 'DESC')
      .addOrderBy('p.id', 'DESC');
    const total = await qb.getCount();
    const rows = await qb.clone().skip(o).take(l).getMany();
    return {
      offset: o,
      limit: l,
      total,
      items: await this.mapPairsToDto(rows),
    };
  }

  async listTokensRecentlyCreated(
    offset: number,
    limit: number,
    listed = true,
  ): Promise<SpotTokenLeaderboardPageDto> {
    const { offset: o, limit: l } = clampLeaderboardPage(offset, limit);
    const qb = this.tokenRepo
      .createQueryBuilder('t')
      .where('t.listed = :listed', { listed })
      .orderBy('t.listingDate', 'DESC')
      .addOrderBy('t.id', 'DESC');
    const total = await qb.getCount();
    const rows = await qb.clone().skip(o).take(l).getMany();
    return {
      offset: o,
      limit: l,
      total,
      items: rows.map((r) => this.tokenToDto(r)),
    };
  }

  async upsertTokenByErc20(args: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  }): Promise<SpotTokenRecordDto> {
    const id = lcAddr(args.address);
    if (!id) throw new BadRequestException('address is required');
    let row = await this.tokenRepo.findOne({ where: { id } });
    const nowSec = Math.floor(Date.now() / 1000);
    if (!row) {
      row = this.tokenRepo.create({
        id,
        symbol: args.symbol,
        name: args.name,
        decimals: args.decimals,
        ticker: args.symbol,
        listed: true,
        listingDate: nowSec,
      });
    } else {
      if (!row.symbol) row.symbol = args.symbol;
      if (!row.name) row.name = args.name;
      if (!row.decimals) row.decimals = args.decimals;
      row.listed = true;
      row.listingDate = Math.max(row.listingDate ?? 0, nowSec);
    }
    await this.tokenRepo.save(row);
    return this.tokenToDto(row);
  }

  async setTokenListed(
    address: string,
    listed: boolean,
  ): Promise<SpotTokenRecordDto> {
    const id = lcAddr(address);
    if (!id) {
      throw new BadRequestException('Path parameter `address` is required');
    }
    const row = await this.tokenRepo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('No spot_tokens row for this address');
    }
    row.listed = listed;
    if (listed) {
      const nowSec = Math.floor(Date.now() / 1000);
      row.listingDate = Math.max(row.listingDate ?? 0, nowSec);
    }
    await this.tokenRepo.save(row);
    return this.tokenToDto(row);
  }

  async setPairListed(
    address: string,
    listed: boolean,
  ): Promise<SpotPairRecordDto> {
    const id = lcAddr(address);
    if (!id) {
      throw new BadRequestException('Path parameter `address` is required');
    }
    const row = await this.pairRepo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('No spot_pairs row for this address');
    }
    row.listed = listed;
    if (listed) {
      const nowSec = Math.floor(Date.now() / 1000);
      row.listingDate = Math.max(row.listingDate, nowSec);
    }
    await this.pairRepo.save(row);
    if (listed) {
      await this.listSpotTokensForPairLegs(row);
    }
    return (await this.mapPairsToDto([row]))[0]!;
  }

  /**
   * When a pair is listed, set `listed=true` on existing `spot_tokens` rows for
   * `token0` and `token1` (skips missing rows). Does not run when unlisting a pair.
   */
  private async listSpotTokensForPairLegs(pair: SpotPairEntity): Promise<void> {
    const ids = [
      ...new Set(
        [pair.token0, pair.token1]
          .map((a) => lcAddr(a))
          .filter((id) => id.length > 0),
      ),
    ];
    if (ids.length === 0) {
      return;
    }
    const rows = await this.tokenRepo.find({ where: { id: In(ids) } });
    if (rows.length === 0) {
      return;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    for (const t of rows) {
      t.listed = true;
      t.listingDate = Math.max(t.listingDate ?? 0, nowSec);
    }
    await this.tokenRepo.save(rows);
  }

  private tokenToDto(row: SpotTokenEntity): SpotTokenRecordDto {
    return { ...row } as SpotTokenRecordDto;
  }

  private pairToDto(row: SpotPairEntity): SpotPairRecordDto {
    const displayPrice = computeDisplayPriceFromToken1PerToken0(
      row.price,
      row.token0,
      row.token1,
      row.base,
      row.quote,
    );
    const token01 = spotPairToken0Token1Fields(row);
    return {
      ...(row as unknown as SpotPairRecordDto),
      displayPrice,
      totalTvlUsd: null,
      ...token01,
    } as SpotPairRecordDto;
  }

  /**
   * Batch `spot_tokens.priceUSD` lookup so pair list endpoints stay O(1) queries per page,
   * not N+1. Fills {@link SpotPairRecordDto.totalTvlUsd} when both legs are priced.
   */
  private async mapPairsToDto(rows: SpotPairEntity[]): Promise<SpotPairRecordDto[]> {
    if (rows.length === 0) {
      return [];
    }
    const baseDtos = rows.map((r) => this.pairToDto(r));
    const pairIds = rows.map((r) => lcAddr(r.id));
    const tokenIds = new Set<string>();
    for (const r of rows) {
      const b = lcAddr(r.base);
      const q = lcAddr(r.quote);
      if (b) tokenIds.add(b);
      if (q) tokenIds.add(q);
    }
    const ids = [...tokenIds];
    const [priceRows, metaRows] = await Promise.all([
      ids.length > 0
        ? this.tokenRepo.find({ where: { id: In(ids) }, select: ['id', 'priceUSD'] })
        : Promise.resolve([]),
      pairIds.length > 0
        ? this.pairMetaRepo.find({ where: { pairId: In(pairIds) }, select: ['pairId', 'grade'] })
        : Promise.resolve([]),
    ]);
    const priceMap = new Map<string, number>();
    for (const t of priceRows) {
      priceMap.set(t.id, t.priceUSD);
    }
    const gradeMap = new Map<string, number>();
    for (const m of metaRows) {
      gradeMap.set(m.pairId, m.grade);
    }
    return rows.map((r, i) => {
      const dto = baseDtos[i]!;
      const pb = priceMap.get(lcAddr(r.base));
      const pq = priceMap.get(lcAddr(r.quote));
      const totalTvlUsd = computeSpotPairInventoryTvlUsd({
        baseLiquidity: r.baseLiquidity,
        quoteLiquidity: r.quoteLiquidity,
        baseTokenPriceUsd: pb,
        quoteTokenPriceUsd: pq,
      });
      const grade = gradeMap.get(lcAddr(r.id)) ?? 1;
      return { ...dto, totalTvlUsd, grade };
    });
  }
}
