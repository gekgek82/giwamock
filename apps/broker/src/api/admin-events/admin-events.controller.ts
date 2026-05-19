import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { BlockchainEventItem, BlockchainEventListResponse, EventCategory } from '@giwater/shared';
import { IndexerEventPersistenceService } from '../../indexer-events/indexer-event-persistence.service';
import { IndexerIngestedEventEntity } from '../../models/indexer-ingested-event.entity';

function blockTimestampToIso(ts: string | undefined): string {
  if (!ts) return new Date(0).toISOString();
  return new Date(parseInt(ts, 10) * 1000).toISOString();
}

function deriveCategory(type: string): EventCategory {
  if (type.startsWith('CL') && type.includes('Gauge')) return 'CL_GAUGE';
  if (type.includes('Gauge')) return 'GAUGE';
  if (type.startsWith('CL')) return 'CL_POOL';
  if (type.startsWith('Ve')) return 'VE';
  if (type.startsWith('Voter')) return 'VOTER';
  if (type.includes('NFT') || type.includes('Position')) return 'NFT_POSITION';
  if (type.startsWith('Minter')) return 'MINTER';
  if (type.includes('Distributor')) return 'REWARDS_DISTRIBUTOR';
  if (type.includes('Reward') || type.includes('Claim')) return 'REWARD';
  return 'POOL';
}

function mapToEventItem(entity: IndexerIngestedEventEntity): BlockchainEventItem {
  const p = entity.payload as Record<string, unknown>;
  const type = typeof p.type === 'string' ? p.type : 'UNKNOWN';
  const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

  return {
    id: entity.id,
    txHash: str(p.transactionHash) ?? '',
    logIndex: parseInt(String(p.logIndex ?? '0'), 10),
    blockNumber: str(p.blockNumber) ?? '',
    blockTimestamp: blockTimestampToIso(str(p.blockTimestamp) ?? undefined),
    category: deriveCategory(type),
    eventType: type,
    poolType: type.startsWith('CL') ? 'CL' : null,
    contractAddress: str(p.pool) ?? str(p.registry) ?? str(p.voter) ?? str(p.feeManager) ?? '',
    poolAddress: str(p.pool),
    userAddress: str(p.sender) ?? str(p.to) ?? null,
    amount0: str(p.amount0) ?? str(p.amountIn) ?? null,
    amount1: str(p.amount1) ?? str(p.amountOut) ?? null,
    amountUsd: null,
    createdAt: entity.createdAt.toISOString(),
  };
}

@ApiTags('admin-events')
@Controller('admin/events')
export class AdminEventsController {
  constructor(private readonly persistence: IndexerEventPersistenceService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: list indexed blockchain events with pagination' })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiOkResponse({ description: 'Paginated blockchain events' })
  async getEvents(
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<BlockchainEventListResponse> {
    const safeOffset = Math.max(0, offset);
    const safeLimit = Math.min(200, Math.max(1, limit));
    const result = await this.persistence.getRecentIndexedEvents(safeOffset, safeLimit);
    return {
      events: result.items.map(mapToEventItem),
      pagination: { total: result.total, limit: result.limit, offset: result.offset },
    };
  }
}
