import type { BribeVotingRewardClaimIndexerBrokerNotifyInput } from "@giwater/shared";
import { bribeVotingRewardClaimEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleBribeVotingRewardClaim({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const a = event.args ?? {};
  const from = lcAddr(a.from ?? a[0]);
  const reward = lcAddr(a.reward ?? a[1]);
  const amount = BigInt(a.amount ?? a[2] ?? 0);
  const rewardContract = lcAddr(event.log?.address ?? "0x0000000000000000000000000000000000000000");

  console.info(
    `[amm-indexer] Indexed BribeVotingReward:ClaimRewards id=${event.id} from=${from} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(bribeVotingRewardClaimEvent)
    .values({ id: event.id, from, reward, amount, rewardContract, ...baseCols })
    .onConflictDoNothing();

  const notify: BribeVotingRewardClaimIndexerBrokerNotifyInput = {
    type: "BribeVotingRewardClaim",
    id: event.id,
    from: from as `0x${string}`,
    reward: reward as `0x${string}`,
    amount,
    rewardContract: rewardContract as `0x${string}`,
    blockNumber: baseCols.blockNumber,
    blockTimestamp: baseCols.blockTimestamp,
    transactionHash: baseCols.transactionHash,
    logIndex: baseCols.logIndex,
  };
  await notifyBroker(notify);
}
