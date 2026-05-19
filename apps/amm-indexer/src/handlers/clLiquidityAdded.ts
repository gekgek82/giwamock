import { clLiquidityAddedEvent } from "ponder:schema";
import { abiIntToBigInt, baseLogColumns } from "./lib/eventRow";
import { lcAddr } from "./lib/normalizeAddress";
import { notifyBroker } from "./lib/notifyBroker";

export async function handleCLLiquidityAdded({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "GiwaUniversalRouter:CLLiquidityAdded";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );

  const {
    sender,
    token0,
    token1,
    tickSpacing,
    tickLower,
    tickUpper,
    liquidity,
    amount0,
    amount1,
    to,
  } = event.args;
  const row = {
    id: event.id,
    sender: lcAddr(sender),
    token0: lcAddr(token0),
    token1: lcAddr(token1),
    tickSpacing: abiIntToBigInt(tickSpacing),
    tickLower: abiIntToBigInt(tickLower),
    tickUpper: abiIntToBigInt(tickUpper),
    liquidity,
    amount0,
    amount1,
    to: lcAddr(to),
    ...baseLogColumns(event),
  };

  await context.db.insert(clLiquidityAddedEvent).values(row).onConflictDoNothing();

  await notifyBroker({
    type: "CLLiquidityAdded",
    ...row,
  });
}
