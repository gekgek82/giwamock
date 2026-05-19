import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface ColumnSpec {
  name: string;
  ddl: string;
}

const REQUIRED_COLUMNS: Record<string, ColumnSpec[]> = {
  spot_pairs: [
    { name: 'gaugeWhitelisted', ddl: '"gaugeWhitelisted" boolean NOT NULL DEFAULT false' },
    { name: 'nftAddress', ddl: '"nftAddress" text NULL' },
    { name: 'totalSwapFeesUsd', ddl: '"totalSwapFeesUsd" double precision NOT NULL DEFAULT 0' },
    { name: 'daySwapFeesUsd', ddl: '"daySwapFeesUsd" double precision NOT NULL DEFAULT 0' },
    { name: 'effectiveFeeBps', ddl: '"effectiveFeeBps" double precision NULL' },
    { name: 'feeSource', ddl: '"feeSource" text NOT NULL DEFAULT \'\'' },
  ],
};

@Injectable()
export class SchemaGuardService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaGuardService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
      await this.ensureColumns(table, columns);
    }
  }

  private async ensureColumns(table: string, columns: ColumnSpec[]): Promise<void> {
    const rows: { column_name: string }[] = await this.dataSource.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [table],
    );
    const existing = new Set(rows.map((r) => r.column_name));

    const missing = columns.filter((c) => !existing.has(c.name));
    if (missing.length === 0) return;

    const alterClauses = missing.map((c) => `ADD COLUMN IF NOT EXISTS ${c.ddl}`).join(', ');
    await this.dataSource.query(`ALTER TABLE IF EXISTS ${table} ${alterClauses}`);
    this.logger.warn(`Schema drift fixed — added to ${table}: ${missing.map((c) => c.name).join(', ')}`);
  }
}
