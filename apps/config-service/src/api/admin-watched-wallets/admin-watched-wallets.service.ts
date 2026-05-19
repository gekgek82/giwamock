import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminWatchedWalletEntity } from '../../models/admin/admin-watched-wallet.entity.js';
import type { AdminWatchedWalletDto } from '@giwater/shared';

@Injectable()
export class AdminWatchedWalletsService {
  constructor(
    @InjectRepository(AdminWatchedWalletEntity)
    private readonly repo: Repository<AdminWatchedWalletEntity>,
  ) {}

  async list(): Promise<{ wallets: AdminWatchedWalletDto[] }> {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    return {
      wallets: rows.map((row) => ({
        id: row.id,
        address: row.address,
        label: row.label,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async upsert(body: { address?: string; label?: string }): Promise<AdminWatchedWalletDto> {
    const address = typeof body?.address === 'string' ? body.address.trim().toLowerCase() : '';
    if (!address) throw new BadRequestException('address is required');
    const label = typeof body?.label === 'string' ? body.label : '';

    const existing = await this.repo.findOne({ where: { address } });
    if (existing) {
      if (typeof body?.label === 'string' && existing.label !== label) {
        existing.label = label;
        await this.repo.save(existing);
      }
      return { id: existing.id, address: existing.address, label: existing.label, createdAt: existing.createdAt.toISOString() };
    }

    const saved = await this.repo.save(this.repo.create({ address, label }));
    return { id: saved.id, address: saved.address, label: saved.label, createdAt: saved.createdAt.toISOString() };
  }

  async remove(address: string): Promise<{ ok: true }> {
    const trimmed = address?.trim().toLowerCase();
    if (!trimmed) throw new BadRequestException('address is required');
    await this.repo.delete({ address: trimmed });
    return { ok: true };
  }
}
