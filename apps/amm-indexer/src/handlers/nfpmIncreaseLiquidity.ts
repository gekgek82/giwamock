import { clLiquidityAddedEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { lcAddr } from "./lib/normalizeAddress";
import { notifyBroker } from "./lib/notifyBroker";
import { resolveNfpmPosition } from "./lib/resolveNfpmPosition";

export async function handleNfpmIncreaseLiquidity({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const { tokenId, liquidity, amount0, amount1 } = event.args;

  const position = await resolveNfpmPosition(tokenId);
  if (!position) {
    console.warn(
      `[amm-indexer] NonfungiblePositionManager:IncreaseLiquidity: could not resolve position tokenId=${tokenId} id=${event.id}`,
    );
    return;
  }

  const sender = lcAddr(event.transaction.from);
  const row = {
    id: event.id,
    sender,
    token0: position.token0,
    token1: position.token1,
    tickSpacing: position.tickSpacing,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    liquidity,
    amount0,
    amount1,
    to: sender,
    ...baseLogColumns(event),
  };

  await context.db.insert(clLiquidityAddedEvent).values(row).onConflictDoNothing();

  console.info(
    `[amm-indexer] NonfungiblePositionManager:IncreaseLiquidity id=${event.id} tokenId=${tokenId} token0=${position.token0} token1=${position.token1} tickSpacing=${position.tickSpacing} amount0=${amount0} amount1=${amount1}`,
  );

  await notifyBroker({
    type: "CLLiquidityAdded",
    ...row,
  });
}
