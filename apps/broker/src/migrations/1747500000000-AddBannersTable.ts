import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBannersTable1747500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_banners_dates"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_banners_page"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "banners"`);
  }
}
