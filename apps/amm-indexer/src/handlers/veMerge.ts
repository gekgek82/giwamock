import type { VeMergeIndexerBrokerNotifyInput } from "@giwater/shared";
import { veMergeEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleVeMerge({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "VotingEscrow:Merge";
  const a = event.args ?? {};
  const sender = lcAddr(a._sender ?? a[0]);
  const from = BigInt(a._from ?? a[1] ?? 0);
  const to = BigInt(a._to ?? a[2] ?? 0);
  const amountFrom = BigInt(a._amountFrom ?? a[3] ?? 0);
  const amountTo = BigInt(a._amountTo ?? a[4] ?? 0);
  const amountFinal = BigInt(a._amountFinal ?? a[5] ?? 0);
  const locktime = BigInt(a._locktime ?? a[6] ?? 0);

  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} from=${from} to=${to} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(veMergeEvent)
    .values({ id: event.id, sender, from, to, amountFrom, amountTo, amountFinal, locktime, ...baseCols })
    .onConflictDoNothing();

  const notify: VeMergeIndexerBrokerNotifyInput = {
    type: "VeMerge",
    id: event.id,
    sender: sender as `0x${string}`,
    from,
    to,
    amountFrom,
    amountTo,
    amountFinal,
    locktime,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
