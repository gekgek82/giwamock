import type {
  IndexerBrokerNotifyPayload,
  IndexerBrokerOnchainQueuePayload,
  IndexerBrokerOnchainWirePayloadWithoutTs,
} from "@giwater/shared";
import { publishIndexerEvent } from "../../lib/rabbitmq";

function normalizeJsonPayload(
  payload: IndexerBrokerNotifyPayload,
): IndexerBrokerOnchainWirePayloadWithoutTs {
  return JSON.parse(
    JSON.stringify(payload, (_k, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  ) as IndexerBrokerOnchainWirePayloadWithoutTs;
}

/** Payload to the broker queue (JSON). `id` === Ponder `event.id` === DB row primary key. */
export async function notifyBroker(
  payload: IndexerBrokerNotifyPayload,
): Promise<void> {
  try {
    const body = {
      ...normalizeJsonPayload(payload),
      ts: new Date().toISOString(),
    } as IndexerBrokerOnchainQueuePayload;
    await publishIndexerEvent(body);
  } catch (err) {
    // Never fail Ponder handlers: DB row is canonical; broker queue is best-effort.
    console.error(
      `[amm-indexer] notifyBroker unexpected error (indexing continues): ${err instanceof Error ? err.stack ?? err.message : err}`,
    );
  }
}
