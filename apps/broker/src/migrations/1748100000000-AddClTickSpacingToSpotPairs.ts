import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClTickSpacingToSpotPairs1748100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spot_pairs"
      ADD COLUMN IF NOT EXISTS "clTickSpacing" integer NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spot_pairs"
      DROP COLUMN IF EXISTS "clTickSpacing"
    `);
  }
}
