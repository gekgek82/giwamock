import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { AdminReferralService } from './admin-referral.service.js';
import type { KolBadgeType } from '@giwater/shared';

@Controller('admin/referral')
export class AdminReferralController {
  constructor(private readonly svc: AdminReferralService) {}

  @Get('overview')
  getOverview() { return this.svc.getOverview(); }

  @Get('list')
  listReferrers(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
    @Query('tierFilter') tierFilter?: string,
  ) {
    return this.svc.listReferrers({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      search,
      tierFilter,
    });
  }

  @Get('detail/:address')
  getDetail(@Param('address') address: string) { return this.svc.getReferrerDetail(address); }

  @Put('tier/:address')
  updateTier(
    @Param('address') address: string,
    @Body() body: { badgeType: KolBadgeType | 'NONE' },
  ) { return this.svc.updateKolTier(address, body.badgeType); }

  @Post('provision')
  @HttpCode(200)
  provision(@Body() body: { address: string; badgeType: KolBadgeType | 'NONE' }) {
    return this.svc.provision(body);
  }
}
