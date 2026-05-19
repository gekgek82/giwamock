import { db } from "ponder:api";
import { dynamicSwapFeeEvent } from "ponder:schema";
import { and, desc, eq, inArray, type InferSelectModel, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { paginationQuerySchema } from "../../routes/_shared/pagination.request.schema.js";

type Pagination = z.infer<typeof paginationQuerySchema>;

export interface DynamicSwapFeeEventJson {
  id: string;
  pool: `0x${string}`;
  dynamicFee: boolean;
  fee: string | null;
  blockNumber: string;
  blockTimestamp: string;
  transactionHash: `0x${string}`;
  logIndex: string;
}

function toDec(n: bigint): string {
  return n.toString();
}

export function serializeDynamicSwapFeeEvent(
  row: InferSelectModel<typeof dynamicSwapFeeEvent>,
): DynamicSwapFeeEventJson {
  return {
    id: row.id,
    pool: row.pool,
    dynamicFee: row.dynamicFee,
    fee: row.fee === null ? null : toDec(row.fee),
    blockNumber: toDec(row.blockNumber),
    blockTimestamp: toDec(row.blockTimestamp),
    transactionHash: row.transactionHash,
    logIndex: toDec(row.logIndex),
  };
}

export async function listDynamicSwapFeeEvents(
  pagination: Pagination,
  filters: { pool?: `0x${string}`; dynamicFee?: boolean },
): Promise<DynamicSwapFeeEventJson[]> {
  const { limit, offset } = pagination;
  const conds: SQL[] = [];
  if (filters.pool) conds.push(eq(dynamicSwapFeeEvent.pool, filters.pool));
  if (filters.dynamicFee !== undefined) {
    conds.push(eq(dynamicSwapFeeEvent.dynamicFee, filters.dynamicFee));
  }

  const base = db
    .select()
    .from(dynamicSwapFeeEvent)
    .orderBy(desc(dynamicSwapFeeEvent.blockNumber), desc(dynamicSwapFeeEvent.logIndex))
    .limit(limit)
    .offset(offset);

  const rows = conds.length > 0 ? await base.where(and(...conds)) : await base;
  return rows.map(serializeDynamicSwapFeeEvent);
}

export async function getDynamicSwapFeeEventById(
  id: string,
): Promise<DynamicSwapFeeEventJson | undefined> {
  const rows = await db
    .select()
    .from(dynamicSwapFeeEvent)
    .where(eq(dynamicSwapFeeEvent.id, id))
    .limit(1);
  const row = rows[0];
  return row ? serializeDynamicSwapFeeEvent(row) : undefined;
}

export async function getLatestDynamicFeeByPools(
  pools: readonly `0x${string}`[],
): Promise<Map<`0x${string}`, boolean>> {
  if (pools.length === 0) return new Map();

  const feeRows = await db
    .select()
    .from(dynamicSwapFeeEvent)
    .where(inArray(dynamicSwapFeeEvent.pool, [...pools]))
    .orderBy(
      desc(dynamicSwapFeeEvent.blockNumber),
      desc(dynamicSwapFeeEvent.logIndex),
    );

  const latestDynamicFeeByPool = new Map<`0x${string}`, boolean>();
  for (const feeRow of feeRows) {
    if (!latestDynamicFeeByPool.has(feeRow.pool)) {
      latestDynamicFeeByPool.set(feeRow.pool, feeRow.dynamicFee);
    }
  }

  return latestDynamicFeeByPool;
}

export async function getLatestDynamicFeeByPool(
  pool: `0x${string}`,
): Promise<boolean | undefined> {
  const feeRows = await db
    .select()
    .from(dynamicSwapFeeEvent)
    .where(eq(dynamicSwapFeeEvent.pool, pool))
    .orderBy(
      desc(dynamicSwapFeeEvent.blockNumber),
      desc(dynamicSwapFeeEvent.logIndex),
    )
    .limit(1);

  return feeRows[0]?.dynamicFee;
}
