import { DataSource } from 'typeorm';
import { BannerEntity } from './models/banner/banner.entity.js';
import { ReferralCodeEntity } from './models/referral/referral-code.entity.js';
import { ReferralRelationshipEntity } from './models/referral/referral-relationship.entity.js';
import { ReferralTierBadgeEntity } from './models/referral/referral-tier-badge.entity.js';
import { AdminWatchedWalletEntity } from './models/admin/admin-watched-wallet.entity.js';
import { TokenFaucetEntity } from './models/faucet/token-faucet.entity.js';
import { InitialConfigSchema1748100000000 } from './migrations/1748100000000-InitialConfigSchema.js';

export default new DataSource({
  type: 'postgres',
  url: (() => {
    const url = process.env.CONFIG_DATABASE_URL;
    if (!url) throw new Error('CONFIG_DATABASE_URL is required');
    return url;
  })(),
  entities: [
    BannerEntity,
    ReferralCodeEntity,
    ReferralRelationshipEntity,
    ReferralTierBadgeEntity,
    AdminWatchedWalletEntity,
    TokenFaucetEntity,
  ],
  migrations: [InitialConfigSchema1748100000000],
  synchronize: false,
});
