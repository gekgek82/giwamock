import { db } from "ponder:api";
import {
  clLiquidityAddedEvent,
  clPoolCreatedEvent,
  liquidityAddedEvent,
  swapEvent,
} from "ponder:schema";
import type { IndexerPairPriceAxis } from "@giwater/shared";
import { and, desc, eq, type InferSelectModel, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { buildIndexerTokenInfoJson } from "../../types/indexer-token-info.js";
import { paginationQuerySchema } from "../../routes/_shared/pagination.request.schema.js";
import { clPoolCreatedRowSchema } from "../../routes/cl-pool-created/cl-pool-created.response.schema.js";
import { clLiquidityAddedRowSchema } from "../../routes/cl-liquidity-added/cl-liquidity-added.response.schema.js";
import { liquidityAddedRowSchema } from "../../routes/liquidity-added/liquidity-added.response.schema.js";
import { swapRowSchema } from "../../routes/swaps/swaps.response.schema.js";
import {
  getLatestDynamicFeeByPool,
  getLatestDynamicFeeByPools,
} from "./dynamicSwapFee.query.js";

type Pagination = z.infer<typeof paginationQuerySchema>;

export type CLPoolCreatedJson = z.infer<typeof clPoolCreatedRowSchema>;

export type { IndexerTokenInfoJson } from "../../types/indexer-token-info.js";
export type LiquidityAddedJson = z.infer<typeof liquidityAddedRowSchema>;
export type CLLiquidityAddedJson = z.infer<typeof clLiquidityAddedRowSchema>;
export type SwapJson = z.infer<typeof swapRowSchema>;

function toDec(n: bigint): string {
  return n.toString();
}

export function serializeCLPoolCreated(
  row: InferSelectModel<typeof clPoolCreatedEvent>,
  dynamicFee: boolean,
): CLPoolCreatedJson {
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
    tickSpacing: toDec(row.tickSpacing),
    pool: row.pool,
    base: row.base,
    quote: row.quote,
    pairPriceAxis: row.pairPriceAxis as IndexerPairPriceAxis,
    stable: false,
    dynamicFee,
    blockNumber: toDec(row.blockNumber),
    blockTimestamp: toDec(row.blockTimestamp),
    transactionHash: row.transactionHash,
    logIndex: toDec(row.logIndex),
  };
}

export function serializeLiquidityAdded(
  row: InferSelectModel<typeof liquidityAddedEvent>,
): LiquidityAddedJson {
  return {
    id: row.id,
    sender: row.sender,
    token0: row.token0,
    token1: row.token1,
    stable: row.stable,
    amount0: toDec(row.amount0),
    amount1: toDec(row.amount1),
    liquidity: toDec(row.liquidity),
    to: row.to,
    blockNumber: toDec(row.blockNumber),
    blockTimestamp: toDec(row.blockTimestamp),
    transactionHash: row.transactionHash,
    logIndex: toDec(row.logIndex),
  };
}

export function serializeCLLiquidityAdded(
  row: InferSelectModel<typeof clLiquidityAddedEvent>,
): CLLiquidityAddedJson {
  return {
    id: row.id,
    sender: row.sender,
    token0: row.token0,
    token1: row.token1,
    tickSpacing: toDec(row.tickSpacing),
    tickLower: toDec(row.tickLower),
    tickUpper: toDec(row.tickUpper),
    liquidity: toDec(row.liquidity),
    amount0: toDec(row.amount0),
    amount1: toDec(row.amount1),
    to: row.to,
    blockNumber: toDec(row.blockNumber),
    blockTimestamp: toDec(row.blockTimestamp),
    transactionHash: row.transactionHash,
    logIndex: toDec(row.logIndex),
  };
}

export function serializeSwap(row: InferSelectModel<typeof swapEvent>): SwapJson {
  return {
    id: row.id,
    sender: row.sender,
    tokenIn: row.tokenIn,
    tokenOut: row.tokenOut,
    isCL: row.isCL,
    stable: row.stable,
    hopIndex: toDec(row.hopIndex),
    amountIn: toDec(row.amountIn),
    amountOut: toDec(row.amountOut),
    feeAmount: toDec(row.feeAmount),
    feeToken: row.feeToken,
    to: row.to,
    blockNumber: toDec(row.blockNumber),
    blockTimestamp: toDec(row.blockTimestamp),
    transactionHash: row.transactionHash,
    logIndex: toDec(row.logIndex),
  };
}

export async function listCLPoolCreated(
  pagination: Pagination,
  filters: { pool?: `0x${string}`; token0?: `0x${string}`; token1?: `0x${string}` },
): Promise<CLPoolCreatedJson[]> {
  const { limit, offset } = pagination;
  const conds: SQL[] = [];
  if (filters.pool) conds.push(eq(clPoolCreatedEvent.pool, filters.pool));
  if (filters.token0) conds.push(eq(clPoolCreatedEvent.token0, filters.token0));
  if (filters.token1) conds.push(eq(clPoolCreatedEvent.token1, filters.token1));

  const base = db
    .select()
    .from(clPoolCreatedEvent)
    .orderBy(desc(clPoolCreatedEvent.blockNumber))
    .limit(limit)
    .offset(offset);

  const rows = conds.length > 0 ? await base.where(and(...conds)) : await base;
  if (rows.length === 0) return [];

  const pools = [...new Set(rows.map((row) => row.pool))];
  const latestDynamicFeeByPool = await getLatestDynamicFeeByPools(pools);

  return rows.map((row) =>
    serializeCLPoolCreated(row, latestDynamicFeeByPool.get(row.pool) ?? true),
  );
}

export async function getCLPoolCreatedById(
  id: string,
): Promise<CLPoolCreatedJson | undefined> {
  const rows = await db
    .select()
    .from(clPoolCreatedEvent)
    .where(eq(clPoolCreatedEvent.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;

  const dynamicFee = (await getLatestDynamicFeeByPool(row.pool)) ?? true;
  return serializeCLPoolCreated(row, dynamicFee);
}

export async function listLiquidityAdded(
  pagination: Pagination,
  filters: {
    token0?: `0x${string}`;
    token1?: `0x${string}`;
    to?: `0x${string}`;
    stable?: boolean;
  },
): Promise<LiquidityAddedJson[]> {
  const { limit, offset } = pagination;
  const conds: SQL[] = [];
  if (filters.token0) conds.push(eq(liquidityAddedEvent.token0, filters.token0));
  if (filters.token1) conds.push(eq(liquidityAddedEvent.token1, filters.token1));
  if (filters.to) conds.push(eq(liquidityAddedEvent.to, filters.to));
  if (filters.stable !== undefined)
    conds.push(eq(liquidityAddedEvent.stable, filters.stable));

  const base = db
    .select()
    .from(liquidityAddedEvent)
    .orderBy(desc(liquidityAddedEvent.blockNumber))
    .limit(limit)
    .offset(offset);

  const rows = conds.length > 0 ? await base.where(and(...conds)) : await base;
  return rows.map(serializeLiquidityAdded);
}

export async function getLiquidityAddedById(
  id: string,
): Promise<LiquidityAddedJson | undefined> {
  const rows = await db
    .select()
    .from(liquidityAddedEvent)
    .where(eq(liquidityAddedEvent.id, id))
    .limit(1);
  const row = rows[0];
  return row ? serializeLiquidityAdded(row) : undefined;
}

export async function listCLLiquidityAdded(
  pagination: Pagination,
  filters: { token0?: `0x${string}`; token1?: `0x${string}`; to?: `0x${string}` },
): Promise<CLLiquidityAddedJson[]> {
  const { limit, offset } = pagination;
  const conds: SQL[] = [];
  if (filters.token0)
    conds.push(eq(clLiquidityAddedEvent.token0, filters.token0));
  if (filters.token1)
    conds.push(eq(clLiquidityAddedEvent.token1, filters.token1));
  if (filters.to) conds.push(eq(clLiquidityAddedEvent.to, filters.to));

  const base = db
    .select()
    .from(clLiquidityAddedEvent)
    .orderBy(desc(clLiquidityAddedEvent.blockNumber))
    .limit(limit)
    .offset(offset);

  const rows = conds.length > 0 ? await base.where(and(...conds)) : await base;
  return rows.map(serializeCLLiquidityAdded);
}

export async function getCLLiquidityAddedById(
  id: string,
): Promise<CLLiquidityAddedJson | undefined> {
  const rows = await db
    .select()
    .from(clLiquidityAddedEvent)
    .where(eq(clLiquidityAddedEvent.id, id))
    .limit(1);
  const row = rows[0];
  return row ? serializeCLLiquidityAdded(row) : undefined;
}

export async function listSwaps(
  pagination: Pagination,
  filters: {
    tokenIn?: `0x${string}`;
    tokenOut?: `0x${string}`;
    to?: `0x${string}`;
    isCL?: boolean;
  },
): Promise<SwapJson[]> {
  const { limit, offset } = pagination;
  const conds: SQL[] = [];
  if (filters.tokenIn) conds.push(eq(swapEvent.tokenIn, filters.tokenIn));
  if (filters.tokenOut) conds.push(eq(swapEvent.tokenOut, filters.tokenOut));
  if (filters.to) conds.push(eq(swapEvent.to, filters.to));
  if (filters.isCL !== undefined) conds.push(eq(swapEvent.isCL, filters.isCL));

  const base = db
    .select()
    .from(swapEvent)
    .orderBy(desc(swapEvent.blockNumber))
    .limit(limit)
    .offset(offset);

  const rows = conds.length > 0 ? await base.where(and(...conds)) : await base;
  return rows.map(serializeSwap);
}

export async function getSwapById(id: string): Promise<SwapJson | undefined> {
  const rows = await db
    .select()
    .from(swapEvent)
    .where(eq(swapEvent.id, id))
    .limit(1);
  const row = rows[0];
  return row ? serializeSwap(row) : undefined;
}
