import { abiIntToBigInt, baseLogColumns } from "./lib/eventRow";
import { lcAddr } from "./lib/normalizeAddress";
import { notifyBroker } from "./lib/notifyBroker";

export async function handleCLFactoryDefaultUnstakedFeeChanged({
  event,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "CLFactory:DefaultUnstakedFeeChanged";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { oldUnstakedFee, newUnstakedFee } = event.args;
  await notifyBroker({
    type: "CLFactoryDefaultUnstakedFeeChanged",
    id: event.id,
    oldUnstakedFee: abiIntToBigInt(oldUnstakedFee),
    newUnstakedFee: abiIntToBigInt(newUnstakedFee),
    ...baseLogColumns(event),
  });
}

export async function handleCLFactorySwapFeeModuleChanged({
  event,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "CLFactory:SwapFeeModuleChanged";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { oldFeeModule, newFeeModule } = event.args;
  await notifyBroker({
    type: "CLFactorySwapFeeModuleChanged",
    id: event.id,
    oldFeeModule: lcAddr(oldFeeModule),
    newFeeModule: lcAddr(newFeeModule),
    ...baseLogColumns(event),
  });
}
