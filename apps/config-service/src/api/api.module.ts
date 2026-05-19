import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BannerEntity } from '../models/banner/banner.entity.js';
import { ReferralCodeEntity } from '../models/referral/referral-code.entity.js';
import { ReferralRelationshipEntity } from '../models/referral/referral-relationship.entity.js';
import { ReferralTierBadgeEntity } from '../models/referral/referral-tier-badge.entity.js';
import { AdminWatchedWalletEntity } from '../models/admin/admin-watched-wallet.entity.js';
import { TokenFaucetEntity } from '../models/faucet/token-faucet.entity.js';
import { BannerService } from './banner/banner.service.js';
import { ReferralService } from './referral/referral.service.js';
import { AdminReferralService } from './admin-referral/admin-referral.service.js';
import { AdminReferralController } from './admin-referral/admin-referral.controller.js';
import { AdminWatchedWalletsService } from './admin-watched-wallets/admin-watched-wallets.service.js';
import { AdminWatchedWalletsController } from './admin-watched-wallets/admin-watched-wallets.controller.js';
import { TokenFaucetsService } from './token-faucets/token-faucets.service.js';
import { TokenFaucetsController } from './token-faucets/token-faucets.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BannerEntity,
      ReferralCodeEntity,
      ReferralRelationshipEntity,
      ReferralTierBadgeEntity,
      AdminWatchedWalletEntity,
      TokenFaucetEntity,
    ]),
  ],
  controllers: [AdminReferralController, AdminWatchedWalletsController, TokenFaucetsController],
  providers: [BannerService, ReferralService, AdminReferralService, AdminWatchedWalletsService, TokenFaucetsService],
  exports: [BannerService, ReferralService, AdminReferralService, AdminWatchedWalletsService, TokenFaucetsService],
})
export class ApiModule {}
