import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureSpotPairsColumns1747600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pairs ADD COLUMN IF NOT EXISTS "gaugeWhitelisted" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pairs ADD COLUMN IF NOT EXISTS "nftAddress" text NULL`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pairs ADD COLUMN IF NOT EXISTS "totalSwapFeesUsd" double precision NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pairs ADD COLUMN IF NOT EXISTS "daySwapFeesUsd" double precision NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pairs ADD COLUMN IF NOT EXISTS "effectiveFeeBps" double precision NULL`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pairs ADD COLUMN IF NOT EXISTS "feeSource" text NOT NULL DEFAULT ''`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // intentionally left empty — these are additive safety columns
  }
}
