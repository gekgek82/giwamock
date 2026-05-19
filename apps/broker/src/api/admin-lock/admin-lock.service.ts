import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VeLockPositionEntity } from '../../models/ve-lock/ve-lock-position.entity';
import { VeLockEventEntity } from '../../models/ve-lock/ve-lock-event.entity';
import { VoterVotePositionEntity } from '../../models/voting/voter-vote-position.entity';
import type { AdminLockStatsDto, AdminLockEventsDto, AdminLockByEpochDto } from '@giwater/shared';

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

@Injectable()
export class AdminLockService {
  constructor(
    @InjectRepository(VeLockPositionEntity)
    private readonly lockPositions: Repository<VeLockPositionEntity>,
    @InjectRepository(VeLockEventEntity)
    private readonly lockEvents: Repository<VeLockEventEntity>,
    @InjectRepository(VoterVotePositionEntity)
    private readonly votePositions: Repository<VoterVotePositionEntity>,
  ) {}

  async getStats(pool?: string): Promise<AdminLockStatsDto> {
    const [activePositions, voteRows, pairSymbols] = await Promise.all([
      this.lockPositions.find({ where: { isActive: true } }),
      this.votePositions
        .createQueryBuilder('v')
        .select(['v.pool', 'v.tokenId'])
        .where('v.isActive = true')
        .getMany(),
      this.lockPositions.manager.query<{ id: string; symbol: string }[]>(
        'SELECT id, symbol FROM spot_pairs',
      ),
    ]);

    const symbolMap = new Map(pairSymbols.map((r) => [r.id.toLowerCase(), r.symbol]));

    const totalLockedAmount = activePositions
      .reduce((sum, p) => sum + BigInt(p.amount), BigInt(0))
      .toString();
    const activeLockCount = activePositions.length;

    const nowSec = Math.floor(Date.now() / 1000);
    const avgRemainingDays =
      activePositions.length === 0
        ? 0
        : Math.round(
            activePositions.reduce((sum, p) => {
              if (!p.lockEnd || p.isPermanent) return sum + 365;
              return sum + Math.max(0, (Number(p.lockEnd) - nowSec) / 86400);
            }, 0) / activePositions.length,
          );

    const poolToTokenIds = new Map<string, Set<string>>();
    for (const vp of voteRows) {
      if (!poolToTokenIds.has(vp.pool)) poolToTokenIds.set(vp.pool, new Set());
      poolToTokenIds.get(vp.pool)!.add(vp.tokenId);
    }

    const activeAmountByTokenId = new Map(activePositions.map((p) => [p.tokenId, p.amount]));

    const pairStats = Array.from(poolToTokenIds.entries()).map(([poolAddr, tokenIds]) => {
      const locked = Array.from(tokenIds).reduce(
        (sum, tid) => sum + BigInt(activeAmountByTokenId.get(tid) ?? '0'),
        BigInt(0),
      );
      return {
        pool: poolAddr,
        label: symbolMap.get(poolAddr.toLowerCase()) ?? truncateAddress(poolAddr),
        totalLockedAmount: locked.toString(),
      };
    });

    return { pool: pool ?? null, totalLockedAmount, activeLockCount, avgRemainingDays, pairStats };
  }

  async getEvents(pool?: string, limit = 20, offset = 0): Promise<AdminLockEventsDto> {
    const qb = this.lockEvents
      .createQueryBuilder('e')
      .orderBy('e.createdAt', 'DESC')
      .limit(limit)
      .offset(offset);

    if (pool) {
      const tokenIds = await this.votePositions
        .createQueryBuilder('v')
        .select('v.tokenId')
        .where('LOWER(v.pool) = LOWER(:pool)', { pool })
        .getMany()
        .then((rows) => rows.map((r) => r.tokenId));
      if (tokenIds.length === 0) return { events: [], total: 0 };
      qb.where('e.tokenId IN (:...tokenIds)', { tokenIds });
    }

    const [rows, total] = await qb.getManyAndCount();
    return {
      events: rows.map((e) => ({
        id: e.id,
        tokenId: e.tokenId,
        owner: e.owner,
        eventType: e.eventType,
        depositType: e.depositType,
        value: e.value,
        lockEnd: e.lockEnd,
        transactionHash: e.transactionHash,
        blockTimestamp: e.blockTimestamp,
      })),
      total,
    };
  }

  async getByEpoch(pool?: string, epochs = 8): Promise<AdminLockByEpochDto> {
    const poolFilter = pool
      ? `AND le."tokenId" IN (SELECT "tokenId" FROM voter_vote_positions WHERE LOWER(pool) = LOWER($2))`
      : '';
    const params: unknown[] = pool ? [epochs, pool] : [epochs];

    const rows = await this.lockPositions.manager.query<
      { epoch_num: string; epoch_ts: string; total_locked: string }[]
    >(
      `WITH epoch_boundaries AS (
        SELECT DISTINCT "epochTimestamp"::numeric AS epoch_ts,
               ROW_NUMBER() OVER (ORDER BY "epochTimestamp"::numeric) AS epoch_num
        FROM voter_vote_events
        WHERE "epochTimestamp" IS NOT NULL
        ORDER BY epoch_ts
        LIMIT $1
      )
      SELECT
        e.epoch_num,
        e.epoch_ts::text AS epoch_ts,
        COALESCE(SUM(
          CASE
            WHEN le."eventType" = 'Deposit' THEN le.value::numeric
            WHEN le."eventType" = 'Withdraw' THEN -le.value::numeric
            ELSE 0
          END
        ), 0) AS total_locked
      FROM epoch_boundaries e
      LEFT JOIN ve_lock_events le
        ON le."blockTimestamp"::numeric <= e.epoch_ts
        ${poolFilter}
      GROUP BY e.epoch_num, e.epoch_ts
      ORDER BY e.epoch_ts`,
      params,
    );

    return {
      epochs: rows.map((r) => ({
        epochNumber: Number(r.epoch_num),
        epochTimestamp: r.epoch_ts,
        totalLockedAmount: r.total_locked,
      })),
    };
  }
}
