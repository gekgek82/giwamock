import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { SwapHopsByTransactionResponseDto } from '@giwater/shared';
import { BrokerSwapHopQueryService } from '../swap-hop/broker-swap-hop-query.service';

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

@ApiTags('swaps')
@Controller('swaps')
export class SwapsController {
  constructor(private readonly swapHopQuery: BrokerSwapHopQueryService) {}

  @Get('by-transaction/:transactionHash')
  @ApiOperation({
    summary: 'Swap hop history for one transaction and account',
    description:
      'Reads broker `swap_hops` (materialized after each Swap OHLCV run), matching ' +
      '`transactionHash` and `sender` or recipient (`to`) equal to `account`. Ordered by `hopIndex` then `logIndex`.',
  })
  @ApiParam({
    name: 'transactionHash',
    description: '32-byte transaction hash (0x + 64 hex)',
  })
  @ApiQuery({
    name: 'account',
    required: true,
    description: 'Wallet address (0x + 40 hex)',
  })
  @ApiOkResponse({ description: 'transactionHash, account, and hops[]' })
  async swapHopsByTransaction(
    @Param('transactionHash') transactionHash: string,
    @Query('account') account: string,
  ): Promise<SwapHopsByTransactionResponseDto> {
    const tx = transactionHash?.trim() ?? '';
    const acct = account?.trim() ?? '';
    if (!acct) {
      throw new BadRequestException('Query parameter `account` is required');
    }
    if (!TX_HASH_RE.test(tx)) {
      throw new BadRequestException(
        'transactionHash must be 0x-prefixed 32-byte hex (66 characters)',
      );
    }
    if (!ADDR_RE.test(acct)) {
      throw new BadRequestException(
        'account must be 0x-prefixed 20-byte hex (42 characters)',
      );
    }
    return this.swapHopQuery.listByTransactionAndAccount(tx, acct);
  }
}
