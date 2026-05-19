import type {
  VoterVotedIndexerBrokerPayload,
  VoterAbstainedIndexerBrokerPayload,
  FeeVotingRewardClaimIndexerBrokerPayload,
  BribeVotingRewardClaimIndexerBrokerPayload,
} from '@giwater/shared';
import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';

const logger = new Logger('VotingAggregator');

export async function aggregateVoterVoted(
  payload: VoterVotedIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, voter, pool, tokenId, weight, totalWeight, epochTimestamp, blockNumber, blockTimestamp, transactionHash } = payload;
  const owner = voter.toLowerCase();
  const poolLc = pool.toLowerCase();

  await dataSource.query(
    `INSERT INTO voter_vote_positions ("tokenId","pool","owner","weight","totalWeight","epochTimestamp","isActive")
     VALUES ($1,$2,$3,$4,$5,$6,true)
     ON CONFLICT ("tokenId","pool") DO UPDATE
       SET owner=$3, weight=$4, "totalWeight"=$5, "epochTimestamp"=$6, "isActive"=true, "updatedAt"=NOW()`,
    [tokenId, poolLc, owner, weight, totalWeight, epochTimestamp],
  );

  await dataSource.query(
    `INSERT INTO voter_vote_events
       ("tokenId","pool","owner","eventType","weight","totalWeight","epochTimestamp",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ($1,$2,$3,'voted',$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [tokenId, poolLc, owner, weight, totalWeight, epochTimestamp, id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  logger.debug(`VoterVoted tokenId=${tokenId} pool=${poolLc} owner=${owner}`);
}

export async function aggregateVoterAbstained(
  payload: VoterAbstainedIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, voter, pool, tokenId, weight, totalWeight, epochTimestamp, blockNumber, blockTimestamp, transactionHash } = payload;
  const owner = voter.toLowerCase();
  const poolLc = pool.toLowerCase();

  await dataSource.query(
    `UPDATE voter_vote_positions SET weight='0', "isActive"=false, "updatedAt"=NOW()
     WHERE "tokenId"=$1 AND pool=$2`,
    [tokenId, poolLc],
  );

  await dataSource.query(
    `INSERT INTO voter_vote_events
       ("tokenId","pool","owner","eventType","weight","totalWeight","epochTimestamp",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ($1,$2,$3,'abstained',$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [tokenId, poolLc, owner, weight, totalWeight, epochTimestamp, id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  logger.debug(`VoterAbstained tokenId=${tokenId} pool=${poolLc}`);
}

export async function aggregateFeeVotingRewardClaim(
  payload: FeeVotingRewardClaimIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, from, reward, amount, rewardContract, blockNumber, blockTimestamp, transactionHash } = payload;

  const poolRows: { pool?: string }[] = await dataSource.query(
    `SELECT payload->>'pool' AS pool
     FROM indexed_events
     WHERE payload->>'type' = 'VoterGaugeCreated'
       AND LOWER(payload->>'feeVotingReward') = $1
     LIMIT 1`,
    [rewardContract.toLowerCase()],
  );
  const pool = poolRows[0]?.pool ?? null;

  await dataSource.query(
    `INSERT INTO voter_reward_claims
       ("claimType","rewardContract","rewardToken","from","amount","pool",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ('fee',$1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [rewardContract.toLowerCase(), reward.toLowerCase(), from.toLowerCase(), amount, pool,
     id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  logger.debug(`FeeVotingRewardClaim from=${from} reward=${reward} amount=${amount}`);
}

export async function aggregateBribeVotingRewardClaim(
  payload: BribeVotingRewardClaimIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, from, reward, amount, rewardContract, blockNumber, blockTimestamp, transactionHash } = payload;

  const poolRows: { pool?: string }[] = await dataSource.query(
    `SELECT payload->>'pool' AS pool
     FROM indexed_events
     WHERE payload->>'type' = 'VoterGaugeCreated'
       AND LOWER(payload->>'bribeVotingReward') = $1
     LIMIT 1`,
    [rewardContract.toLowerCase()],
  );
  const pool = poolRows[0]?.pool ?? null;

  await dataSource.query(
    `INSERT INTO voter_reward_claims
       ("claimType","rewardContract","rewardToken","from","amount","pool",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ('bribe',$1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [rewardContract.toLowerCase(), reward.toLowerCase(), from.toLowerCase(), amount, pool,
     id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  logger.debug(`BribeVotingRewardClaim from=${from} reward=${reward} amount=${amount}`);
}
