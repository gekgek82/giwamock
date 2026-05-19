import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialConfigSchema1748100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "banners" (
        "id" SERIAL PRIMARY KEY,
        "title" varchar(255) NOT NULL,
        "page" varchar(50) NOT NULL,
        "link_url" text NULL,
        "click_target" varchar(20) NOT NULL DEFAULT 'NEW_TAB',
        "image_pc_data" text NULL,
        "image_mobile_data" text NULL,
        "start_at" timestamptz NULL,
        "end_at" timestamptz NULL,
        "impressions" integer NOT NULL DEFAULT 0,
        "clicks" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_banners_page" ON "banners" ("page")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_banners_dates" ON "banners" ("start_at", "end_at")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        address text PRIMARY KEY,
        code text NOT NULL UNIQUE,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS referral_relationships (
        id serial PRIMARY KEY,
        "referrerAddress" text NOT NULL,
        "refereeAddress" text NOT NULL UNIQUE,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_relationships_referrer
      ON referral_relationships ("referrerAddress")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "referral_tier_badges" (
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
      `CREATE INDEX IF NOT EXISTS "IDX_referral_tier_badges_address" ON "referral_tier_badges" ("address")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_referral_tier_badges_active" ON "referral_tier_badges" ("address", "isActive")`
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_watched_wallets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "address" text NOT NULL,
        "label" text NOT NULL DEFAULT '',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_watched_wallets" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_admin_watched_wallets_address" UNIQUE ("address")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "token_faucets" (
        "faucet_address" varchar(42) PRIMARY KEY,
        "token_address" varchar(42) NOT NULL,
        "token_name" varchar(100) NOT NULL,
        "token_symbol" varchar(20) NOT NULL,
        "token_decimals" integer NOT NULL DEFAULT 18,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "token_faucets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_watched_wallets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "referral_tier_badges"`);
    await queryRunner.query(`DROP TABLE IF EXISTS referral_relationships`);
    await queryRunner.query(`DROP TABLE IF EXISTS referral_codes`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_banners_dates"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_banners_page"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "banners"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS pgcrypto`);
  }
}
