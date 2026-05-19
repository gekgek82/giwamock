import type { VoterAbstainedIndexerBrokerNotifyInput } from "@giwater/shared";
import { voterAbstainedEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleVoterAbstained({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const a = event.args ?? {};
  const voter = lcAddr(a.voter ?? a[0]);
  const pool = lcAddr(a.pool ?? a[1]);
  const tokenId = BigInt(a.tokenId ?? a[2] ?? 0);
  const weight = BigInt(a.weight ?? a[3] ?? 0);
  const totalWeight = BigInt(a.totalWeight ?? a[4] ?? 0);
  const epochTimestamp = BigInt(a.timestamp ?? a[5] ?? 0);

  console.info(
    `[amm-indexer] Indexed Voter:Abstained id=${event.id} tokenId=${tokenId} pool=${pool} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(voterAbstainedEvent)
    .values({ id: event.id, voter, pool, tokenId, weight, totalWeight, epochTimestamp, ...baseCols })
    .onConflictDoNothing();

  const notify: VoterAbstainedIndexerBrokerNotifyInput = {
    type: "VoterAbstained",
    id: event.id,
    voter: voter as `0x${string}`,
    pool: pool as `0x${string}`,
    tokenId,
    weight,
    totalWeight,
    epochTimestamp,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
