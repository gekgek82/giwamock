export type StakeEventType = 'deposit' | 'withdraw';

export interface WalletStakeEventDto {
  id: string;
  poolAddress: string;
  gaugeAddress: string;
  isCL: boolean;
  eventType: StakeEventType;
  /** Raw wei / liquidity amount as decimal string. */
  amount: string;
  /** CL only: NFT token ID as decimal string. */
  tokenId: string | null;
  blockTimestampSec: number;
  transactionHash: string;
}

export interface WalletStakePositionDto {
  poolAddress: string;
  gaugeAddress: string;
  isCL: boolean;
  /** Net deposited amount (deposits - withdrawals) as decimal string. */
  netAmount: string;
  lastActivityAt: number;
  events: WalletStakeEventDto[];
}

export interface WalletStakePositionsResponseDto {
  positions: WalletStakePositionDto[];
  total: number;
}
