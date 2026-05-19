import type { VeSplitIndexerBrokerNotifyInput } from "@giwater/shared";
import { veSplitEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleVeSplit({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "VotingEscrow:Split";
  const a = event.args ?? {};
  const from = BigInt(a._from ?? a[0] ?? 0);
  const tokenId1 = BigInt(a._tokenId1 ?? a[1] ?? 0);
  const tokenId2 = BigInt(a._tokenId2 ?? a[2] ?? 0);
  const sender = lcAddr(a._sender ?? a[3]);
  const splitAmount1 = BigInt(a._splitAmount1 ?? a[4] ?? 0);
  const splitAmount2 = BigInt(a._splitAmount2 ?? a[5] ?? 0);
  const locktime = BigInt(a._locktime ?? a[6] ?? 0);

  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} from=${from} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(veSplitEvent)
    .values({ id: event.id, from, tokenId1, tokenId2, sender, splitAmount1, splitAmount2, locktime, ...baseCols })
    .onConflictDoNothing();

  const notify: VeSplitIndexerBrokerNotifyInput = {
    type: "VeSplit",
    id: event.id,
    from,
    tokenId1,
    tokenId2,
    sender: sender as `0x${string}`,
    splitAmount1,
    splitAmount2,
    locktime,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
