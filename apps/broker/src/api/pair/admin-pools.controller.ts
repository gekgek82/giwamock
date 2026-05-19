import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Query,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type {
  AdminPoolDetailInfo,
  AdminPoolInfo,
  AdminPoolTimeBucketsResponse,
  PoolListResponse,
  UpdatePoolGradeRequest,
  UpdatePoolListedRequest,
  UpdatePoolVotingRequest,
} from '@giwater/shared';
import { PoolAdminService } from '../../spot-catalog/pool-admin.service';

@ApiTags('admin-pools')
@Controller('admin/pool')
export class AdminPoolsController {
  constructor(private readonly pools: PoolAdminService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: list pools (spot_pairs) with voting/grade meta' })
  @ApiOkResponse({ description: '`PoolListResponse`' })
  async list(): Promise<PoolListResponse> {
    return this.pools.listPools();
  }

  @Get(':address')
  @ApiOperation({ summary: 'Admin: get pool details (meta + stats placeholder)' })
  @ApiParam({ name: 'address', description: 'Pool contract address' })
  async get(@Param('address') address: string): Promise<AdminPoolDetailInfo> {
    return this.pools.getPool(address);
  }

  @Get(':address/time-buckets')
  @ApiOperation({ summary: 'Admin: list pool time buckets (spot_pair_time_buckets)' })
  @ApiParam({ name: 'address', description: 'Pool contract address' })
  @ApiOkResponse({ description: '`AdminPoolTimeBucketsResponse`' })
  async listTimeBuckets(
    @Param('address') address: string,
    @Query('resolution') resolution?: string,
    @Query('limit') limitRaw?: string,
  ): Promise<AdminPoolTimeBucketsResponse> {
    const limit = limitRaw ? Number(limitRaw) : 200;
    return this.pools.listPoolTimeBuckets({
      address,
      resolution: resolution ?? '',
      limit,
    });
  }

  @Post(':address/refresh-stats')
  @HttpCode(200)
  @ApiOperation({ summary: 'Admin: refresh pool stats (no-op placeholder)' })
  async refreshStats(@Param('address') address: string): Promise<AdminPoolDetailInfo> {
    // Broker does not currently maintain on-chain stats; return current view.
    return this.pools.getPool(address);
  }

  @Put(':address/voting')
  @ApiOperation({ summary: 'Admin: set pool voting enabled flag' })
  @ApiParam({ name: 'address', description: 'Pool contract address' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['isVotingEnabled'],
      properties: { isVotingEnabled: { type: 'boolean', example: true } },
    },
  })
  async setVoting(
    @Param('address') address: string,
    @Body() body: UpdatePoolVotingRequest,
  ): Promise<AdminPoolInfo> {
    if (typeof body?.isVotingEnabled !== 'boolean') {
      throw new BadRequestException('body.isVotingEnabled must be a boolean');
    }
    return this.pools.setVoting(address, body.isVotingEnabled);
  }

  @Put(':address/listed')
  @ApiOperation({ summary: 'Admin: set pool listed flag (public catalog visibility)' })
  @ApiParam({ name: 'address', description: 'Pool contract address' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['listed'],
      properties: { listed: { type: 'boolean', example: true } },
    },
  })
  async setListed(
    @Param('address') address: string,
    @Body() body: UpdatePoolListedRequest,
  ): Promise<AdminPoolInfo> {
    if (typeof body?.listed !== 'boolean') {
      throw new BadRequestException('body.listed must be a boolean');
    }
    return this.pools.setListed(address, body.listed);
  }

  @Put(':address/grade')
  @ApiOperation({ summary: 'Admin: set pool grade and manual override flag' })
  @ApiParam({ name: 'address', description: 'Pool contract address' })
  async setGrade(
    @Param('address') address: string,
    @Body() body: UpdatePoolGradeRequest,
  ): Promise<AdminPoolInfo> {
    return this.pools.setGrade(address, body);
  }
}

