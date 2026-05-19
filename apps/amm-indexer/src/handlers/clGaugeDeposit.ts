import type { CLGaugeDepositIndexerBrokerNotifyInput } from "@giwater/shared";
import { clGaugeDepositEvent, voterGaugeCreatedEvent } from "ponder:schema";
import { eq } from "drizzle-orm";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleCLGaugeDeposit({
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
  const user = lcAddr(a.user ?? a[0]);
  const tokenId: bigint = a.tokenId ?? a[1] ?? 0n;
  const liquidityToStake: bigint = a.liquidityToStake ?? a[2] ?? 0n;

  if (!gauge || !user) {
    console.warn(`[amm-indexer] Skip malformed CLGaugeDeposit id=${event.id}`);
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
    .insert(clGaugeDepositEvent)
    .values({
      id: event.id,
      gauge,
      pool,
      user,
      tokenId,
      liquidityToStake,
      ...baseCols,
    })
    .onConflictDoNothing();

  const notify: CLGaugeDepositIndexerBrokerNotifyInput = {
    type: "CLGaugeDeposit",
    id: event.id,
    gauge: gauge as `0x${string}`,
    pool,
    user: user as `0x${string}`,
    tokenId,
    liquidityToStake,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
