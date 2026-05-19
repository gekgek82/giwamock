import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { portfolioApi } from "@/lib/portfolioApi";
import type { TPointLockPosition } from "@/types/portfolio";

export interface TPointUserLock {
  id: string;
  lockNo: string;
  lockedAmount: string;
  lockPeriod: string;
  votingPower: string;
  votingWeight: string;
  isExpired: boolean;
}

function formatLockPeriod(days: number): string {
  if (days >= 365) {
    const years = Math.round(days / 365);
    return `${years} year${years > 1 ? "s" : ""}`;
  }
  if (days >= 7) {
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks > 1 ? "s" : ""}`;
  }
  return `${days} day${days > 1 ? "s" : ""}`;
}

function calculateVotingWeight(days: number): string {
  const maxDays = 1456; // 4 years
  const weight = Math.min(100, (days / maxDays) * 100);
  return `${weight.toFixed(0)}%`;
}

function transformLock(lock: TPointLockPosition): TPointUserLock {
  const now = new Date();
  const endDate = new Date(lock.lockEnd);
  const isExpired = endDate < now;

  return {
    id: lock.id.toString(),
    lockNo: `#${lock.id}`,
    lockedAmount: lock.amount,
    lockPeriod: isExpired ? "Expired" : formatLockPeriod(lock.lockDays),
    votingPower: lock.votingPower,
    votingWeight: calculateVotingWeight(lock.lockDays),
    isExpired,
  };
}

export function useTPointUserLocks() {
  const { address } = useAccount();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tpoint-locks", address],
    queryFn: () => portfolioApi.getTPointLocks(address!),
    enabled: !!address,
    staleTime: 15_000,
  });

  const locks: TPointUserLock[] = (data?.locks ?? []).map(transformLock);

  return {
    locks,
    summary: data?.summary,
    isLoading,
    refetch,
  };
}

export function useTPointLockData(lockId?: number) {
  const { data, isLoading } = useQuery({
    queryKey: ["tpoint-lock", lockId],
    queryFn: () => portfolioApi.getTPointLockById(lockId!),
    enabled: lockId !== undefined,
    staleTime: 15_000,
  });

  const lockData: TPointUserLock | null = data ? transformLock(data) : null;

  return { lockData, isLoading };
}
