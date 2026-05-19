import type { VeDepositIndexerBrokerNotifyInput } from "@giwater/shared";
import { veDepositEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleVeDeposit({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "VotingEscrow:Deposit";
  const a = event.args ?? {};
  const provider = lcAddr(a.provider ?? a[0]);
  const tokenId = BigInt(a.tokenId ?? a[1] ?? 0);
  const depositType = String(Number(a.depositType ?? a[2] ?? 0));
  const value = BigInt(a.value ?? a[3] ?? 0);
  const locktime = BigInt(a.locktime ?? a[4] ?? 0);

  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} tokenId=${tokenId} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(veDepositEvent)
    .values({ id: event.id, provider, tokenId, depositType, value, locktime, ...baseCols })
    .onConflictDoNothing();

  const notify: VeDepositIndexerBrokerNotifyInput = {
    type: "VeDeposit",
    id: event.id,
    provider: provider as `0x${string}`,
    tokenId,
    depositType,
    value,
    locktime,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
