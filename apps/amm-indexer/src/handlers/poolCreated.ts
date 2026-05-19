import { inferIndexerPairPriceOrientation } from "@giwater/shared";
import { poolCreatedEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { getIndexerPairOrientationOptions } from "./lib/indexerPairOrientationEnv";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";
import { parseAddressOrTokenInfo } from "./lib/parseAddressOrTokenInfo";
import { resolvePoolTokenAddresses } from "./lib/resolvePoolTokenAddresses";

export async function handlePoolCreated({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "GiwaUniversalRouter:PoolCreated";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );

  const args = event.args ?? {};
  const arg0 = args.token0 ?? args[0];
  const arg1 = args.token1 ?? args[1];
  const stableRaw = args.stable ?? args[2];
  const pool = args.pool ?? args[3];

  let t0 = parseAddressOrTokenInfo(arg0);
  let t1 = parseAddressOrTokenInfo(arg1);
  const poolHex = typeof pool === "string" && pool.startsWith("0x")
    ? (pool as `0x${string}`)
    : null;

  // Router indexed tuple args can be topic hashes; fallback to pool.token0/token1.
  if ((!t0 || !t1) && poolHex) {
    const resolved = await resolvePoolTokenAddresses(poolHex);
    if (resolved) {
      t0 = t0 ?? { address: resolved.token0 };
      t1 = t1 ?? { address: resolved.token1 };
    }
  }

  if (
    !t0 ||
    !t1 ||
    typeof pool !== "string" ||
    !pool.startsWith("0x")
  ) {
    console.warn(
      `[amm-indexer] Skip malformed ${eventSource} args id=${event.id} token0=${String(
        arg0,
      )} token1=${String(arg1)} pool=${String(pool)}`,
    );
    return;
  }

  const token0Hex = lcAddr(t0.address);
  const token1Hex = lcAddr(t1.address);
  const finalPoolHex = lcAddr(pool as string);
  const stable = typeof stableRaw === "boolean" ? stableRaw : Boolean(stableRaw);
  const o = inferIndexerPairPriceOrientation(
    token0Hex,
    token1Hex,
    getIndexerPairOrientationOptions(),
  );
  const baseCols = baseLogColumns(event);
  const row = {
    id: event.id,
    token0: token0Hex,
    token1: token1Hex,
    stable,
    pool: finalPoolHex,
    base: o.base,
    quote: o.quote,
    pairPriceAxis: o.pairPriceAxis,
    token0Decimals: t0.decimals ?? null,
    token1Decimals: t1.decimals ?? null,
    token0TotalSupply: t0.totalSupply ?? null,
    token1TotalSupply: t1.totalSupply ?? null,
    token0Name: t0.name ?? null,
    token1Name: t1.name ?? null,
    token0Symbol: t0.symbol ?? null,
    token1Symbol: t1.symbol ?? null,
    ...baseCols,
  };

  await context.db.insert(poolCreatedEvent).values(row).onConflictDoNothing();

  const token0Info = {
    token: t0.address,
    totalSupply: (t0.totalSupply ?? 0n).toString(),
    decimals: t0.decimals ?? 0,
    name: t0.name ?? "",
    symbol: t0.symbol ?? "",
  };
  const token1Info = {
    token: t1.address,
    totalSupply: (t1.totalSupply ?? 0n).toString(),
    decimals: t1.decimals ?? 0,
    name: t1.name ?? "",
    symbol: t1.symbol ?? "",
  };
  console.info(
    `[amm-indexer] ${eventSource} tokenInfo id=${event.id} token0Info=${JSON.stringify(
      token0Info,
    )} token1Info=${JSON.stringify(token1Info)}`,
  );

  await notifyBroker({
    type: "PoolCreated",
    id: row.id,
    token0: row.token0,
    token1: row.token1,
    stable: row.stable,
    pool: row.pool,
    base: o.base,
    quote: o.quote,
    pairPriceAxis: o.pairPriceAxis,
    token0Info: { ...token0Info, totalSupply: t0.totalSupply ?? 0n },
    token1Info: { ...token1Info, totalSupply: t1.totalSupply ?? 0n },
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  });
}
