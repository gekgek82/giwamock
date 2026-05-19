import { MigrationInterface, QueryRunner } from 'typeorm';

export class SpotPairsMissingColumns1747182000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pairs ADD COLUMN IF NOT EXISTS "gaugeWhitelisted" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pairs ADD COLUMN IF NOT EXISTS "nftAddress" text NULL`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pairs ADD COLUMN IF NOT EXISTS "totalSwapFeesUsd" double precision NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pairs ADD COLUMN IF NOT EXISTS "daySwapFeesUsd" double precision NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pairs DROP COLUMN IF EXISTS "daySwapFeesUsd"`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pairs DROP COLUMN IF EXISTS "totalSwapFeesUsd"`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pairs DROP COLUMN IF EXISTS "nftAddress"`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pairs DROP COLUMN IF EXISTS "gaugeWhitelisted"`);
  }
}
