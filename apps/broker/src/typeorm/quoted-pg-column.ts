import type { ObjectLiteral, Repository } from 'typeorm';

/**
 * PostgreSQL quoted identifier for a column, from TypeORM metadata.
 * Use inside raw SQL fragments (e.g. UPDATE ... SET x = COALESCE("col", 0)) so
 * raw strings stay aligned with the actual DB column name (camelCase vs snake_case).
 */
export function quotedPgColumn<T extends ObjectLiteral>(
  repo: Repository<T>,
  propertyName: keyof T & string,
): string {
  const col = repo.metadata.findColumnWithPropertyName(propertyName);
  if (!col) {
    throw new Error(`Unknown entity property for quotedPgColumn: ${propertyName}`);
  }
  return `"${col.databaseName.replace(/"/g, '""')}"`;
}
