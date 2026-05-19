import type { FeeVotingRewardClaimIndexerBrokerNotifyInput } from "@giwater/shared";
import { feeVotingRewardClaimEvent } from "ponder:schema";
import { baseLogColumns } from "./lib/eventRow";
import { notifyBroker } from "./lib/notifyBroker";
import { lcAddr } from "./lib/normalizeAddress";

export async function handleFeeVotingRewardClaim({
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
    `[amm-indexer] Indexed FeeVotingReward:ClaimRewards id=${event.id} from=${from} block=${event.block.number}`,
  );

  const baseCols = baseLogColumns(event);
  await context.db
    .insert(feeVotingRewardClaimEvent)
    .values({ id: event.id, from, reward, amount, rewardContract, ...baseCols })
    .onConflictDoNothing();

  const notify: FeeVotingRewardClaimIndexerBrokerNotifyInput = {
    type: "FeeVotingRewardClaim",
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
