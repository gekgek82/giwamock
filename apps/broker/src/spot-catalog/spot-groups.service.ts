import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  AddPairToSpotGroupDto,
  AddTokenToSpotGroupDto,
  CreateSpotGroupDto,
  SpotPairLeaderboardPageDto,
  SpotPairRecordDto,
  SpotGroupPairMemberDto,
  SpotGroupPairMembersPageDto,
  SpotGroupRecordDto,
  SpotTokenLeaderboardPageDto,
  SpotGroupTokenMemberDto,
  SpotGroupTokenMembersPageDto,
} from '@giwater/shared';
import { computeSpotPairInventoryTvlUsd } from '@giwater/shared';
import { In, Repository } from 'typeorm';
import { SpotGroupEntity } from '../models/group/spot-group.entity';
import { SpotGroupPairEntity } from '../models/pair/spot-group-pair.entity';
import { SpotPairEntity } from '../models/pair/spot-pair.entity';
import { SpotGroupTokenEntity } from '../models/token/spot-group-token.entity';
import { SpotTokenEntity } from '../models/token/spot-token.entity';
import { sqlPairTvlSortUsd } from './spot-catalog.service';

function lcAddr(s: string): string {
  return s.trim().toLowerCase();
}

type SpotLeaderboardSort = 'asc' | 'desc';
type SpotLeaderboardMetric = 'day-change' | 'tvl' | 'volume';

const LEADERBOARD_MAX_LIMIT = 200;
const PAIR_LISTED_FILTER_SQL = 'COALESCE(p.listed, false) = :listed';

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

function tokenToDto(row: SpotTokenEntity) {
  return { ...row };
}

function pairToDto(row: SpotPairEntity): SpotPairRecordDto {
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

@Injectable()
export class SpotGroupsService {
  constructor(
    @InjectRepository(SpotGroupEntity)
    private readonly groupRepo: Repository<SpotGroupEntity>,
    @InjectRepository(SpotGroupTokenEntity)
    private readonly groupTokenRepo: Repository<SpotGroupTokenEntity>,
    @InjectRepository(SpotGroupPairEntity)
    private readonly groupPairRepo: Repository<SpotGroupPairEntity>,
    @InjectRepository(SpotTokenEntity)
    private readonly tokenRepo: Repository<SpotTokenEntity>,
    @InjectRepository(SpotPairEntity)
    private readonly pairRepo: Repository<SpotPairEntity>,
  ) {}

  async createGroup(dto: CreateSpotGroupDto): Promise<SpotGroupRecordDto> {
    const id = dto.id?.trim() ?? '';
    if (!id) {
      throw new BadRequestException('body.id is required');
    }
    const exists = await this.groupRepo.findOne({ where: { id } });
    if (exists) {
      throw new ConflictException(`Group id already exists: ${id}`);
    }
    const row = this.groupRepo.create({
      id,
      name: (dto.name ?? '').trim(),
      description: (dto.description ?? '').trim(),
    });
    await this.groupRepo.save(row);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
    };
  }

  async addTokenToGroup(
    groupId: string,
    body: AddTokenToSpotGroupDto,
  ): Promise<SpotGroupTokenMemberDto> {
    const gid = groupId.trim();
    if (!gid) {
      throw new BadRequestException('groupId is required');
    }
    const group = await this.groupRepo.findOne({ where: { id: gid } });
    if (!group) {
      throw new NotFoundException(`No spot_groups row for id=${gid}`);
    }
    const tokenAddress =
      typeof body?.tokenAddress === 'string' ? body.tokenAddress : '';
    const tid = lcAddr(tokenAddress);
    if (!tid) {
      throw new BadRequestException('body.tokenAddress is required');
    }
    const existing = await this.groupTokenRepo.findOne({
      where: { groupId: gid, tokenId: tid },
    });
    if (existing) {
      return {
        groupId: existing.groupId,
        tokenId: existing.tokenId,
        symbol: existing.symbol,
      };
    }
    const token = await this.tokenRepo.findOne({ where: { id: tid } });
    const symbol = token?.symbol?.trim() ?? '';
    const row = this.groupTokenRepo.create({
      groupId: gid,
      tokenId: tid,
      symbol,
    });
    await this.groupTokenRepo.save(row);
    return {
      groupId: row.groupId,
      tokenId: row.tokenId,
      symbol: row.symbol,
    };
  }

  async listTokensInGroup(args: {
    groupId: string;
    offset?: number;
    limit?: number;
  }): Promise<SpotGroupTokenMembersPageDto> {
    const gid = args.groupId.trim();
    if (!gid) {
      throw new BadRequestException('groupId is required');
    }
    const group = await this.groupRepo.findOne({ where: { id: gid } });
    if (!group) {
      throw new NotFoundException(`No spot_groups row for id=${gid}`);
    }
    const offset = Math.max(0, Number(args.offset ?? 0) || 0);
    const limitRaw = Number(args.limit ?? 200) || 200;
    const limit = Math.min(500, Math.max(1, limitRaw));

    const [rows, total] = await this.groupTokenRepo.findAndCount({
      where: { groupId: gid },
      order: { symbol: 'ASC', tokenId: 'ASC' },
      skip: offset,
      take: limit,
    });

    return {
      groupId: gid,
      offset,
      limit,
      total,
      items: rows.map((r) => ({
        groupId: r.groupId,
        tokenId: r.tokenId,
        symbol: r.symbol,
      })),
    };
  }

  async removeTokenFromGroup(
    groupId: string,
    tokenAddress: string,
  ): Promise<void> {
    const gid = groupId.trim();
    if (!gid) {
      throw new BadRequestException('groupId is required');
    }
    const group = await this.groupRepo.findOne({ where: { id: gid } });
    if (!group) {
      throw new NotFoundException(`No spot_groups row for id=${gid}`);
    }
    const tid = lcAddr(tokenAddress ?? '');
    if (!tid) {
      throw new BadRequestException('tokenAddress is required');
    }
    await this.groupTokenRepo.delete({ groupId: gid, tokenId: tid });
  }

  async listPairsInGroup(args: {
    groupId: string;
    offset?: number;
    limit?: number;
  }): Promise<SpotGroupPairMembersPageDto> {
    const gid = args.groupId.trim();
    if (!gid) {
      throw new BadRequestException('groupId is required');
    }
    const group = await this.groupRepo.findOne({ where: { id: gid } });
    if (!group) {
      throw new NotFoundException(`No spot_groups row for id=${gid}`);
    }
    const offset = Math.max(0, Number(args.offset ?? 0) || 0);
    const limitRaw = Number(args.limit ?? 200) || 200;
    const limit = Math.min(500, Math.max(1, limitRaw));

    const [rows, total] = await this.groupPairRepo.findAndCount({
      where: { groupId: gid },
      order: { symbol: 'ASC', pairId: 'ASC' },
      skip: offset,
      take: limit,
    });

    return {
      groupId: gid,
      offset,
      limit,
      total,
      items: rows.map((r) => ({
        pairId: r.pairId,
        groupId: r.groupId,
        symbol: r.symbol,
        base: r.base,
        quote: r.quote,
      })),
    };
  }

  async removePairFromGroup(groupId: string, pairAddress: string): Promise<void> {
    const gid = groupId.trim();
    if (!gid) {
      throw new BadRequestException('groupId is required');
    }
    const group = await this.groupRepo.findOne({ where: { id: gid } });
    if (!group) {
      throw new NotFoundException(`No spot_groups row for id=${gid}`);
    }
    const pid = lcAddr(pairAddress ?? '');
    if (!pid) {
      throw new BadRequestException('pairAddress is required');
    }
    await this.groupPairRepo.delete({ groupId: gid, pairId: pid });
  }

  async listTokensGroupLeaderboard(args: {
    groupId: string;
    metric: SpotLeaderboardMetric;
    sort: SpotLeaderboardSort;
    offset: number;
    limit: number;
    listed: boolean;
  }): Promise<SpotTokenLeaderboardPageDto> {
    const gid = args.groupId.trim();
    if (!gid) throw new BadRequestException('groupId is required');
    const group = await this.groupRepo.findOne({ where: { id: gid } });
    if (!group) throw new NotFoundException(`No spot_groups row for id=${gid}`);

    const { offset: o, limit: l } = clampLeaderboardPage(args.offset, args.limit);
    const ord = leaderboardOrder(args.sort);

    const qb = this.tokenRepo
      .createQueryBuilder('t')
      .innerJoin(SpotGroupTokenEntity, 'gt', 'gt.tokenId = t.id AND gt.groupId = :groupId', {
        groupId: gid,
      })
      .where('t.listed = :listed', { listed: args.listed });

    if (args.metric === 'day-change') {
      qb.orderBy('t.dayPriceDifferencePercentage', ord).addOrderBy('t.id', 'ASC');
    } else if (args.metric === 'tvl') {
      qb.orderBy('t.dayTvlUSD', ord).addOrderBy('t.dayTvl', ord).addOrderBy('t.id', 'ASC');
    } else {
      qb.orderBy('t.dayVolumeUSD', ord).addOrderBy('t.dayVolume', ord).addOrderBy('t.id', 'ASC');
    }

    const total = await qb.getCount();
    const rows = await qb.clone().skip(o).take(l).getMany();
    return {
      offset: o,
      limit: l,
      total,
      items: rows.map((r) => tokenToDto(r)) as any,
    } as SpotTokenLeaderboardPageDto;
  }

  async listPairsGroupLeaderboard(args: {
    groupId: string;
    metric: SpotLeaderboardMetric;
    sort: SpotLeaderboardSort;
    offset: number;
    limit: number;
    listed: boolean;
  }): Promise<SpotPairLeaderboardPageDto> {
    const gid = args.groupId.trim();
    if (!gid) throw new BadRequestException('groupId is required');
    const group = await this.groupRepo.findOne({ where: { id: gid } });
    if (!group) throw new NotFoundException(`No spot_groups row for id=${gid}`);

    const { offset: o, limit: l } = clampLeaderboardPage(args.offset, args.limit);
    const ord = leaderboardOrder(args.sort);

    const qb = this.pairRepo
      .createQueryBuilder('p')
      .innerJoin(SpotGroupPairEntity, 'gp', 'gp.pairId = p.id AND gp.groupId = :groupId', {
        groupId: gid,
      })
      .where(PAIR_LISTED_FILTER_SQL, { listed: args.listed });

    if (args.metric === 'day-change') {
      qb.orderBy('p.dayPriceDifferencePercentage', ord).addOrderBy('p.id', 'ASC');
    } else if (args.metric === 'tvl') {
      qb.addSelect(sqlPairTvlSortUsd('p'), 'pair_tvl_sort_usd').orderBy(
        'pair_tvl_sort_usd',
        ord,
      );
      qb.addOrderBy('p.id', 'ASC');
    } else {
      qb.orderBy('p.dayVolumeUSD', ord).addOrderBy('p.dayVolume', ord).addOrderBy('p.id', 'ASC');
    }

    const total = await qb.getCount();
    const rows = await qb.clone().skip(o).take(l).getMany();
    return {
      offset: o,
      limit: l,
      total,
      items: await this.mapPairsToDtoWithUsd(rows),
    } as SpotPairLeaderboardPageDto;
  }

  async addPairToGroup(
    groupId: string,
    body: AddPairToSpotGroupDto,
  ): Promise<SpotGroupPairMemberDto> {
    const gid = groupId.trim();
    if (!gid) {
      throw new BadRequestException('groupId is required');
    }
    const group = await this.groupRepo.findOne({ where: { id: gid } });
    if (!group) {
      throw new NotFoundException(`No spot_groups row for id=${gid}`);
    }
    const pairAddress =
      typeof body?.pairAddress === 'string' ? body.pairAddress : '';
    const pid = lcAddr(pairAddress);
    if (!pid) {
      throw new BadRequestException('body.pairAddress is required');
    }
    const existing = await this.groupPairRepo.findOne({
      where: { pairId: pid, groupId: gid },
    });
    if (existing) {
      return {
        pairId: existing.pairId,
        groupId: existing.groupId,
        symbol: existing.symbol,
        base: existing.base,
        quote: existing.quote,
      };
    }
    const pair = await this.pairRepo.findOne({ where: { id: pid } });
    if (!pair) {
      throw new NotFoundException(`No spot_pairs row for address=${pid}`);
    }
    const row = this.groupPairRepo.create({
      pairId: pid,
      groupId: gid,
      symbol: pair.symbol ?? '',
      base: pair.base ?? '',
      quote: pair.quote ?? '',
    });
    await this.groupPairRepo.save(row);
    return {
      pairId: row.pairId,
      groupId: row.groupId,
      symbol: row.symbol,
      base: row.base,
      quote: row.quote,
    };
  }

  /**
   * Same enrichment as {@link SpotCatalogService} pair DTO mapping: batch-load
   * `spot_tokens.priceUSD` for base/quote and set {@link SpotPairRecordDto.totalTvlUsd}.
   */
  private async mapPairsToDtoWithUsd(rows: SpotPairEntity[]): Promise<SpotPairRecordDto[]> {
    if (rows.length === 0) {
      return [];
    }
    const baseDtos = rows.map((r) => pairToDto(r));
    const tokenIds = new Set<string>();
    for (const r of rows) {
      const b = lcAddr(r.base);
      const q = lcAddr(r.quote);
      if (b) tokenIds.add(b);
      if (q) tokenIds.add(q);
    }
    const ids = [...tokenIds];
    const priceMap = new Map<string, number>();
    if (ids.length > 0) {
      const tokRows = await this.tokenRepo.find({
        where: { id: In(ids) },
        select: ['id', 'priceUSD'],
      });
      for (const t of tokRows) {
        priceMap.set(t.id, t.priceUSD);
      }
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
      return { ...dto, totalTvlUsd };
    });
  }
}
