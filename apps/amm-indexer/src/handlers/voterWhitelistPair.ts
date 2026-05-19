import type { VoterWhitelistTokenIndexerBrokerNotifyInput } from "@giwater/shared";
import { voterWhitelistTokenEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleVoterWhitelistPair({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "Voter:WhitelistToken";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()}`,
  );

  const a = event.args ?? {};
  const whitelister = lcAddr(a.whitelister ?? a[0]);
  const token = lcAddr(a.token ?? a[1]);
  const whitelisted = Boolean(a._bool ?? a[2]);

  if (!token) {
    console.warn(`[amm-indexer] Skip malformed WhitelistToken id=${event.id}`);
    return;
  }

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(voterWhitelistTokenEvent)
    .values({
      id: event.id,
      whitelister,
      token,
      whitelisted,
      ...baseCols,
    })
    .onConflictDoNothing();

  const notify: VoterWhitelistTokenIndexerBrokerNotifyInput = {
    type: "VoterWhitelistToken",
    id: event.id,
    whitelister: whitelister as `0x${string}`,
    token: token as `0x${string}`,
    whitelisted,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
