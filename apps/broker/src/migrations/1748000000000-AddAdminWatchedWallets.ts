import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminWatchedWallets1748000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_watched_wallets"`);
  }
}
