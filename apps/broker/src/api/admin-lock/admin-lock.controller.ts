import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminLockService } from './admin-lock.service';
import type { AdminLockStatsDto, AdminLockEventsDto, AdminLockByEpochDto } from '@giwater/shared';

@ApiTags('admin-lock')
@Controller('admin/lock')
export class AdminLockController {
  constructor(private readonly lockService: AdminLockService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Admin: lock stats (total locked, active positions, avg duration)' })
  @ApiQuery({ name: 'pool', required: false, description: 'Filter by pool address' })
  async getStats(@Query('pool') pool?: string): Promise<AdminLockStatsDto> {
    return this.lockService.getStats(pool);
  }

  @Get('events')
  @ApiOperation({ summary: 'Admin: recent ve_lock_events' })
  @ApiQuery({ name: 'pool', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getEvents(
    @Query('pool') pool?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ): Promise<AdminLockEventsDto> {
    return this.lockService.getEvents(
      pool,
      limitRaw ? Number(limitRaw) : 20,
      offsetRaw ? Number(offsetRaw) : 0,
    );
  }

  @Get('by-epoch')
  @ApiOperation({ summary: 'Admin: total locked per epoch (bar chart data)' })
  @ApiQuery({ name: 'pool', required: false })
  @ApiQuery({ name: 'epochs', required: false, type: Number, description: 'Number of epochs to return (default 8)' })
  async getByEpoch(
    @Query('pool') pool?: string,
    @Query('epochs') epochsRaw?: string,
  ): Promise<AdminLockByEpochDto> {
    return this.lockService.getByEpoch(pool, epochsRaw ? Number(epochsRaw) : 8);
  }
}
