/**
 * One Universal Router `Swap` hop as materialized from broker `indexed_events`
 * (same logical fields as amm-indexer `swap_event` rows / queue payload).
 */
export interface SwapHopHistoryItemDto {
  id: string;
  sender: string;
  tokenIn: string;
  tokenOut: string;
  isCL: boolean;
  stable: boolean;
  hopIndex: string;
  amountIn: string;
  amountOut: string;
  feeAmount: string;
  feeToken: string;
  to: string;
  blockNumber: string;
  blockTimestamp: string;
  transactionHash: string;
  logIndex: string;
}

export interface SwapHopsByTransactionResponseDto {
  transactionHash: string;
  account: string;
  hops: SwapHopHistoryItemDto[];
}
