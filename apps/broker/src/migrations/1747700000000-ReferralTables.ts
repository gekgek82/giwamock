import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReferralTables1747700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_referral_relationships_referrer`);
    await queryRunner.query(`DROP TABLE IF EXISTS referral_relationships`);
    await queryRunner.query(`DROP TABLE IF EXISTS referral_codes`);
  }
}
