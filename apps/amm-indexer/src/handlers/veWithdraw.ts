import type { VeWithdrawIndexerBrokerNotifyInput } from "@giwater/shared";
import { veWithdrawEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleVeWithdraw({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "VotingEscrow:Withdraw";
  const a = event.args ?? {};
  const provider = lcAddr(a.provider ?? a[0]);
  const tokenId = BigInt(a.tokenId ?? a[1] ?? 0);
  const value = BigInt(a.value ?? a[2] ?? 0);

  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} tokenId=${tokenId} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(veWithdrawEvent)
    .values({ id: event.id, provider, tokenId, value, ...baseCols })
    .onConflictDoNothing();

  const notify: VeWithdrawIndexerBrokerNotifyInput = {
    type: "VeWithdraw",
    id: event.id,
    provider: provider as `0x${string}`,
    tokenId,
    value,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
