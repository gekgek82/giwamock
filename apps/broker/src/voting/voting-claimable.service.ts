import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BribeVotingRewardAbi, FeesVotingRewardAbi } from '@giwater/shared';
import {
  createPublicClient,
  defineChain,
  getAddress,
  http,
  type Abi,
  type Address,
} from 'viem';
import { VoterVotePositionEntity } from '../models/voting/voter-vote-position.entity';
import { IndexerIngestedEventEntity } from '../models/indexer-ingested-event.entity';

const feeRewardAbi = FeesVotingRewardAbi as Abi;
const bribeRewardAbi = BribeVotingRewardAbi as Abi;

function giwaChain(rpcUrl: string) {
  return defineChain({
    id: 91342,
    name: 'Giwa Sepolia',
    nativeCurrency: { name: 'GIWA', symbol: 'GIWA', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

@Injectable()
export class VotingClaimableService {
  constructor(
    @InjectRepository(VoterVotePositionEntity)
    private readonly positions: Repository<VoterVotePositionEntity>,
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
        'Set GIWA_SEPOLIA_RPC_URL or PONDER_RPC_URL_1 for on-chain reward reads',
      );
    }
    return url;
  }

  private publicClient() {
    const url = this.requireRpcUrl();
    return createPublicClient({ chain: giwaChain(url), transport: http(url) });
  }

  async getClaimableByTokenId(tokenIdInput: string): Promise<
    {
      pool: string;
      rewardContract: string;
      claimType: 'fee' | 'bribe';
      rewardToken: string;
      earned: string;
    }[]
  > {
    const tokenId = tokenIdInput.trim();
    if (!tokenId || isNaN(Number(tokenId))) {
      throw new BadRequestException('tokenId must be a decimal integer string');
    }

    const activePools = await this.positions.find({
      where: { tokenId, isActive: true },
    });
    if (activePools.length === 0) return [];

    const poolAddresses = activePools.map((p) => p.pool.toLowerCase());

    const rows: { pool: string; feeVotingReward: string; bribeVotingReward: string }[] =
      await this.indexerEvents.query(
        `SELECT payload->>'pool' AS pool,
                payload->>'feeVotingReward' AS "feeVotingReward",
                payload->>'bribeVotingReward' AS "bribeVotingReward"
         FROM indexed_events
         WHERE payload->>'type' = 'VoterGaugeCreated'
           AND LOWER(payload->>'pool') = ANY($1)`,
        [poolAddresses],
      );

    const client = this.publicClient();
    const results: {
      pool: string;
      rewardContract: string;
      claimType: 'fee' | 'bribe';
      rewardToken: string;
      earned: string;
    }[] = [];

    for (const row of rows) {
      const contracts: { address: Address; abi: Abi; claimType: 'fee' | 'bribe' }[] = [];
      if (row.feeVotingReward && /^0x[a-fA-F0-9]{40}$/.test(row.feeVotingReward)) {
        contracts.push({
          address: getAddress(row.feeVotingReward) as Address,
          abi: feeRewardAbi,
          claimType: 'fee',
        });
      }
      if (row.bribeVotingReward && /^0x[a-fA-F0-9]{40}$/.test(row.bribeVotingReward)) {
        contracts.push({
          address: getAddress(row.bribeVotingReward) as Address,
          abi: bribeRewardAbi,
          claimType: 'bribe',
        });
      }

      for (const { address, abi, claimType } of contracts) {
        const [lenResult] = await client.multicall({
          contracts: [{ address, abi, functionName: 'rewardsListLength' }],
          allowFailure: true,
        });
        const len =
          lenResult.status === 'success' && typeof lenResult.result === 'bigint'
            ? Number(lenResult.result)
            : 0;
        if (len === 0) continue;

        const tokenCalls = Array.from({ length: len }, (_, i) => ({
          address,
          abi,
          functionName: 'rewards' as const,
          args: [BigInt(i)] as const,
        }));
        const tokenResults = await client.multicall({ contracts: tokenCalls, allowFailure: true });

        const rewardTokens: Address[] = tokenResults
          .filter((r) => r.status === 'success' && typeof r.result === 'string')
          .map((r) => getAddress(r.result as string) as Address);

        if (rewardTokens.length === 0) continue;

        const earnedCalls = rewardTokens.map((token) => ({
          address,
          abi,
          functionName: 'earned' as const,
          args: [token, BigInt(tokenId)] as const,
        }));
        const earnedResults = await client.multicall({ contracts: earnedCalls, allowFailure: true });

        rewardTokens.forEach((token, i) => {
          const r = earnedResults[i];
          const earned =
            r.status === 'success' && typeof r.result === 'bigint' ? r.result : 0n;
          results.push({
            pool: row.pool,
            rewardContract: address,
            claimType,
            rewardToken: token,
            earned: earned.toString(),
          });
        });
      }
    }

    return results;
  }
}
