import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReferralCodeEntity } from '../../models/referral/referral-code.entity.js';
import { ReferralRelationshipEntity } from '../../models/referral/referral-relationship.entity.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const CODE_MAX_ATTEMPTS = 20;

@Injectable()
export class ReferralService {
  constructor(
    @InjectRepository(ReferralCodeEntity)
    private readonly codeRepo: Repository<ReferralCodeEntity>,
    @InjectRepository(ReferralRelationshipEntity)
    private readonly relationshipRepo: Repository<ReferralRelationshipEntity>,
  ) {}

  async getOrCreateCode(address: string): Promise<ReferralCodeEntity> {
    const normalized = address.toLowerCase();
    const existing = await this.codeRepo.findOne({ where: { address: normalized } });
    if (existing) return existing;

    for (let attempt = 0; attempt < CODE_MAX_ATTEMPTS; attempt++) {
      const code = 'GW-' + this.generateCode();
      const conflict = await this.codeRepo.findOne({ where: { code } });
      if (conflict) continue;
      const created = this.codeRepo.create({ address: normalized, code });
      return this.codeRepo.save(created);
    }

    throw new Error('Failed to generate unique referral code after maximum attempts');
  }

  async claimReferral(
    refereeAddress: string,
    referralCode: string,
  ): Promise<{ success: boolean; alreadyClaimed: boolean; referrerAddress?: string }> {
    const normalizedReferee = refereeAddress.toLowerCase();

    const existing = await this.relationshipRepo.findOne({
      where: { refereeAddress: normalizedReferee },
    });
    if (existing) {
      return { success: false, alreadyClaimed: true, referrerAddress: existing.referrerAddress };
    }

    const referrerCode = await this.codeRepo.findOne({ where: { code: referralCode.trim().toUpperCase() } });
    if (!referrerCode) {
      return { success: false, alreadyClaimed: false };
    }

    if (referrerCode.address === normalizedReferee) {
      return { success: false, alreadyClaimed: false };
    }

    const relationship = this.relationshipRepo.create({
      referrerAddress: referrerCode.address,
      refereeAddress: normalizedReferee,
    });
    await this.relationshipRepo.save(relationship);

    return { success: true, alreadyClaimed: false, referrerAddress: referrerCode.address };
  }

  private generateCode(): string {
    let result = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      result += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return result;
  }
}
