import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BannerEntity } from '../../models/banner/banner.entity.js';
import type {
  AdminBannerInfo,
  BannerListResponse,
  CreateBannerRequest,
  UpdateBannerRequest,
  ActiveBanner,
} from '@giwater/shared';
import { BannerStatus } from '@giwater/shared';
import type { BannerPage } from '@giwater/shared';

@Injectable()
export class BannerService {
  constructor(
    @InjectRepository(BannerEntity)
    private readonly bannerRepo: Repository<BannerEntity>,
  ) {}

  async findAll(page?: BannerPage): Promise<BannerListResponse> {
    const where = page ? { page } : {};
    const banners = await this.bannerRepo.find({ where, order: { createdAt: 'DESC' } });
    return { banners: banners.map((b) => this.toAdminDto(b)), total: banners.length };
  }

  async findOne(id: number): Promise<AdminBannerInfo> {
    const banner = await this.findEntityOrThrow(id);
    return this.toAdminDto(banner);
  }

  async create(dto: CreateBannerRequest): Promise<AdminBannerInfo> {
    const saved = await this.bannerRepo.save(
      this.bannerRepo.create({
        title: dto.title,
        page: dto.page,
        linkUrl: dto.linkUrl ?? null,
        clickTarget: dto.clickTarget ?? 'NEW_TAB',
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
      }),
    );
    return this.toAdminDto(saved);
  }

  async update(id: number, dto: UpdateBannerRequest): Promise<AdminBannerInfo> {
    const banner = await this.findEntityOrThrow(id);
    if (dto.title !== undefined) banner.title = dto.title;
    if (dto.linkUrl !== undefined) banner.linkUrl = dto.linkUrl ?? null;
    if (dto.clickTarget !== undefined) banner.clickTarget = dto.clickTarget;
    if (dto.startAt !== undefined) banner.startAt = dto.startAt ? new Date(dto.startAt) : null;
    if (dto.endAt !== undefined) banner.endAt = dto.endAt ? new Date(dto.endAt) : null;
    const saved = await this.bannerRepo.save(banner);
    return this.toAdminDto(saved);
  }

  async remove(id: number): Promise<void> {
    const banner = await this.findEntityOrThrow(id);
    await this.bannerRepo.delete(banner.id);
  }

  async setPcImage(id: number, buffer: Buffer, mimeType: string): Promise<AdminBannerInfo> {
    const banner = await this.findEntityOrThrow(id);
    banner.imagePcData = `data:${mimeType};base64,${buffer.toString('base64')}`;
    const saved = await this.bannerRepo.save(banner);
    return this.toAdminDto(saved);
  }

  async setMobileImage(id: number, buffer: Buffer, mimeType: string): Promise<AdminBannerInfo> {
    const banner = await this.findEntityOrThrow(id);
    banner.imageMobileData = `data:${mimeType};base64,${buffer.toString('base64')}`;
    const saved = await this.bannerRepo.save(banner);
    return this.toAdminDto(saved);
  }

  async deletePcImage(id: number): Promise<AdminBannerInfo> {
    const banner = await this.findEntityOrThrow(id);
    banner.imagePcData = null;
    const saved = await this.bannerRepo.save(banner);
    return this.toAdminDto(saved);
  }

  async deleteMobileImage(id: number): Promise<AdminBannerInfo> {
    const banner = await this.findEntityOrThrow(id);
    banner.imageMobileData = null;
    const saved = await this.bannerRepo.save(banner);
    return this.toAdminDto(saved);
  }

  async getActiveBanners(page: BannerPage): Promise<ActiveBanner[]> {
    const now = new Date();
    const banners = await this.bannerRepo
      .createQueryBuilder('b')
      .where('b.page = :page', { page })
      .andWhere('(b.startAt IS NULL OR b.startAt <= :now)', { now })
      .andWhere('(b.endAt IS NULL OR b.endAt >= :now)', { now })
      .orderBy('b.createdAt', 'ASC')
      .getMany();

    return banners.map((b) => ({
      id: b.id,
      imagePcUrl: b.imagePcData,
      imageMobileUrl: b.imageMobileData,
      linkUrl: b.linkUrl,
      clickTarget: b.clickTarget,
    }));
  }

  async recordImpression(id: number): Promise<void> {
    await this.bannerRepo.increment({ id }, 'impressions', 1);
  }

  async recordClick(id: number): Promise<void> {
    await this.bannerRepo.increment({ id }, 'clicks', 1);
  }

  private async findEntityOrThrow(id: number): Promise<BannerEntity> {
    const banner = await this.bannerRepo.findOne({ where: { id } });
    if (!banner) throw new NotFoundException(`Banner ${id} not found`);
    return banner;
  }

  private toAdminDto(b: BannerEntity): AdminBannerInfo {
    const now = new Date();
    let status: typeof BannerStatus[keyof typeof BannerStatus];
    if (b.startAt && now < b.startAt) {
      status = BannerStatus.SCHEDULED;
    } else if (b.endAt && now > b.endAt) {
      status = BannerStatus.ENDED;
    } else {
      status = BannerStatus.ACTIVE;
    }
    const impressions = b.impressions;
    const clicks = b.clicks;
    const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';
    return {
      id: b.id,
      title: b.title,
      page: b.page,
      linkUrl: b.linkUrl,
      clickTarget: b.clickTarget,
      imagePcUrl: b.imagePcData,
      imageMobileUrl: b.imageMobileData,
      status,
      startAt: b.startAt ? b.startAt.toISOString() : null,
      endAt: b.endAt ? b.endAt.toISOString() : null,
      impressions,
      clicks,
      ctr,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  }
}
