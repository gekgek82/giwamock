import { swapEvent } from "ponder:schema";
import { abiIntToBigInt, baseLogColumns } from "./lib/eventRow";
import { lcAddr } from "./lib/normalizeAddress";
import { notifyBroker } from "./lib/notifyBroker";

export async function handleSwap({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "GiwaUniversalRouter:Swap";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const {
    sender,
    tokenIn,
    tokenOut,
    isCL,
    stable,
    hopIndex,
    amountIn,
    amountOut,
    feeAmount,
    feeToken,
    to,
  } = event.args;
  const row = {
    id: event.id,
    sender: lcAddr(sender),
    tokenIn: lcAddr(tokenIn),
    tokenOut: lcAddr(tokenOut),
    isCL,
    stable,
    hopIndex: abiIntToBigInt(hopIndex),
    amountIn,
    amountOut,
    feeAmount,
    feeToken: lcAddr(feeToken),
    to: lcAddr(to),
    ...baseLogColumns(event),
  };

  await context.db.insert(swapEvent).values(row).onConflictDoNothing();

  await notifyBroker({
    type: "Swap",
    ...row,
  });
}
