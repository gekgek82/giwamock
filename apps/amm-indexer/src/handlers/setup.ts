import type { SetupIndexerBrokerPayload } from "@giwater/shared";
import { publishIndexerEvent } from "../lib/rabbitmq";

export async function handleSetup(_args: {
  event?: any;
  context?: any;
  source?: string;
}) {
  const eventSource = _args.source ?? "GiwaUniversalRouter:setup";
  console.info(`[amm-indexer] Indexer setup hook executed (${eventSource})`);

  const payload: SetupIndexerBrokerPayload = {
    type: "setup",
    ts: new Date().toISOString(),
  };
  await publishIndexerEvent(payload);
}
