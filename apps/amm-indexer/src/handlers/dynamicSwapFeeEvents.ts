import { dynamicSwapFeeEvent } from "ponder:schema";
import { abiIntToBigInt, baseLogColumns } from "./lib/eventRow";
import { lcAddr } from "./lib/normalizeAddress";
import { notifyBroker } from "./lib/notifyBroker";

export async function handleCustomFeeSet({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "DynamicSwapFeeModule:CustomFeeSet";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { pool, fee } = event.args;

  await context.db.insert(dynamicSwapFeeEvent).values({
    id: event.id,
    pool,
    dynamicFee: false,
    fee: abiIntToBigInt(fee),
    ...baseLogColumns(event),
  });

  await notifyBroker({
    type: "DynamicSwapFeeModuleCustomFeeSet",
    id: event.id,
    pool,
    fee: abiIntToBigInt(fee),
    ...baseLogColumns(event),
  });
}

export async function handleDynamicFeeReset({
  event,
  context,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "DynamicSwapFeeModule:DynamicFeeReset";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { pool } = event.args;

  const poolLc = lcAddr(pool);
  await context.db.insert(dynamicSwapFeeEvent).values({
    id: event.id,
    pool: poolLc,
    dynamicFee: true,
    fee: null,
    ...baseLogColumns(event),
  }).onConflictDoNothing();

  await notifyBroker({
    type: "DynamicSwapFeeModuleDynamicFeeReset",
    id: event.id,
    pool: poolLc,
    ...baseLogColumns(event),
  });
}

export async function handleDefaultFeeCapSet({
  event,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "DynamicSwapFeeModule:DefaultFeeCapSet";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { defaultFeeCap } = event.args;
  await notifyBroker({
    type: "DynamicSwapFeeModuleDefaultFeeCapSet",
    id: event.id,
    defaultFeeCap: abiIntToBigInt(defaultFeeCap),
    ...baseLogColumns(event),
  });
}

export async function handleDefaultScalingFactorSet({
  event,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "DynamicSwapFeeModule:DefaultScalingFactorSet";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { defaultScalingFactor } = event.args;
  await notifyBroker({
    type: "DynamicSwapFeeModuleDefaultScalingFactorSet",
    id: event.id,
    defaultScalingFactor: abiIntToBigInt(defaultScalingFactor),
    ...baseLogColumns(event),
  });
}

export async function handleDiscountedDeregistered({
  event,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "DynamicSwapFeeModule:DiscountedDeregistered";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { discountOver } = event.args;
  await notifyBroker({
    type: "DynamicSwapFeeModuleDiscountedDeregistered",
    id: event.id,
    discountOver: lcAddr(discountOver),
    ...baseLogColumns(event),
  });
}

export async function handleDiscountedRegistered({
  event,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "DynamicSwapFeeModule:DiscountedRegistered";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { discountReceiver, discount } = event.args;
  await notifyBroker({
    type: "DynamicSwapFeeModuleDiscountedRegistered",
    id: event.id,
    discountReceiver: lcAddr(discountReceiver),
    discount: abiIntToBigInt(discount),
    ...baseLogColumns(event),
  });
}

export async function handleFeeCapSet({
  event,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "DynamicSwapFeeModule:FeeCapSet";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { pool, feeCap } = event.args;
  await notifyBroker({
    type: "DynamicSwapFeeModuleFeeCapSet",
    id: event.id,
    pool: lcAddr(pool),
    feeCap: abiIntToBigInt(feeCap),
    ...baseLogColumns(event),
  });
}

export async function handleScalingFactorSet({
  event,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "DynamicSwapFeeModule:ScalingFactorSet";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { pool, scalingFactor } = event.args;
  await notifyBroker({
    type: "DynamicSwapFeeModuleScalingFactorSet",
    id: event.id,
    pool: lcAddr(pool),
    scalingFactor: abiIntToBigInt(scalingFactor),
    ...baseLogColumns(event),
  });
}

export async function handleSecondsAgoSet({
  event,
  source,
}: {
  event: any;
  context: any;
  source?: string;
}) {
  const eventSource = source ?? "DynamicSwapFeeModule:SecondsAgoSet";
  console.info(
    `[amm-indexer] Indexed ${eventSource} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
  );
  const { secondsAgo } = event.args;
  await notifyBroker({
    type: "DynamicSwapFeeModuleSecondsAgoSet",
    id: event.id,
    secondsAgo: abiIntToBigInt(secondsAgo),
    ...baseLogColumns(event),
  });
}
