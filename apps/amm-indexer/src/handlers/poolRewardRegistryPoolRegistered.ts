import type { PoolRegisteredIndexerBrokerNotifyInput } from "@giwater/shared";
import { toHex } from "viem";
import { poolRegisteredDiscoveryEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handlePoolRewardRegistryPoolRegistered({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource =
    source ?? "PoolRewardRegistry:PoolRegistered";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()}`,
  );

  const a = event.args ?? {};
  const registry = lcAddr(String(event.log?.address ?? ""));
  const index = a.index ?? a[0];
  const pool = lcAddr(a.pool ?? a[1]);
  const poolFactory = lcAddr(a.poolFactory ?? a[2]);
  const kind = Number(a.kind ?? a[3]);
  const token0 = lcAddr(a.token0 ?? a[4]);
  const token1 = lcAddr(a.token1 ?? a[5]);
  const metaRaw = a.metadata ?? a[6];
  const metadata =
    typeof metaRaw === "string"
      ? metaRaw
      : metaRaw instanceof Uint8Array
        ? toHex(metaRaw)
        : toHex(metaRaw as `0x${string}`);

  const ZERO = "0x0000000000000000000000000000000000000000";
  if (
    registry === ZERO ||
    pool === ZERO ||
    poolFactory === ZERO ||
    token0 === ZERO ||
    token1 === ZERO
  ) {
    console.warn(`[amm-indexer] Skip malformed PoolRegistered id=${event.id}`);
    return;
  }

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(poolRegisteredDiscoveryEvent)
    .values({
      id: event.id,
      registry,
      index: BigInt(index),
      pool,
      poolFactory,
      kind,
      token0,
      token1,
      metadata,
      ...baseCols,
    })
    .onConflictDoNothing();

  const notify: PoolRegisteredIndexerBrokerNotifyInput = {
    type: "PoolRegistered",
    id: event.id,
    registry: registry as `0x${string}`,
    index: BigInt(index),
    pool: pool as `0x${string}`,
    poolFactory: poolFactory as `0x${string}`,
    kind,
    token0: token0 as `0x${string}`,
    token1: token1 as `0x${string}`,
    metadata,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
