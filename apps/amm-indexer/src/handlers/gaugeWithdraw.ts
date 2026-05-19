import type { GaugeWithdrawIndexerBrokerNotifyInput } from "@giwater/shared";
import { gaugeWithdrawEvent, voterGaugeCreatedEvent } from "ponder:schema";
import { eq } from "drizzle-orm";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleGaugeWithdraw({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const gauge = lcAddr(event.log?.address ?? "");
  const a = event.args ?? {};
  const from = lcAddr(a.from ?? a[0]);
  const amount: bigint = a.amount ?? a[1] ?? 0n;

  if (!gauge || !from) {
    console.warn(`[amm-indexer] Skip malformed GaugeWithdraw id=${event.id}`);
    return;
  }

  const gaugeRecord = await context.db.sql
    .select()
    .from(voterGaugeCreatedEvent)
    .where(eq(voterGaugeCreatedEvent.gauge, gauge as `0x${string}`))
    .limit(1);
  const pool = (gaugeRecord[0]?.pool ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(gaugeWithdrawEvent)
    .values({
      id: event.id,
      gauge,
      pool,
      from,
      amount,
      ...baseCols,
    })
    .onConflictDoNothing();

  const notify: GaugeWithdrawIndexerBrokerNotifyInput = {
    type: "GaugeWithdraw",
    id: event.id,
    gauge: gauge as `0x${string}`,
    pool,
    from: from as `0x${string}`,
    amount,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
