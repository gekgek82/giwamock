import type {
  CLGaugeDepositIndexerBrokerPayload,
  CLGaugeWithdrawIndexerBrokerPayload,
  GaugeDepositIndexerBrokerPayload,
  GaugeWithdrawIndexerBrokerPayload,
} from '@giwater/shared';
import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';

const logger = new Logger('GaugeStakeAggregator');

export async function aggregateGaugeDeposit(
  payload: GaugeDepositIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { gauge, pool, from, amount, blockNumber, blockTimestamp, transactionHash, logIndex } =
    payload;
  await dataSource.query(
    `INSERT INTO spot_account_stake_events
       ("walletAddress","gaugeAddress","poolAddress","isCL","eventType",amount,"tokenId",
        "blockNumber","blockTimestampSec","transactionHash","logIndex")
     VALUES ($1,$2,$3,false,'deposit',$4,NULL,$5,$6,$7,$8)
     ON CONFLICT ("transactionHash","logIndex") DO NOTHING`,
    [
      from.toLowerCase(),
      gauge.toLowerCase(),
      pool.toLowerCase(),
      amount,
      blockNumber,
      Math.floor(Number(blockTimestamp)),
      transactionHash.toLowerCase(),
      Number(logIndex),
    ],
  );
  logger.debug(`GaugeDeposit gauge=${gauge} from=${from} amount=${amount}`);
}

export async function aggregateGaugeWithdraw(
  payload: GaugeWithdrawIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const { gauge, pool, from, amount, blockNumber, blockTimestamp, transactionHash, logIndex } =
    payload;
  await dataSource.query(
    `INSERT INTO spot_account_stake_events
       ("walletAddress","gaugeAddress","poolAddress","isCL","eventType",amount,"tokenId",
        "blockNumber","blockTimestampSec","transactionHash","logIndex")
     VALUES ($1,$2,$3,false,'withdraw',$4,NULL,$5,$6,$7,$8)
     ON CONFLICT ("transactionHash","logIndex") DO NOTHING`,
    [
      from.toLowerCase(),
      gauge.toLowerCase(),
      pool.toLowerCase(),
      amount,
      blockNumber,
      Math.floor(Number(blockTimestamp)),
      transactionHash.toLowerCase(),
      Number(logIndex),
    ],
  );
  logger.debug(`GaugeWithdraw gauge=${gauge} from=${from} amount=${amount}`);
}

export async function aggregateCLGaugeDeposit(
  payload: CLGaugeDepositIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const {
    gauge, pool, user, tokenId, liquidityToStake,
    blockNumber, blockTimestamp, transactionHash, logIndex,
  } = payload;
  await dataSource.query(
    `INSERT INTO spot_account_stake_events
       ("walletAddress","gaugeAddress","poolAddress","isCL","eventType",amount,"tokenId",
        "blockNumber","blockTimestampSec","transactionHash","logIndex")
     VALUES ($1,$2,$3,true,'deposit',$4,$5,$6,$7,$8,$9)
     ON CONFLICT ("transactionHash","logIndex") DO NOTHING`,
    [
      user.toLowerCase(),
      gauge.toLowerCase(),
      pool.toLowerCase(),
      liquidityToStake,
      tokenId,
      blockNumber,
      Math.floor(Number(blockTimestamp)),
      transactionHash.toLowerCase(),
      Number(logIndex),
    ],
  );
  logger.debug(`CLGaugeDeposit gauge=${gauge} user=${user} tokenId=${tokenId}`);
}

export async function aggregateCLGaugeWithdraw(
  payload: CLGaugeWithdrawIndexerBrokerPayload,
  dataSource: DataSource,
): Promise<void> {
  const {
    gauge, pool, user, tokenId, liquidityToStake,
    blockNumber, blockTimestamp, transactionHash, logIndex,
  } = payload;
  await dataSource.query(
    `INSERT INTO spot_account_stake_events
       ("walletAddress","gaugeAddress","poolAddress","isCL","eventType",amount,"tokenId",
        "blockNumber","blockTimestampSec","transactionHash","logIndex")
     VALUES ($1,$2,$3,true,'withdraw',$4,$5,$6,$7,$8,$9)
     ON CONFLICT ("transactionHash","logIndex") DO NOTHING`,
    [
      user.toLowerCase(),
      gauge.toLowerCase(),
      pool.toLowerCase(),
      liquidityToStake,
      tokenId,
      blockNumber,
      Math.floor(Number(blockTimestamp)),
      transactionHash.toLowerCase(),
      Number(logIndex),
    ],
  );
  logger.debug(`CLGaugeWithdraw gauge=${gauge} user=${user} tokenId=${tokenId}`);
}
