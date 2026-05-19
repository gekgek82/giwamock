import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AdminExchangeTimeBucketsResponse } from '@giwater/shared';
import { ExchangeAdminService } from '../../exchange/exchange-admin.service';

@ApiTags('admin-exchange')
@Controller('admin/exchange')
export class AdminExchangeController {
  constructor(private readonly exchange: ExchangeAdminService) {}

  @Get(':protocolId/time-buckets')
  @ApiOperation({ summary: 'Admin: list exchange time buckets (spot_exchange_time_buckets)' })
  @ApiParam({ name: 'protocolId', description: 'Exchange/protocol id (e.g. giwater)' })
  @ApiQuery({ name: 'resolution', required: true, example: '1d' })
  @ApiQuery({ name: 'limit', required: false, example: 90 })
  @ApiOkResponse({ description: '`AdminExchangeTimeBucketsResponse`' })
  async listTimeBuckets(
    @Param('protocolId') protocolId: string,
    @Query('resolution') resolution: string,
    @Query('limit', new DefaultValuePipe(90), ParseIntPipe) limit: number,
  ): Promise<AdminExchangeTimeBucketsResponse> {
    return this.exchange.listExchangeTimeBuckets({ protocolId, resolution, limit });
  }
}

