import { liquidityAddedEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { lcAddr } from "./lib/normalizeAddress";
import { notifyBroker } from "./lib/notifyBroker";

export async function handleLiquidityAdded({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "GiwaUniversalRouter:LiquidityAdded";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );

  const { sender, token0, token1, stable, amount0, amount1, liquidity, to } =
    event.args;
  const row = {
    id: event.id,
    sender: lcAddr(sender),
    token0: lcAddr(token0),
    token1: lcAddr(token1),
    stable,
    amount0,
    amount1,
    liquidity,
    to: lcAddr(to),
    ...baseLogColumns(event),
  };

  await context.db.insert(liquidityAddedEvent).values(row).onConflictDoNothing();

  await notifyBroker({
    type: "LiquidityAdded",
    ...row,
  });
}
