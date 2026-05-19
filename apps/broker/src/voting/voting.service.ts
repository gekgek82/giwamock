import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VoterVotePositionEntity } from '../models/voting/voter-vote-position.entity';
import { VoterVoteEventEntity } from '../models/voting/voter-vote-event.entity';
import { VoterRewardClaimEntity } from '../models/voting/voter-reward-claim.entity';

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/i;

@Injectable()
export class VotingService {
  constructor(
    @InjectRepository(VoterVotePositionEntity)
    private readonly positions: Repository<VoterVotePositionEntity>,
    @InjectRepository(VoterVoteEventEntity)
    private readonly voteEvents: Repository<VoterVoteEventEntity>,
    @InjectRepository(VoterRewardClaimEntity)
    private readonly claims: Repository<VoterRewardClaimEntity>,
  ) {}

  async getPositionsByOwner(owner: string): Promise<VoterVotePositionEntity[]> {
    if (!ADDR_RE.test(owner)) return [];
    return this.positions.find({
      where: { owner: owner.toLowerCase(), isActive: true },
      order: { createdAt: 'ASC' },
    });
  }

  async getVoteEventsByOwner(owner: string): Promise<VoterVoteEventEntity[]> {
    if (!ADDR_RE.test(owner)) return [];
    return this.voteEvents.find({
      where: { owner: owner.toLowerCase() },
      order: { blockTimestamp: 'DESC' },
    });
  }

  async getClaimsByOwner(owner: string): Promise<VoterRewardClaimEntity[]> {
    if (!ADDR_RE.test(owner)) return [];
    return this.claims.find({
      where: { from: owner.toLowerCase() },
      order: { blockTimestamp: 'DESC' },
    });
  }
}
