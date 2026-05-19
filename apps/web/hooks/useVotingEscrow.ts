import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";

import { useLockDataSource } from "@/lib/datasources/context";
import type { RawLock } from "@/lib/datasources/lock";

export interface UserLock {
  id: string;
  tokenId: bigint;
  lockNo: string;
  lockedAmount: string;
  lockEndTimestamp: number;
  lockPeriod: string;
  votingPower: string;
  votingWeight: string;
  isPermanent: boolean;
  isExpired: boolean;
}

function formatLockPeriod(days: number): string {
  if (days <= 0) return "Expired";
  if (days >= 365) {
    const years = Math.round(days / 365);
    return `${years} year${years > 1 ? "s" : ""}`;
  }
  return `${days} days`;
}

function calculateVotingWeight(days: number): string {
  if (days <= 0) return "0%";
  const maxDays = 1460; // 4 years
  const weight = Math.min(100, (days / maxDays) * 100);
  return `${weight.toFixed(0)}%`;
}

function toDisplay(raw: RawLock): UserLock {
  const endDate = new Date(Number(raw.endTimestamp) * 1000);
  const now = new Date();
  const diffDays = Math.max(
    0,
    Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return {
    id: raw.tokenId.toString(),
    tokenId: raw.tokenId,
    lockNo: `#${raw.tokenId.toString()}`,
    lockedAmount: formatUnits(raw.amount, 18),
    lockEndTimestamp: Number(raw.endTimestamp),
    lockPeriod: raw.isPermanent ? "Permanent" : formatLockPeriod(diffDays),
    votingPower: formatUnits(raw.votingPower, 18),
    votingWeight: raw.isPermanent
      ? "100%"
      : calculateVotingWeight(diffDays),
    isPermanent: raw.isPermanent,
    isExpired: !raw.isPermanent && diffDays === 0,
  };
}

/**
 * Number of veNFTs owned by the connected wallet.
 */
export function useVeNFTCount() {
  const { address } = useAccount();
  const lock = useLockDataSource();

  const { data, isLoading } = useQuery({
    queryKey: ["lock", "nft-count", address],
    queryFn: () => lock!.getNFTCount(address!),
    enabled: !!lock && !!address,
  });

  return { count: data ?? 0, isLoading };
}

/**
 * All lock positions for the connected wallet.
 */
export function useUserLocks() {
  const { address } = useAccount();
  const lock = useLockDataSource();

  const { data, isLoading } = useQuery({
    queryKey: ["lock", "user-locks", address],
    queryFn: () => lock!.getUserLocks(address!),
    enabled: !!lock && !!address,
  });

  const raw = data ?? [];
  return {
    locks: raw.map(toDisplay),
    isLoading,
    tokenIds: raw.map((l) => l.tokenId),
  };
}

/**
 * Detail for a single lock by tokenId.
 */
export function useLockData(tokenId?: bigint) {
  const lock = useLockDataSource();

  const { data, isLoading } = useQuery({
    queryKey: ["lock", "detail", tokenId?.toString()],
    queryFn: () => lock!.getLockData(tokenId!),
    enabled: !!lock && tokenId !== undefined,
  });

  return {
    lockData: data ? toDisplay(data) : null,
    isLoading,
  };
}
