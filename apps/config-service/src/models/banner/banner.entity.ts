import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { BannerPage, BannerClickTarget } from '@giwater/shared';

@Entity('banners')
export class BannerEntity {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'page', type: 'varchar', length: 50 })
  page: BannerPage;

  @Column({ name: 'link_url', type: 'text', nullable: true })
  linkUrl: string | null;

  @Column({ name: 'click_target', type: 'varchar', length: 20, default: 'NEW_TAB' })
  clickTarget: BannerClickTarget;

  @Column({ name: 'image_pc_data', type: 'text', nullable: true })
  imagePcData: string | null;

  @Column({ name: 'image_mobile_data', type: 'text', nullable: true })
  imageMobileData: string | null;

  @Column({ name: 'start_at', type: 'timestamptz', nullable: true })
  startAt: Date | null;

  @Column({ name: 'end_at', type: 'timestamptz', nullable: true })
  endAt: Date | null;

  @Column({ name: 'impressions', type: 'integer', default: 0 })
  impressions: number;

  @Column({ name: 'clicks', type: 'integer', default: 0 })
  clicks: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
