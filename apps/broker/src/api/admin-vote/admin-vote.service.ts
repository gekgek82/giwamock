import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VoterVotePositionEntity } from '../../models/voting/voter-vote-position.entity';
import { VoterVoteEventEntity } from '../../models/voting/voter-vote-event.entity';
import type {
  AdminVoteStatsDto,
  AdminVoteEventsDto,
  AdminVoteDistributionDto,
  AdminVoteByEpochDto,
} from '@giwater/shared';

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

@Injectable()
export class AdminVoteService {
  constructor(
    @InjectRepository(VoterVotePositionEntity)
    private readonly votePositions: Repository<VoterVotePositionEntity>,
    @InjectRepository(VoterVoteEventEntity)
    private readonly voteEvents: Repository<VoterVoteEventEntity>,
  ) {}

  async getStats(pool?: string): Promise<AdminVoteStatsDto> {
    const [poolAggRows, pairSymbols, epochRows] = await Promise.all([
      this.votePositions.manager.query<
        { pool: string; pool_weight: string; voter_count: string }[]
      >(
        `SELECT pool,
                SUM(weight::numeric) AS pool_weight,
                COUNT(DISTINCT owner) AS voter_count
         FROM voter_vote_positions
         WHERE "isActive" = true
         GROUP BY pool`,
      ),
      this.votePositions.manager.query<{ id: string; symbol: string }[]>(
        'SELECT id, symbol FROM spot_pairs',
      ),
      this.votePositions.manager.query<{ epochTimestamp: string }[]>(
        `SELECT DISTINCT "epochTimestamp" FROM voter_vote_events WHERE "epochTimestamp" IS NOT NULL ORDER BY "epochTimestamp" ASC`,
      ),
    ]);

    const symbolMap = new Map(pairSymbols.map((r) => [r.id.toLowerCase(), r.symbol]));
    const currentEpoch = epochRows.length;

    const totalGlobalWeight = poolAggRows.reduce(
      (sum, r) => sum + BigInt(r.pool_weight),
      BigInt(0),
    );

    const targetPool = pool?.toLowerCase();
    const poolRow = targetPool
      ? poolAggRows.find((r) => r.pool.toLowerCase() === targetPool)
      : null;

    const poolWeight = pool
      ? BigInt(poolRow?.pool_weight ?? '0')
      : totalGlobalWeight;

    const voteWeightBps =
      totalGlobalWeight === BigInt(0)
        ? 0
        : Number((poolWeight * BigInt(10000)) / totalGlobalWeight);

    const uniqueVoterCount = pool
      ? Number(poolRow?.voter_count ?? 0)
      : poolAggRows.reduce((sum, r) => sum + Number(r.voter_count), 0);

    const pairStats = poolAggRows.map((r) => ({
      pool: r.pool,
      label: symbolMap.get(r.pool.toLowerCase()) ?? truncateAddress(r.pool),
      voteWeightBps:
        totalGlobalWeight === BigInt(0)
          ? 0
          : Number((BigInt(r.pool_weight) * BigInt(10000)) / totalGlobalWeight),
      voterCount: Number(r.voter_count),
    }));

    return { pool: pool ?? null, voteWeightBps, uniqueVoterCount, currentEpoch, pairStats };
  }

  async getEvents(pool?: string, limit = 20, offset = 0): Promise<AdminVoteEventsDto> {
    const qb = this.voteEvents
      .createQueryBuilder('e')
      .orderBy('e.createdAt', 'DESC')
      .limit(limit)
      .offset(offset);

    if (pool) {
      qb.where('LOWER(e.pool) = LOWER(:pool)', { pool });
    }

    const [rows, total] = await qb.getManyAndCount();
    return {
      events: rows.map((e) => ({
        id: e.id,
        tokenId: e.tokenId,
        pool: e.pool,
        owner: e.owner,
        eventType: e.eventType,
        weight: e.weight,
        totalWeight: e.totalWeight,
        epochTimestamp: e.epochTimestamp,
        transactionHash: e.transactionHash,
        blockTimestamp: e.blockTimestamp,
      })),
      total,
    };
  }

  async getDistribution(epoch?: number): Promise<AdminVoteDistributionDto> {
    const [poolAggRows, pairSymbols, epochRows] = await Promise.all([
      this.votePositions.manager.query<{ pool: string; pool_weight: string }[]>(
        `SELECT pool, SUM(weight::numeric) AS pool_weight
         FROM voter_vote_positions
         WHERE "isActive" = true
         GROUP BY pool`,
      ),
      this.votePositions.manager.query<{ id: string; symbol: string }[]>(
        'SELECT id, symbol FROM spot_pairs',
      ),
      this.votePositions.manager.query<{ epochTimestamp: string }[]>(
        `SELECT DISTINCT "epochTimestamp" FROM voter_vote_events WHERE "epochTimestamp" IS NOT NULL ORDER BY "epochTimestamp" ASC`,
      ),
    ]);

    const symbolMap = new Map(pairSymbols.map((r) => [r.id.toLowerCase(), r.symbol]));
    const currentEpoch = epochRows.length;

    const totalWeight = poolAggRows.reduce(
      (sum, r) => sum + BigInt(r.pool_weight),
      BigInt(0),
    );

    const buckets = poolAggRows.map((r) => ({
      pool: r.pool,
      label: symbolMap.get(r.pool.toLowerCase()) ?? truncateAddress(r.pool),
      totalWeight: r.pool_weight,
      weightBps:
        totalWeight === BigInt(0)
          ? 0
          : Number((BigInt(r.pool_weight) * BigInt(10000)) / totalWeight),
    }));

    return { epoch: epoch ?? currentEpoch, buckets };
  }

  async getByEpoch(pool?: string, epochs = 8): Promise<AdminVoteByEpochDto> {
    const poolFilter = pool ? 'AND LOWER(e.pool) = LOWER($2)' : '';
    const params: unknown[] = pool ? [epochs, pool] : [epochs];

    const rows = await this.voteEvents.manager.query<
      { epoch_num: string; epoch_ts: string; total_weight: string }[]
    >(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY "epochTimestamp"::numeric) AS epoch_num,
         "epochTimestamp" AS epoch_ts,
         SUM(weight::numeric) AS total_weight
       FROM voter_vote_events e
       WHERE "epochTimestamp" IS NOT NULL
         ${poolFilter}
       GROUP BY "epochTimestamp"
       ORDER BY "epochTimestamp"::numeric
       LIMIT $1`,
      params,
    );

    return {
      epochs: rows.map((r) => ({
        epochNumber: Number(r.epoch_num),
        epochTimestamp: r.epoch_ts,
        totalWeight: r.total_weight,
      })),
    };
  }
}
