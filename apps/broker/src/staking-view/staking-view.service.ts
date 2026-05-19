import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GaugeAbi } from '@giwater/shared';
import {
  createPublicClient,
  defineChain,
  getAddress,
  http,
  type Abi,
  type Address,
} from 'viem';
import { IndexerIngestedEventEntity } from '../models/indexer-ingested-event.entity';

const gaugeAbi = GaugeAbi as Abi;

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/i;
const SECONDS_PER_YEAR = 31_536_000n;

function giwaChain(rpcUrl: string) {
  return defineChain({
    id: 91342,
    name: 'Giwa Sepolia',
    nativeCurrency: { name: 'GIWA', symbol: 'GIWA', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

@Injectable()
export class StakingViewService {
  constructor(
    @InjectRepository(IndexerIngestedEventEntity)
    private readonly indexerEvents: Repository<IndexerIngestedEventEntity>,
  ) {}

  private requireRpcUrl(): string {
    const url =
      process.env.GIWA_SEPOLIA_RPC_URL?.trim() ||
      process.env.PONDER_RPC_URL_1?.trim() ||
      '';
    if (!url) {
      throw new ServiceUnavailableException(
        'Set GIWA_SEPOLIA_RPC_URL or PONDER_RPC_URL_1 for on-chain gauge reads',
      );
    }
    return url;
  }

  private publicClient() {
    const url = this.requireRpcUrl();
    return createPublicClient({
      chain: giwaChain(url),
      transport: http(url),
    });
  }

  private assertAddr(label: string, a: string): Address {
    const t = a.trim();
    if (!ADDR_RE.test(t)) {
      throw new BadRequestException(`Invalid ${label}`);
    }
    return getAddress(t) as Address;
  }

  /** Distinct (gauge, pool) pairs seen from `Voter.GaugeCreated` indexer payloads. */
  async listVoterGauges(): Promise<{ gauge: Address; pool: Address }[]> {
    const rows: { gauge: string; pool: string }[] =
      await this.indexerEvents.query(
        `
        SELECT DISTINCT (payload->>'gauge') AS gauge, (payload->>'pool') AS pool
        FROM indexed_events
        WHERE payload->>'type' = $1
          AND (payload->>'gauge') IS NOT NULL
          AND (payload->>'pool') IS NOT NULL
      `,
        ['VoterGaugeCreated'],
      );
    return rows
      .filter((r) => ADDR_RE.test(r.gauge) && ADDR_RE.test(r.pool))
      .map((r) => ({
        gauge: getAddress(r.gauge) as Address,
        pool: getAddress(r.pool) as Address,
      }));
  }

  async resolveGaugeForPool(pool: string): Promise<Address | null> {
    const poolLc = pool.trim().toLowerCase();
    const row: { gauge?: string }[] = await this.indexerEvents.query(
      `
      SELECT payload->>'gauge' AS gauge
      FROM indexed_events
      WHERE payload->>'type' = 'VoterGaugeCreated'
        AND LOWER(payload->>'pool') = $1
      ORDER BY "createdAt" DESC
      LIMIT 1
    `,
      [poolLc],
    );
    const g = row[0]?.gauge;
    return typeof g === 'string' && ADDR_RE.test(g) ? (getAddress(g) as Address) : null;
  }

  /** Per-gauge LP staked balance for a wallet (post-TGE `Gauge` only; on-chain `balanceOf`). */
  async getUserStakingSummary(userInput: string) {
    const user = this.assertAddr('userAddress', userInput);
    const pairs = await this.listVoterGauges();
    if (pairs.length === 0) {
      return { user, items: [] as { gauge: Address; pool: Address; stakedLp: string }[] };
    }
    const client = this.publicClient();
    const contracts = pairs.map((p) => ({
      address: p.gauge,
      abi: gaugeAbi,
      functionName: 'balanceOf' as const,
      args: [user],
    }));
    const balances = await client.multicall({ contracts, allowFailure: true });
    const items = pairs.map((p, i) => {
      const r = balances[i];
      const bal =
        r.status === 'success' && typeof r.result === 'bigint'
          ? r.result
          : 0n;
      return {
        gauge: p.gauge,
        pool: p.pool,
        stakedLp: bal.toString(),
      };
    });
    return { user, items };
  }

  /**
   * Raw emission / TVL metrics for a pool’s gauge (not USD APY — needs token prices off-chain).
   */
  async getPairRewardMetrics(poolInput: string) {
    const pool = this.assertAddr('poolAddress', poolInput);
    const gauge = await this.resolveGaugeForPool(pool);
    if (!gauge) {
      throw new NotFoundException('No VoterGaugeCreated indexer row for this pool');
    }
    const client = this.publicClient();
    const [rewardRate, totalSupply, periodFinish, stakingToken, rewardToken] =
      await client.multicall({
        contracts: [
          {
            address: gauge,
            abi: gaugeAbi,
            functionName: 'rewardRate',
          },
          {
            address: gauge,
            abi: gaugeAbi,
            functionName: 'totalSupply',
          },
          {
            address: gauge,
            abi: gaugeAbi,
            functionName: 'periodFinish',
          },
          {
            address: gauge,
            abi: gaugeAbi,
            functionName: 'stakingToken',
          },
          {
            address: gauge,
            abi: gaugeAbi,
            functionName: 'rewardToken',
          },
        ],
        allowFailure: true,
      });

    const rr =
      rewardRate.status === 'success' && typeof rewardRate.result === 'bigint'
        ? rewardRate.result
        : 0n;
    const ts =
      totalSupply.status === 'success' && typeof totalSupply.result === 'bigint'
        ? totalSupply.result
        : 0n;
    const pf =
      periodFinish.status === 'success' &&
      typeof periodFinish.result === 'bigint'
        ? periodFinish.result
        : 0n;
    const st =
      stakingToken.status === 'success' &&
      typeof stakingToken.result === 'string'
        ? (stakingToken.result as Address)
        : null;
    const rt =
      rewardToken.status === 'success' &&
      typeof rewardToken.result === 'string'
        ? (rewardToken.result as Address)
        : null;

    /** reward tokens per staked LP token per second (18-decimal style ratio; not USD). */
    const emissionPerStakedLpPerSecond =
      ts > 0n ? (rr * 10n ** 18n) / ts : 0n;
    const emissionPerStakedLpYearScaled =
      emissionPerStakedLpPerSecond * SECONDS_PER_YEAR;

    return {
      pool,
      gauge,
      stakingToken: st,
      rewardToken: rt,
      rewardRate: rr.toString(),
      totalSupply: ts.toString(),
      periodFinish: pf.toString(),
      emissionPerStakedLpPerSecond: emissionPerStakedLpPerSecond.toString(),
      emissionPerStakedLpYearScaled: emissionPerStakedLpYearScaled.toString(),
      note: 'USD APY requires reward-token and LP-token USD prices off-chain.',
    };
  }

  /** `earned` + `rewards` + period boundary per gauge for a user. */
  async getUserRewardSchedule(userInput: string) {
    const user = this.assertAddr('userAddress', userInput);
    const summary = await this.getUserStakingSummary(userInput);
    const client = this.publicClient();
    const items: {
      gauge: Address;
      pool: Address;
      earned: string;
      rewards: string;
      periodFinish: string;
      rewardRate: string;
    }[] = [];
    for (const row of summary.items) {
      const staked = BigInt(row.stakedLp);
      if (staked === 0n) continue;
      const g = row.gauge as Address;
      const [earned, rewards, periodFinish, rewardRate] = await client.multicall({
        contracts: [
          {
            address: g,
            abi: gaugeAbi,
            functionName: 'earned',
            args: [user],
          },
          {
            address: g,
            abi: gaugeAbi,
            functionName: 'rewards',
            args: [user],
          },
          {
            address: g,
            abi: gaugeAbi,
            functionName: 'periodFinish',
          },
          {
            address: g,
            abi: gaugeAbi,
            functionName: 'rewardRate',
          },
        ],
        allowFailure: true,
      });
      items.push({
        gauge: g,
        pool: row.pool,
        earned:
          earned.status === 'success' && typeof earned.result === 'bigint'
            ? earned.result.toString()
            : '0',
        rewards:
          rewards.status === 'success' && typeof rewards.result === 'bigint'
            ? rewards.result.toString()
            : '0',
        periodFinish:
          periodFinish.status === 'success' &&
          typeof periodFinish.result === 'bigint'
            ? periodFinish.result.toString()
            : '0',
        rewardRate:
          rewardRate.status === 'success' &&
          typeof rewardRate.result === 'bigint'
            ? rewardRate.result.toString()
            : '0',
      });
    }
    return { user, items };
  }
}
