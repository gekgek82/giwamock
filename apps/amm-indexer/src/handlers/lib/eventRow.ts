/** Normalize ABI int24 / small integers from viem to bigint for Ponder columns. */
export function abiIntToBigInt(value: bigint | number): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

type BlockTxLog = {
  block: { number: bigint; timestamp: bigint };
  transaction: { hash: `0x${string}` };
  log: { logIndex: number };
};

export function baseLogColumns(event: BlockTxLog) {
  return {
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    logIndex: BigInt(event.log.logIndex),
  };
}
