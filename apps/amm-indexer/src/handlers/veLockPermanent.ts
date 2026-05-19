import type { VeLockPermanentIndexerBrokerNotifyInput } from "@giwater/shared";
import { veLockPermanentEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleVeLockPermanent({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "VotingEscrow:LockPermanent";
  const a = event.args ?? {};
  const owner = lcAddr(a._owner ?? a[0]);
  const tokenId = BigInt(a._tokenId ?? a[1] ?? 0);
  const amount = BigInt(a.amount ?? a[2] ?? 0);

  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} tokenId=${tokenId} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(veLockPermanentEvent)
    .values({ id: event.id, owner, tokenId, amount, ...baseCols })
    .onConflictDoNothing();

  const notify: VeLockPermanentIndexerBrokerNotifyInput = {
    type: "VeLockPermanent",
    id: event.id,
    owner: owner as `0x${string}`,
    tokenId,
    amount,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
