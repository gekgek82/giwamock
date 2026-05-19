import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCLFactoryFeeFieldsToGlobal1748200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS broker_dynamic_swap_fee_globals ADD COLUMN IF NOT EXISTS "defaultUnstakedFeeWire" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS broker_dynamic_swap_fee_globals ADD COLUMN IF NOT EXISTS "swapFeeModule" text NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS broker_dynamic_swap_fee_globals DROP COLUMN IF EXISTS "defaultUnstakedFeeWire"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS broker_dynamic_swap_fee_globals DROP COLUMN IF EXISTS "swapFeeModule"`,
    );
  }
}
