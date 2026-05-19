import { abiIntToBigInt, baseLogColumns } from "./lib/eventRow";
import { lcAddr } from "./lib/normalizeAddress";
import { notifyBroker } from "./lib/notifyBroker";

export async function handlePoolFactorySetCustomFee({
  event,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "PoolFactory:SetCustomFee";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { pool, fee } = event.args;
  await notifyBroker({
    type: "PoolFactorySetCustomFee",
    id: event.id,
    pool: lcAddr(pool),
    fee: abiIntToBigInt(fee),
    ...baseLogColumns(event),
  });
}

export async function handlePoolFactorySetFee({
  event,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "PoolFactory:SetFee";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { stable, fee } = event.args;
  await notifyBroker({
    type: "PoolFactorySetFee",
    id: event.id,
    stable,
    fee: abiIntToBigInt(fee),
    ...baseLogColumns(event),
  });
}

export async function handlePoolFactorySetFeeManager({
  event,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "PoolFactory:SetFeeManager";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { feeManager } = event.args;
  await notifyBroker({
    type: "PoolFactorySetFeeManager",
    id: event.id,
    feeManager: lcAddr(feeManager),
    ...baseLogColumns(event),
  });
}

export async function handlePoolFactorySetPauseState({
  event,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "PoolFactory:SetPauseState";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { state } = event.args;
  await notifyBroker({
    type: "PoolFactorySetPauseState",
    id: event.id,
    state,
    ...baseLogColumns(event),
  });
}

export async function handlePoolFactorySetPauser({
  event,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "PoolFactory:SetPauser";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { pauser } = event.args;
  await notifyBroker({
    type: "PoolFactorySetPauser",
    id: event.id,
    pauser: lcAddr(pauser),
    ...baseLogColumns(event),
  });
}

export async function handlePoolFactorySetVoter({
  event,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "PoolFactory:SetVoter";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { voter } = event.args;
  await notifyBroker({
    type: "PoolFactorySetVoter",
    id: event.id,
    voter: lcAddr(voter),
    ...baseLogColumns(event),
  });
}
