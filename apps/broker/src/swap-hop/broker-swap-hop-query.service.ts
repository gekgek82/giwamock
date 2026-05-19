import type { SwapHopHistoryItemDto, SwapHopsByTransactionResponseDto } from '@giwater/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrokerSwapHopEntity } from '../models/swap/broker-swap-hop.entity';

function entityToDto(row: BrokerSwapHopEntity): SwapHopHistoryItemDto {
  return {
    id: row.id,
    sender: row.sender,
    tokenIn: row.tokenIn,
    tokenOut: row.tokenOut,
    isCL: row.isCL,
    stable: row.stable,
    hopIndex: String(row.hopIndex),
    amountIn: row.amountIn,
    amountOut: row.amountOut,
    feeAmount: row.feeAmount,
    feeToken: row.feeToken,
    to: row.recipient,
    blockNumber: row.blockNumber,
    blockTimestamp: row.blockTimestamp,
    transactionHash: row.transactionHash,
    logIndex: String(row.logIndex),
  };
}

@Injectable()
export class BrokerSwapHopQueryService {
  constructor(
    @InjectRepository(BrokerSwapHopEntity)
    private readonly repo: Repository<BrokerSwapHopEntity>,
  ) {}

  async listByTransactionAndAccount(
    transactionHash: string,
    account: string,
  ): Promise<SwapHopsByTransactionResponseDto> {
    const tx = transactionHash.trim().toLowerCase();
    const acct = account.trim().toLowerCase();

    const rows = await this.repo
      .createQueryBuilder('h')
      .where('h.transactionHash = :tx', { tx })
      .andWhere('(h.sender = :acct OR h.recipient = :acct)', { acct })
      .orderBy('h.hopIndex', 'ASC')
      .addOrderBy('h.logIndex', 'ASC')
      .getMany();

    return {
      transactionHash: tx,
      account: acct,
      hops: rows.map(entityToDto),
    };
  }
}
