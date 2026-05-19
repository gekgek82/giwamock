import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { ConfigServiceConfig } from '../config/configuration.js';
import { BannerEntity } from '../models/banner/banner.entity.js';
import { ReferralCodeEntity } from '../models/referral/referral-code.entity.js';
import { ReferralRelationshipEntity } from '../models/referral/referral-relationship.entity.js';
import { ReferralTierBadgeEntity } from '../models/referral/referral-tier-badge.entity.js';
import { AdminWatchedWalletEntity } from '../models/admin/admin-watched-wallet.entity.js';
import { TokenFaucetEntity } from '../models/faucet/token-faucet.entity.js';
import { InitialConfigSchema1748100000000 } from '../migrations/1748100000000-InitialConfigSchema.js';

const ALL_ENTITIES = [
  BannerEntity,
  ReferralCodeEntity,
  ReferralRelationshipEntity,
  ReferralTierBadgeEntity,
  AdminWatchedWalletEntity,
  TokenFaucetEntity,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.getOrThrow<ConfigServiceConfig['configDb']>('configDb').url;
        return {
          type: 'postgres' as const,
          url,
          entities: ALL_ENTITIES,
          migrations: [InitialConfigSchema1748100000000],
          migrationsRun: true,
          synchronize: false,
          logging: false,
        };
      },
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class ConfigDbModule {}
