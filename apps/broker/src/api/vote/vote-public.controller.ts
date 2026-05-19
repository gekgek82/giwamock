import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  EpochInfo,
  VotePoolInfo,
  VotePoolsResponse,
} from '@giwater/shared';
import { SpotPairEntity } from '../../models/pair/spot-pair.entity';
import { VoterVotePositionEntity } from '../../models/voting/voter-vote-position.entity';

/**
 * Standard Velodrome / Aerodrome epoch zero — Thursday 2023-11-23 00:00:00 UTC.
 * Epochs run weekly. Voting window = the last day of the epoch.
 */
const EPOCH_ZERO_TS = 1700697600;
const WEEK_SECONDS = 7 * 24 * 3600;
const DAY_SECONDS = 24 * 3600;

type VoteSortBy = 'rewards' | 'votes' | 'fees' | 'tvl';

function parseSortBy(raw: string | undefined): VoteSortBy {
  const v = (raw ?? 'tvl').trim().toLowerCase();
  if (v === 'rewards' || v === 'votes' || v === 'fees' || v === 'tvl') {
    return v;
  }
  return 'tvl';
}

@ApiTags('vote')
@Controller('vote')
export class VotePublicController {
  constructor(
    @InjectRepository(SpotPairEntity)
    private readonly pairRepo: Repository<SpotPairEntity>,
    @InjectRepository(VoterVotePositionEntity)
    private readonly votePositions: Repository<VoterVotePositionEntity>,
  ) {}

  @Get('epoch/current')
  @ApiOperation({
    summary: 'Current voting epoch info',
    description:
      'Computes the current epoch from a fixed epoch-zero timestamp (Thu 2023-11-23 UTC). ' +
      'Aggregates `totalVotingPower` from active rows in `voter_vote_positions` for this epoch. ' +
      'Fee / incentive / reward totals are placeholders until off-chain rollups exist.',
  })
  async getCurrentEpoch(): Promise<EpochInfo> {
    const now = Math.floor(Date.now() / 1000);
    const epochNumber = Math.floor((now - EPOCH_ZERO_TS) / WEEK_SECONDS);
    const startsTs = EPOCH_ZERO_TS + epochNumber * WEEK_SECONDS;
    const endsTs = startsTs + WEEK_SECONDS;
    const endsInSeconds = Math.max(0, endsTs - now);
    const endsInDays = endsInSeconds / DAY_SECONDS;

    // Voting window: last day of the epoch.
    const votingWindowStartTs = endsTs - DAY_SECONDS;
    const votingWindowEndTs = endsTs;
    const isVotingOpen = now >= votingWindowStartTs && now < votingWindowEndTs;

    // Sum active weight in the current epoch (epoch start ts in seconds, as text).
    const epochTimestampStr = String(startsTs);
    const totalRow = await this.votePositions
      .createQueryBuilder('v')
      .select('COALESCE(SUM(v.weight::numeric), 0)', 'totalWeight')
      .where('v."isActive" = :isActive', { isActive: true })
      .andWhere('v."epochTimestamp" = :epoch', { epoch: epochTimestampStr })
      .getRawOne<{ totalWeight: string | number | null }>();

    const totalVotingPower = String(totalRow?.totalWeight ?? 0);

    return {
      epochNumber,
      startsAt: new Date(startsTs * 1000).toISOString(),
      endsAt: new Date(endsTs * 1000).toISOString(),
      endsInSeconds,
      endsInDays,
      votingWindowStart: new Date(votingWindowStartTs * 1000).toISOString(),
      votingWindowEnd: new Date(votingWindowEndTs * 1000).toISOString(),
      isVotingOpen,
      totalVotingPower,
      totalFees: '0',
      totalIncentives: '0',
      totalRewards: '0',
    };
  }

  @Get('pools')
  @ApiOperation({
    summary: 'Listed pools ranked for voting',
    description:
      'Joins listed `spot_pairs` with aggregated active `voter_vote_positions` weight per pool. ' +
      'Pre-TGE: gauge address, fees7d, incentives, rewards, vAPR, and emission APR are placeholders.',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['rewards', 'votes', 'fees', 'tvl'],
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  async listVotePools(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('sortBy') sortByRaw?: string,
    @Query('search') searchRaw?: string,
  ): Promise<VotePoolsResponse> {
    const sortBy = parseSortBy(sortByRaw);
    const clampedLimit = Math.min(200, Math.max(1, Math.floor(limit)));
    const clampedOffset = Math.max(0, Math.floor(offset));
    const search = (searchRaw ?? '').trim();

    // Load all aggregated weights per pool from active vote positions
    // (raw SQL — use DB column names, see CLAUDE.md TypeORM rule).
    const weightRows = await this.votePositions.manager.query<
      { pool: string; pool_weight: string }[]
    >(
      `SELECT pool, SUM(weight::numeric) AS pool_weight
       FROM voter_vote_positions
       WHERE "isActive" = true
       GROUP BY pool`,
    );
    const weightMap = new Map<string, bigint>();
    let globalWeight = BigInt(0);
    for (const r of weightRows) {
      const w = BigInt(r.pool_weight ?? '0');
      weightMap.set(r.pool.toLowerCase(), w);
      globalWeight += w;
    }

    // Listed pairs (sorted by tvl), optionally filtered by symbol.
    const qb = this.pairRepo
      .createQueryBuilder('p')
      .where('p.listed = :listed', { listed: true });

    if (search) {
      qb.andWhere('p.symbol ILIKE :q', { q: `%${search}%` });
    }

    qb.addSelect(
      'COALESCE(p.dayBaseTvlUSD, 0) + COALESCE(p.dayQuoteTvlUSD, 0)',
      'pair_tvl_usd',
    )
      .orderBy('pair_tvl_usd', 'DESC')
      .addOrderBy('p.id', 'ASC');

    const total = await qb.getCount();
    const rows = await qb.clone().skip(clampedOffset).take(clampedLimit).getMany();

    const pools: VotePoolInfo[] = rows.map((row) => {
      const baseIsToken0 =
        row.base.trim().toLowerCase() === row.token0.trim().toLowerCase();
      const token0Symbol = baseIsToken0 ? row.baseSymbol : row.quoteSymbol;
      const token1Symbol = baseIsToken0 ? row.quoteSymbol : row.baseSymbol;
      const token0Decimals = baseIsToken0 ? row.bDecimal : row.qDecimal;
      const token1Decimals = baseIsToken0 ? row.qDecimal : row.bDecimal;

      const voteWeight = weightMap.get(row.id.toLowerCase()) ?? BigInt(0);
      const voteShare =
        globalWeight === BigInt(0)
          ? '0'
          : String(Number((voteWeight * BigInt(10000)) / globalWeight) / 100);

      const tvl = (row.dayBaseTvlUSD ?? 0) + (row.dayQuoteTvlUSD ?? 0);

      // sortBy is accepted for parity with indexerApi; default ordering above is
      // by TVL which is what the UI shows by default. Other modes fall back to it
      // until off-chain rewards/fees rollups exist.
      void sortBy;

      return {
        poolAddress: row.id,
        token0: {
          address: row.token0,
          symbol: token0Symbol,
          decimals: token0Decimals,
        },
        token1: {
          address: row.token1,
          symbol: token1Symbol,
          decimals: token1Decimals,
        },
        isStable: false,
        poolType: row.isConcentratedLiquidity ? 'cl' : 'basic',
        tickSpacing: null,
        feePercent:
          row.effectiveFeeBps != null ? String(row.effectiveFeeBps / 100) : '0',
        tvl: String(tvl),
        gaugeAddress: '',
        voteWeight: voteWeight.toString(),
        voteShare,
        fees7d: '0',
        incentives: '0',
        totalRewards: '0',
        vAPR: '0',
        emissionApr: '0',
      };
    });

    return {
      pools,
      pagination: {
        total,
        limit: clampedLimit,
        offset: clampedOffset,
      },
    };
  }
}
