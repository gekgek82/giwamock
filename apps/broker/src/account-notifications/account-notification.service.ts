import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  CLLiquidityAddedIndexerBrokerPayload,
  LiquidityAddedIndexerBrokerPayload,
  SwapIndexerBrokerPayload,
} from '@giwater/shared';
import { type QueryDeepPartialEntity, Repository } from 'typeorm';
import { parseWireBigInt } from '../swap-ohlcv/bigint-for-ui';
import { SpotAccountEntity } from '../models/account/spot-account.entity';
import { SpotAccountLiquidityProvisionEntity } from '../models/account/spot-account-liquidity-provision.entity';
import { SpotAccountNotificationEntity } from '../models/account/spot-account-notification.entity';
import { quotedPgColumn } from '../typeorm/quoted-pg-column';

function lc(s: string): string {
  return s.trim().toLowerCase();
}

function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

function uniqWallets(...addrs: (string | undefined)[]): string[] {
  const set = new Set<string>();
  for (const a of addrs) {
    const x = a?.trim();
    if (x && x.startsWith('0x') && x.length === 42) {
      set.add(lc(x));
    }
  }
  return [...set];
}

function swapPayloadBody(p: SwapIndexerBrokerPayload): Record<string, unknown> {
  return {
    tokenIn: lc(p.tokenIn),
    tokenOut: lc(p.tokenOut),
    amountIn: p.amountIn,
    amountOut: p.amountOut,
    transactionHash: p.transactionHash,
    logIndex: p.logIndex,
    isCL: p.isCL,
  };
}

function liquidityPayloadBody(
  p: LiquidityAddedIndexerBrokerPayload | CLLiquidityAddedIndexerBrokerPayload,
): Record<string, unknown> {
  if (p.type === 'LiquidityAdded') {
    return {
      type: p.type,
      token0: lc(p.token0),
      token1: lc(p.token1),
      stable: p.stable,
      amount0: p.amount0,
      amount1: p.amount1,
      liquidity: p.liquidity,
      transactionHash: p.transactionHash,
      logIndex: p.logIndex,
    };
  }
  return {
    type: p.type,
    token0: lc(p.token0),
    token1: lc(p.token1),
    tickSpacing: p.tickSpacing,
    tickLower: p.tickLower,
    tickUpper: p.tickUpper,
    liquidity: p.liquidity,
    amount0: p.amount0,
    amount1: p.amount1,
    transactionHash: p.transactionHash,
    logIndex: p.logIndex,
  };
}

@Injectable()
export class AccountNotificationService {
  constructor(
    @InjectRepository(SpotAccountNotificationEntity)
    private readonly notifRepo: Repository<SpotAccountNotificationEntity>,
    @InjectRepository(SpotAccountLiquidityProvisionEntity)
    private readonly liqProvisionRepo: Repository<SpotAccountLiquidityProvisionEntity>,
    @InjectRepository(SpotAccountEntity)
    private readonly accountRepo: Repository<SpotAccountEntity>,
  ) {}

  /**
   * Inserts one row per wallet (`sender`, `to` deduped). Trade volume stats apply to `sender` only.
   */
  async recordSwap(args: {
    payload: SwapIndexerBrokerPayload;
    blockTsSec: number;
    volumeUsd: number;
  }): Promise<void> {
    const { payload, blockTsSec, volumeUsd } = args;
    const sender = lc(payload.sender);
    const recipients = uniqWallets(payload.sender, payload.to);
    const body = swapPayloadBody(payload);

    for (const accountId of recipients) {
      await this.insertNotificationIfNew({
        accountId,
        eventType: 'Swap',
        indexerEventId: payload.id,
        payload: body,
        blockTimestampSec: blockTsSec,
        readAt: null,
      });
    }

    await this.touchSwapSenderStats(sender, blockTsSec, volumeUsd);
  }

  async recordLiquidityAdded(args: {
    poolAddress: string;
    payload: LiquidityAddedIndexerBrokerPayload | CLLiquidityAddedIndexerBrokerPayload;
    blockTsSec: number;
  }): Promise<void> {
    const { poolAddress, payload, blockTsSec } = args;
    const recipients = uniqWallets(payload.sender, payload.to);
    const eventType = payload.type;
    const body = liquidityPayloadBody(payload);

    for (const accountId of recipients) {
      await this.insertNotificationIfNew({
        accountId,
        eventType,
        indexerEventId: payload.id,
        payload: body,
        blockTimestampSec: blockTsSec,
        readAt: null,
      });
      await this.insertLiquidityProvisionIfNew(
        this.liquidityProvisionRow(accountId, poolAddress, blockTsSec, payload),
      );
      await this.touchLastTraded(accountId, blockTsSec);
    }
  }

  private liquidityProvisionRow(
    accountId: string,
    poolAddress: string,
    blockTsSec: number,
    p: LiquidityAddedIndexerBrokerPayload | CLLiquidityAddedIndexerBrokerPayload,
  ): QueryDeepPartialEntity<SpotAccountLiquidityProvisionEntity> {
    const pool = lc(poolAddress);
    const common = {
      accountId,
      poolAddress: pool,
      eventType: p.type,
      indexerEventId: p.id,
      token0: lc(p.token0),
      token1: lc(p.token1),
      amount0: String(p.amount0),
      amount1: String(p.amount1),
      blockNumber: String(p.blockNumber),
      blockTimestampSec: blockTsSec,
      transactionHash: p.transactionHash,
      logIndex: String(p.logIndex),
    };
    if (p.type === 'LiquidityAdded') {
      return {
        ...common,
        stable: p.stable,
        clTickSpacing: null,
        tickLower: null,
        tickUpper: null,
        liquidity: String(p.liquidity),
      };
    }
    const tickSpacing = Number(parseWireBigInt(String(p.tickSpacing)));
    return {
      ...common,
      stable: null,
      clTickSpacing: Number.isFinite(tickSpacing) ? tickSpacing : null,
      tickLower: String(p.tickLower),
      tickUpper: String(p.tickUpper),
      liquidity: String(p.liquidity),
    };
  }

  private async insertLiquidityProvisionIfNew(
    row: QueryDeepPartialEntity<SpotAccountLiquidityProvisionEntity>,
  ): Promise<void> {
    try {
      await this.liqProvisionRepo.insert(row);
    } catch (e) {
      if (isPgUniqueViolation(e)) {
        return;
      }
      throw e;
    }
  }

  private async insertNotificationIfNew(
    row: Pick<
      SpotAccountNotificationEntity,
      | 'accountId'
      | 'eventType'
      | 'indexerEventId'
      | 'payload'
      | 'blockTimestampSec'
      | 'readAt'
    >,
  ): Promise<void> {
    try {
      await this.notifRepo.insert(
        row as QueryDeepPartialEntity<SpotAccountNotificationEntity>,
      );
    } catch (e) {
      if (isPgUniqueViolation(e)) {
        return;
      }
      throw e;
    }
  }

  private async touchLastTraded(accountId: string, blockTsSec: number): Promise<void> {
    await this.accountRepo.upsert({ id: accountId }, ['id']);
    const cLast = quotedPgColumn(this.accountRepo, 'lastTraded');
    await this.accountRepo
      .createQueryBuilder()
      .update(SpotAccountEntity)
      .set({
        lastTraded: () => `GREATEST(COALESCE(${cLast}, 0), ${blockTsSec})`,
      })
      .where('id = :id', { id: accountId })
      .execute();
  }

  private async touchSwapSenderStats(
    sender: string,
    blockTsSec: number,
    volumeUsd: number,
  ): Promise<void> {
    await this.accountRepo.upsert({ id: sender }, ['id']);
    const safeVolume = Number.isFinite(volumeUsd) ? volumeUsd : 0;
    const cLast = quotedPgColumn(this.accountRepo, 'lastTraded');
    const cHist = quotedPgColumn(this.accountRepo, 'totalTradeHistory');
    const cVol = quotedPgColumn(this.accountRepo, 'totalVolumeUSD');
    await this.accountRepo
      .createQueryBuilder()
      .update(SpotAccountEntity)
      .set({
        lastTraded: () => `GREATEST(COALESCE(${cLast}, 0), ${blockTsSec})`,
        totalTradeHistory: () => `COALESCE(${cHist}, 0) + 1`,
        totalVolumeUSD: () => `COALESCE(${cVol}, 0) + ${safeVolume}`,
      })
      .where('id = :id', { id: sender })
      .execute();
  }
}
