import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  WalletStakeEventDto,
  WalletStakePositionDto,
  WalletStakePositionsResponseDto,
} from '@giwater/shared';
import type { DataSource } from 'typeorm';

@Injectable()
export class SpotAccountStakeService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getStakePositions(walletAddress: string): Promise<WalletStakePositionsResponseDto> {
    const wallet = walletAddress.toLowerCase();

    const rows: Array<{
      id: string;
      poolAddress: string;
      gaugeAddress: string;
      isCL: boolean;
      eventType: string;
      amount: string;
      tokenId: string | null;
      blockTimestampSec: number;
      transactionHash: string;
    }> = await this.dataSource.query(
      `SELECT id,
              "poolAddress",
              "gaugeAddress",
              "isCL",
              "eventType",
              amount::text,
              "tokenId"::text,
              "blockTimestampSec",
              "transactionHash"
       FROM spot_account_stake_events
       WHERE "walletAddress" = $1
       ORDER BY "blockTimestampSec" ASC, "logIndex" ASC`,
      [wallet],
    );

    const positionMap = new Map<
      string,
      { poolAddress: string; gaugeAddress: string; isCL: boolean; netAmount: bigint; lastActivityAt: number; events: WalletStakeEventDto[] }
    >();

    for (const row of rows) {
      const key = row.gaugeAddress.toLowerCase();
      if (!positionMap.has(key)) {
        positionMap.set(key, {
          poolAddress: row.poolAddress.toLowerCase(),
          gaugeAddress: row.gaugeAddress.toLowerCase(),
          isCL: row.isCL,
          netAmount: 0n,
          lastActivityAt: 0,
          events: [],
        });
      }
      const pos = positionMap.get(key)!;
      const amt = BigInt(row.amount ?? '0');
      pos.netAmount = row.eventType === 'deposit' ? pos.netAmount + amt : pos.netAmount - amt;
      if (row.blockTimestampSec > pos.lastActivityAt) {
        pos.lastActivityAt = row.blockTimestampSec;
      }
      pos.events.push({
        id: row.id,
        poolAddress: row.poolAddress.toLowerCase(),
        gaugeAddress: row.gaugeAddress.toLowerCase(),
        isCL: row.isCL,
        eventType: row.eventType as 'deposit' | 'withdraw',
        amount: row.amount,
        tokenId: row.tokenId ?? null,
        blockTimestampSec: row.blockTimestampSec,
        transactionHash: row.transactionHash,
      });
    }

    const positions: WalletStakePositionDto[] = Array.from(positionMap.values())
      .filter((p) => p.netAmount > 0n)
      .map((p) => ({
        poolAddress: p.poolAddress,
        gaugeAddress: p.gaugeAddress,
        isCL: p.isCL,
        netAmount: p.netAmount.toString(),
        lastActivityAt: p.lastActivityAt,
        events: p.events,
      }));

    return { positions, total: positions.length };
  }
}
