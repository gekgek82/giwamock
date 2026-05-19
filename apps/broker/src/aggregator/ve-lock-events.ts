import type {
  VeDepositIndexerBrokerPayload,
  VeWithdrawIndexerBrokerPayload,
  VeLockPermanentIndexerBrokerPayload,
  VeUnlockPermanentIndexerBrokerPayload,
  VeMergeIndexerBrokerPayload,
  VeSplitIndexerBrokerPayload,
} from '@giwater/shared';
import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';

const logger = new Logger('VeLockAggregator');

const CREATE_LOCK_TYPE = '1';
const INCREASE_LOCK_AMOUNT = '2';
const INCREASE_UNLOCK_TIME = '3';

export async function aggregateVeDeposit(
  payload: VeDepositIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, provider, tokenId, depositType, value, locktime, blockNumber, blockTimestamp, transactionHash } = payload;
  const owner = provider.toLowerCase();

  await dataSource.query(
    `INSERT INTO ve_lock_events
       ("tokenId","owner","eventType","depositType","value","lockEnd","fromTokenId","toTokenId",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ($1,$2,'Deposit',$3,$4,$5,NULL,NULL,$6,$7,$8,$9)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [
      tokenId, owner, depositType, value,
      depositType === INCREASE_UNLOCK_TIME ? locktime : null,
      id, blockNumber, blockTimestamp, transactionHash.toLowerCase(),
    ],
  );

  if (depositType === CREATE_LOCK_TYPE) {
    await dataSource.query(
      `INSERT INTO ve_lock_positions ("tokenId","owner","amount","lockEnd","isPermanent","isActive")
       VALUES ($1,$2,$3,$4,false,true)
       ON CONFLICT ("tokenId") DO NOTHING`,
      [tokenId, owner, value, locktime],
    );
  } else if (depositType === INCREASE_LOCK_AMOUNT || depositType === '0') {
    await dataSource.query(
      `UPDATE ve_lock_positions
       SET amount = (CAST(amount AS NUMERIC) + CAST($1 AS NUMERIC))::TEXT, "updatedAt" = NOW()
       WHERE "tokenId" = $2`,
      [value, tokenId],
    );
  } else if (depositType === INCREASE_UNLOCK_TIME) {
    await dataSource.query(
      `UPDATE ve_lock_positions SET "lockEnd" = $1, "updatedAt" = NOW() WHERE "tokenId" = $2`,
      [locktime, tokenId],
    );
  }

  logger.debug(`VeDeposit tokenId=${tokenId} owner=${owner} depositType=${depositType}`);
}

export async function aggregateVeWithdraw(
  payload: VeWithdrawIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, provider, tokenId, value, blockNumber, blockTimestamp, transactionHash } = payload;
  const owner = provider.toLowerCase();

  await dataSource.query(
    `INSERT INTO ve_lock_events
       ("tokenId","owner","eventType","depositType","value","lockEnd","fromTokenId","toTokenId",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ($1,$2,'Withdraw',NULL,$3,NULL,NULL,NULL,$4,$5,$6,$7)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [tokenId, owner, value, id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  await dataSource.query(
    `UPDATE ve_lock_positions SET "isActive" = false, amount = '0', "updatedAt" = NOW() WHERE "tokenId" = $1`,
    [tokenId],
  );

  logger.debug(`VeWithdraw tokenId=${tokenId} owner=${owner}`);
}

export async function aggregateVeLockPermanent(
  payload: VeLockPermanentIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, owner, tokenId, amount, blockNumber, blockTimestamp, transactionHash } = payload;
  const ownerLc = owner.toLowerCase();

  await dataSource.query(
    `INSERT INTO ve_lock_events
       ("tokenId","owner","eventType","depositType","value","lockEnd","fromTokenId","toTokenId",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ($1,$2,'LockPermanent',NULL,$3,NULL,NULL,NULL,$4,$5,$6,$7)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [tokenId, ownerLc, amount, id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  await dataSource.query(
    `UPDATE ve_lock_positions SET "isPermanent" = true, "lockEnd" = NULL, "updatedAt" = NOW() WHERE "tokenId" = $1`,
    [tokenId],
  );

  logger.debug(`VeLockPermanent tokenId=${tokenId}`);
}

export async function aggregateVeUnlockPermanent(
  payload: VeUnlockPermanentIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, owner, tokenId, amount, blockNumber, blockTimestamp, transactionHash } = payload;
  const ownerLc = owner.toLowerCase();

  await dataSource.query(
    `INSERT INTO ve_lock_events
       ("tokenId","owner","eventType","depositType","value","lockEnd","fromTokenId","toTokenId",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ($1,$2,'UnlockPermanent',NULL,$3,NULL,NULL,NULL,$4,$5,$6,$7)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [tokenId, ownerLc, amount, id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  await dataSource.query(
    `UPDATE ve_lock_positions SET "isPermanent" = false, "updatedAt" = NOW() WHERE "tokenId" = $1`,
    [tokenId],
  );

  logger.debug(`VeUnlockPermanent tokenId=${tokenId}`);
}

export async function aggregateVeMerge(
  payload: VeMergeIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, sender, from, to, amountFinal, locktime, blockNumber, blockTimestamp, transactionHash } = payload;
  const ownerLc = sender.toLowerCase();

  // Event row: tokenId=from (burned token), fromTokenId=from, toTokenId=to
  await dataSource.query(
    `INSERT INTO ve_lock_events
       ("tokenId","owner","eventType","depositType","value","lockEnd","fromTokenId","toTokenId",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ($1,$2,'Merge',NULL,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [from, ownerLc, amountFinal, locktime, from, to, id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  await dataSource.query(
    `UPDATE ve_lock_positions SET "isActive" = false, amount = '0', "updatedAt" = NOW() WHERE "tokenId" = $1`,
    [from],
  );
  await dataSource.query(
    `UPDATE ve_lock_positions SET amount = $1, "lockEnd" = $2, "updatedAt" = NOW() WHERE "tokenId" = $3`,
    [amountFinal, locktime, to],
  );

  logger.debug(`VeMerge from=${from} to=${to} amountFinal=${amountFinal}`);
}

export async function aggregateVeSplit(
  payload: VeSplitIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { id, from, tokenId1, tokenId2, sender, splitAmount1, splitAmount2, locktime, blockNumber, blockTimestamp, transactionHash } = payload;
  const ownerLc = sender.toLowerCase();

  // Event row: tokenId=from (burned), fromTokenId=tokenId1, toTokenId=tokenId2
  await dataSource.query(
    `INSERT INTO ve_lock_events
       ("tokenId","owner","eventType","depositType","value","lockEnd","fromTokenId","toTokenId",
        "indexerEventId","blockNumber","blockTimestamp","transactionHash")
     VALUES ($1,$2,'Split',NULL,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT ("indexerEventId") DO NOTHING`,
    [from, ownerLc, splitAmount1, locktime, tokenId1, tokenId2, id, blockNumber, blockTimestamp, transactionHash.toLowerCase()],
  );

  await dataSource.query(
    `UPDATE ve_lock_positions SET "isActive" = false, amount = '0', "updatedAt" = NOW() WHERE "tokenId" = $1`,
    [from],
  );
  await dataSource.query(
    `INSERT INTO ve_lock_positions ("tokenId","owner","amount","lockEnd","isPermanent","isActive")
     VALUES ($1,$2,$3,$4,false,true)
     ON CONFLICT ("tokenId") DO UPDATE SET amount=$3,"lockEnd"=$4,"isActive"=true,"updatedAt"=NOW()`,
    [tokenId1, ownerLc, splitAmount1, locktime],
  );
  await dataSource.query(
    `INSERT INTO ve_lock_positions ("tokenId","owner","amount","lockEnd","isPermanent","isActive")
     VALUES ($1,$2,$3,$4,false,true)
     ON CONFLICT ("tokenId") DO UPDATE SET amount=$3,"lockEnd"=$4,"isActive"=true,"updatedAt"=NOW()`,
    [tokenId2, ownerLc, splitAmount2, locktime],
  );

  logger.debug(`VeSplit from=${from} tokenId1=${tokenId1} tokenId2=${tokenId2}`);
}
