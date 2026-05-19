import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { ReferralCodeEntity } from '../../models/referral/referral-code.entity.js';
import { ReferralRelationshipEntity } from '../../models/referral/referral-relationship.entity.js';
import { ReferralTierBadgeEntity } from '../../models/referral/referral-tier-badge.entity.js';
import { ReferralService } from '../referral/referral.service.js';
import type { KolBadgeType } from '@giwater/shared';

const RATES = { GENERAL: 0.10, KOL_TIER1: 0.15, KOL_TIER2: 0.20 };
type ReferralTier = 'GENERAL' | KolBadgeType;

function tierFromBadge(badge: ReferralTierBadgeEntity | null): ReferralTier {
  if (!badge || !badge.isActive) return 'GENERAL';
  return badge.badgeType;
}

@Injectable()
export class AdminReferralService {
  constructor(
    @InjectRepository(ReferralCodeEntity)
    private readonly codes: Repository<ReferralCodeEntity>,
    @InjectRepository(ReferralRelationshipEntity)
    private readonly relationships: Repository<ReferralRelationshipEntity>,
    @InjectRepository(ReferralTierBadgeEntity)
    private readonly badges: Repository<ReferralTierBadgeEntity>,
    private readonly referralService: ReferralService,
  ) {}

  async getOverview() {
    const [totalReferrers, totalReferees, kolTier1Count, kolTier2Count] = await Promise.all([
      this.codes.count(),
      this.relationships.count(),
      this.badges.count({ where: { badgeType: 'KOL_TIER1' as KolBadgeType, isActive: true } }),
      this.badges.count({ where: { badgeType: 'KOL_TIER2' as KolBadgeType, isActive: true } }),
    ]);
    return {
      totalReferrers,
      totalReferees,
      totalRewardsDistributed: '0',
      kolTier1Count,
      kolTier2Count,
      generalCount: Math.max(0, totalReferrers - kolTier1Count - kolTier2Count),
      rates: RATES,
    };
  }

  async listReferrers(query: { limit?: number; offset?: number; search?: string; tierFilter?: string }) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const whereConditions = query.search
      ? [
          { address: ILike(`%${query.search.toLowerCase()}%`) },
          { code: ILike(`%${query.search.toUpperCase()}%`) },
        ]
      : undefined;

    const [allCodes, total] = whereConditions
      ? await this.codes.findAndCount({ where: whereConditions, skip: offset, take: limit })
      : await this.codes.findAndCount({ skip: offset, take: limit, order: { createdAt: 'DESC' } });

    if (allCodes.length === 0) return { items: [], total, limit, offset };

    const addresses = allCodes.map((c) => c.address);

    const [relCounts, activeBadges] = await Promise.all([
      this.relationships
        .createQueryBuilder('r')
        .select('r.referrerAddress', 'referrerAddress')
        .addSelect('COUNT(*)', 'total')
        .where('r.referrerAddress IN (:...addresses)', { addresses })
        .groupBy('r.referrerAddress')
        .getRawMany<{ referrerAddress: string; total: string }>(),
      this.badges.find({ where: addresses.map((a) => ({ address: a, isActive: true })) }),
    ]);

    const relCountMap = new Map(relCounts.map((r) => [r.referrerAddress, parseInt(r.total, 10)]));
    const badgeMap = new Map(activeBadges.map((b) => [b.address, b]));

    let items = allCodes.map((c) => {
      const badge = badgeMap.get(c.address) ?? null;
      const tier = tierFromBadge(badge);
      return {
        address: c.address,
        referralCode: c.code,
        tier,
        referralRate: RATES[tier],
        refereeCount: relCountMap.get(c.address) ?? 0,
        tierAppliedAt: badge?.grantedAt?.toISOString() ?? null,
      };
    });

    if (query.tierFilter && query.tierFilter !== 'ALL') {
      items = items.filter((i) => i.tier === query.tierFilter);
    }

    return { items, total, limit, offset };
  }

  async getReferrerDetail(address: string) {
    const addr = address.toLowerCase();
    const [codeRecord, badge, referees] = await Promise.all([
      this.codes.findOne({ where: { address: addr } }),
      this.badges.findOne({ where: { address: addr, isActive: true } }),
      this.relationships.find({ where: { referrerAddress: addr }, order: { createdAt: 'DESC' } }),
    ]);
    const tier = tierFromBadge(badge ?? null);
    return {
      address: addr,
      referralCode: codeRecord?.code ?? null,
      tier,
      referralRate: RATES[tier],
      badge: badge ? {
        badgeType: badge.badgeType,
        isActive: badge.isActive,
        grantedAt: badge.grantedAt.toISOString(),
        expiresAt: badge.expiresAt?.toISOString() ?? null,
        metadata: null,
      } : null,
      totalReferees: referees.length,
      activeReferees: referees.length,
      invalidReferees: 0,
      totalRewardsEarned: '0',
      referees: referees.map((r) => ({
        address: r.refereeAddress,
        isValid: true,
        invalidationReason: null,
        fundingSource: null,
        createdAt: r.createdAt.toISOString(),
        rewardsGenerated: '0',
      })),
      recentRewards: [],
    };
  }

  async updateKolTier(address: string, badgeType: KolBadgeType | 'NONE') {
    const addr = address.toLowerCase();
    await this.badges.update({ address: addr, isActive: true }, { isActive: false });
    if (badgeType !== 'NONE') {
      await this.badges.save(this.badges.create({ address: addr, badgeType, isActive: true }));
    }
    const tier: ReferralTier = badgeType === 'NONE' ? 'GENERAL' : badgeType;
    return { success: true, tier, rate: RATES[tier] };
  }

  async provision(data: { address: string; badgeType: KolBadgeType | 'NONE' }) {
    const codeRecord = await this.referralService.getOrCreateCode(data.address);
    if (data.badgeType !== 'NONE') {
      await this.badges.update({ address: codeRecord.address, isActive: true }, { isActive: false });
      await this.badges.save(this.badges.create({ address: codeRecord.address, badgeType: data.badgeType, isActive: true }));
    }
    const tier: ReferralTier = data.badgeType === 'NONE' ? 'GENERAL' : data.badgeType;
    return { success: true, referralCode: codeRecord.code, tier, rate: RATES[tier] };
  }
}
