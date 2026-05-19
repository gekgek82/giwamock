export function createNoopContractEventHandler(eventName: string) {
  return async ({ event }: { event: any }) => {
    console.info(
      `[amm-indexer] Observed ${eventName} id=${event.id} block=${event.block.number.toString()} tx=${event.transaction.hash}`,
    );
  };
}
