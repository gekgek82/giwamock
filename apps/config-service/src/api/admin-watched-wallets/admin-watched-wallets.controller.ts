import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import type { AdminWatchedWalletDto } from '@giwater/shared';
import { AdminWatchedWalletsService } from './admin-watched-wallets.service.js';

@Controller('admin/watched-wallets')
export class AdminWatchedWalletsController {
  constructor(private readonly service: AdminWatchedWalletsService) {}

  @Get()
  list(): Promise<{ wallets: AdminWatchedWalletDto[] }> {
    return this.service.list();
  }

  @Post()
  upsert(@Body() body: { address?: string; label?: string }): Promise<AdminWatchedWalletDto> {
    return this.service.upsert(body);
  }

  @Delete(':address')
  remove(@Param('address') address: string): Promise<{ ok: true }> {
    return this.service.remove(address);
  }
}
