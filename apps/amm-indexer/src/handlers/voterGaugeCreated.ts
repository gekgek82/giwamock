import type { VoterGaugeCreatedIndexerBrokerNotifyInput } from "@giwater/shared";
import { voterGaugeCreatedEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleVoterGaugeCreated({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "Voter:GaugeCreated";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()}`,
  );

  const a = event.args ?? {};
  const poolFactory = lcAddr(a.poolFactory ?? a[0]);
  const votingRewardsFactory = lcAddr(a.votingRewardsFactory ?? a[1]);
  const gaugeFactory = lcAddr(a.gaugeFactory ?? a[2]);
  const pool = lcAddr(a.pool ?? a[3]);
  const bribeVotingReward = lcAddr(a.bribeVotingReward ?? a[4]);
  const feeVotingReward = lcAddr(a.feeVotingReward ?? a[5]);
  const gauge = lcAddr(a.gauge ?? a[6]);
  const creator = lcAddr(a.creator ?? a[7]);

  if (!gauge || !pool) {
    console.warn(`[amm-indexer] Skip malformed GaugeCreated id=${event.id}`);
    return;
  }

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(voterGaugeCreatedEvent)
    .values({
      id: event.id,
      poolFactory,
      votingRewardsFactory,
      gaugeFactory,
      pool,
      bribeVotingReward,
      feeVotingReward,
      gauge,
      creator,
      ...baseCols,
    })
    .onConflictDoNothing();

  const notify: VoterGaugeCreatedIndexerBrokerNotifyInput = {
    type: "VoterGaugeCreated",
    id: event.id,
    poolFactory: poolFactory as `0x${string}`,
    votingRewardsFactory: votingRewardsFactory as `0x${string}`,
    gaugeFactory: gaugeFactory as `0x${string}`,
    pool: pool as `0x${string}`,
    bribeVotingReward: bribeVotingReward as `0x${string}`,
    feeVotingReward: feeVotingReward as `0x${string}`,
    gauge: gauge as `0x${string}`,
    creator: creator as `0x${string}`,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
