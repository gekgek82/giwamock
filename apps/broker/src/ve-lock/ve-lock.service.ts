import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VeLockEventEntity } from '../models/ve-lock/ve-lock-event.entity';
import { VeLockPositionEntity } from '../models/ve-lock/ve-lock-position.entity';

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/i;

@Injectable()
export class VeLockService {
  constructor(
    @InjectRepository(VeLockPositionEntity)
    private readonly positions: Repository<VeLockPositionEntity>,
    @InjectRepository(VeLockEventEntity)
    private readonly events: Repository<VeLockEventEntity>,
  ) {}

  async getPositionsByOwner(owner: string): Promise<VeLockPositionEntity[]> {
    if (!ADDR_RE.test(owner)) return [];
    return this.positions.find({
      where: { owner: owner.toLowerCase() },
      order: { createdAt: 'ASC' },
    });
  }

  async getPositionByTokenId(tokenId: string): Promise<VeLockPositionEntity | null> {
    return this.positions.findOne({ where: { tokenId } });
  }

  async getEventsByTokenId(tokenId: string): Promise<VeLockEventEntity[]> {
    return this.events.find({
      where: { tokenId },
      order: { createdAt: 'ASC' },
    });
  }

  async getEventsByOwner(owner: string): Promise<VeLockEventEntity[]> {
    if (!ADDR_RE.test(owner)) return [];
    return this.events.find({
      where: { owner: owner.toLowerCase() },
      order: { createdAt: 'ASC' },
    });
  }
}
