import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { IndexerEventPersistenceService } from '../indexer-events/indexer-event-persistence.service';

class IndexedEventRecordDto {
  @ApiProperty({
    description: 'Unique indexed event id from amm-indexer',
    example:
      '177615549300000000000000010000000022810377000000000000000650000000000000005',
  })
  id!: string;

  @ApiProperty({
    description: 'Original JSON payload received from RabbitMQ',
    type: 'object',
    additionalProperties: true,
  })
  payload!: object;

  @ApiProperty({
    description: 'Broker DB insertion timestamp',
    example: '2026-04-16T06:11:10.123Z',
  })
  createdAt!: Date;
}

class IndexedEventsPageDto {
  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 2450 })
  total!: number;

  @ApiProperty({ type: [IndexedEventRecordDto] })
  items!: IndexedEventRecordDto[];
}

@ApiTags('indexed-events')
@Controller('indexed-events')
export class IndexedEventsController {
  constructor(private readonly persistence: IndexerEventPersistenceService) {}

  @Get()
  @ApiOperation({
    summary: 'List most recent indexed events',
    description:
      'Returns indexed events ordered by newest first, with offset-based pagination.',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of rows to skip (default: 0)',
    example: 0,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size (default: 50, max: 200)',
    example: 50,
  })
  @ApiOkResponse({
    description: 'Paginated indexed events list',
    type: IndexedEventsPageDto,
  })
  async getIndexedEvents(
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const safeOffset = Math.max(0, offset);
    const safeLimit = Math.min(200, Math.max(1, limit));

    return this.persistence.getRecentIndexedEvents(safeOffset, safeLimit);
  }
}
