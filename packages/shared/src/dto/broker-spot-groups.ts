/**
 * Broker spot group APIs (`spot_groups`, `spot_group_tokens`, `spot_group_pairs`).
 */

export interface CreateSpotGroupDto {
  /** Primary key for `spot_groups` (e.g. `giwater_bitcoin`). */
  id: string;
  name?: string;
  description?: string;
}

export interface SpotGroupRecordDto {
  id: string;
  name: string;
  description: string;
}

export interface AddTokenToSpotGroupDto {
  /** Token contract address; normalized to lowercase. */
  tokenAddress: string;
}

export interface SpotGroupTokenMemberDto {
  groupId: string;
  tokenId: string;
  symbol: string;
}

/** Paginated group membership slice. */
export interface SpotGroupTokenMembersPageDto {
  groupId: string;
  offset: number;
  limit: number;
  total: number;
  items: SpotGroupTokenMemberDto[];
}

export interface AddPairToSpotGroupDto {
  /** Pair (pool) contract address; normalized to lowercase. */
  pairAddress: string;
}

export interface SpotGroupPairMemberDto {
  pairId: string;
  groupId: string;
  symbol: string;
  base: string;
  quote: string;
}

/** Paginated pair group membership slice. */
export interface SpotGroupPairMembersPageDto {
  groupId: string;
  offset: number;
  limit: number;
  total: number;
  items: SpotGroupPairMemberDto[];
}
