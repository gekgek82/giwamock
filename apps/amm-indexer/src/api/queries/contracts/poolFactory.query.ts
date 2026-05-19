import { db } from "ponder:api";
import { poolCreatedEvent } from "ponder:schema";
import type { IndexerPairPriceAxis } from "@giwater/shared";
import { and, desc, eq, type InferSelectModel, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { buildIndexerTokenInfoJson } from "../../types/indexer-token-info.js";
import { paginationQuerySchema } from "../../routes/_shared/pagination.request.schema.js";
import { poolCreatedRowSchema } from "../../routes/pool-created/pool-created.response.schema.js";

type Pagination = z.infer<typeof paginationQuerySchema>;

export type PoolCreatedJson = z.infer<typeof poolCreatedRowSchema>;

function toDec(n: bigint): string {
  return n.toString();
}

export function serializePoolCreated(
  row: InferSelectModel<typeof poolCreatedEvent>,
): PoolCreatedJson {
  return {
    id: row.id,
    token0: buildIndexerTokenInfoJson({
      token: row.token0,
      totalSupply: row.token0TotalSupply,
      decimals: row.token0Decimals,
      name: row.token0Name,
      symbol: row.token0Symbol,
    }),
    token1: buildIndexerTokenInfoJson({
      token: row.token1,
      totalSupply: row.token1TotalSupply,
      decimals: row.token1Decimals,
      name: row.token1Name,
      symbol: row.token1Symbol,
    }),
    stable: row.stable,
    pool: row.pool,
    base: row.base,
    quote: row.quote,
    pairPriceAxis: row.pairPriceAxis as IndexerPairPriceAxis,
    blockNumber: toDec(row.blockNumber),
    blockTimestamp: toDec(row.blockTimestamp),
    transactionHash: row.transactionHash,
    logIndex: toDec(row.logIndex),
  };
}

export async function listPoolCreated(
  pagination: Pagination,
  filters: {
    pool?: `0x${string}`;
    token0?: `0x${string}`;
    token1?: `0x${string}`;
    stable?: boolean;
  },
): Promise<PoolCreatedJson[]> {
  const { limit, offset } = pagination;
  const conds: SQL[] = [];
  if (filters.pool) conds.push(eq(poolCreatedEvent.pool, filters.pool));
  if (filters.token0) conds.push(eq(poolCreatedEvent.token0, filters.token0));
  if (filters.token1) conds.push(eq(poolCreatedEvent.token1, filters.token1));
  if (filters.stable !== undefined)
    conds.push(eq(poolCreatedEvent.stable, filters.stable));

  const base = db
    .select()
    .from(poolCreatedEvent)
    .orderBy(desc(poolCreatedEvent.blockNumber))
    .limit(limit)
    .offset(offset);

  const rows = conds.length > 0 ? await base.where(and(...conds)) : await base;
  return rows.map(serializePoolCreated);
}

export async function getPoolCreatedById(
  id: string,
): Promise<PoolCreatedJson | undefined> {
  const rows = await db
    .select()
    .from(poolCreatedEvent)
    .where(eq(poolCreatedEvent.id, id))
    .limit(1);
  const row = rows[0];
  return row ? serializePoolCreated(row) : undefined;
}
