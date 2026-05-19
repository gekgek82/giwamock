import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ReferralTierBadges1747800000000 implements MigrationInterface {
  name = 'ReferralTierBadges1747800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "referral_tier_badges" (
        "id"         SERIAL PRIMARY KEY,
        "address"    TEXT NOT NULL,
        "badgeType"  TEXT NOT NULL,
        "isActive"   BOOLEAN NOT NULL DEFAULT TRUE,
        "grantedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "expiresAt"  TIMESTAMPTZ,
        "grantedBy"  TEXT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_referral_tier_badges_address" ON "referral_tier_badges" ("address")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_referral_tier_badges_active" ON "referral_tier_badges" ("address", "isActive")`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "referral_tier_badges"`);
  }
}
