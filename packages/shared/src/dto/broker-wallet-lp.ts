export interface WalletLpPositionDto {
  poolAddress: string;
  token0: { address: string; symbol: string; decimals: number };
  token1: { address: string; symbol: string; decimals: number };
  poolType: 'BASIC' | 'CL';
  tickSpacing: number | null;
  isStable: boolean | null;
  effectiveFeeBps: number | null;
  totalAmount0Added: string;
  totalAmount1Added: string;
  poolBaseLiquidity: number;
  poolQuoteLiquidity: number;
  lastActivityAt: number;
}

export interface WalletLpPositionsResponseDto {
  positions: WalletLpPositionDto[];
  total: number;
}
