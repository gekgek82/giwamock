"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { INDEXER_API_URL, MOCK_DATA_ENABLED } from "@/lib/config";

async function getPointBalance(address: string) {
  if (MOCK_DATA_ENABLED) {
    return { totalPoints: "128450" };
  }
  const res = await fetch(`${INDEXER_API_URL}/point/balance/${address}`);
  if (!res.ok) throw new Error("Failed to fetch balance");
  return res.json() as Promise<{ totalPoints: string }>;
}

async function getFaucetStatus(address: string) {
  if (MOCK_DATA_ENABLED) {
    return { canClaim: true, nextClaimAt: null };
  }
  const res = await fetch(`${INDEXER_API_URL}/point/faucet/${address}/status`);
  if (!res.ok) throw new Error("Failed to fetch faucet status");
  return res.json() as Promise<{ canClaim: boolean; nextClaimAt: string | null }>;
}

async function claimFaucet(address: string) {
  if (MOCK_DATA_ENABLED) {
    return { success: true, amount: "1000", totalPoints: "129450" };
  }
  const res = await fetch(`${INDEXER_API_URL}/point/faucet/${address}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || "Failed to claim");
  }
  return res.json() as Promise<{ success: boolean; amount: string; totalPoints: string }>;
}

export function PointsSection() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [claimedAmount, setClaimedAmount] = useState<string | null>(null);

  const balanceQuery = useQuery({
    queryKey: ["point-balance", address],
    queryFn: () => getPointBalance(address!),
    enabled: !!address,
    staleTime: 15_000,
  });

  const faucetQuery = useQuery({
    queryKey: ["faucet-status", address],
    queryFn: () => getFaucetStatus(address!),
    enabled: !!address,
    staleTime: 15_000,
  });

  const claimMutation = useMutation({
    mutationFn: () => claimFaucet(address!),
    onSuccess: (data) => {
      setClaimedAmount(data.amount);
      queryClient.invalidateQueries({ queryKey: ["point-balance", address] });
      queryClient.invalidateQueries({ queryKey: ["faucet-status", address] });
      queryClient.invalidateQueries({ queryKey: ["portfolio", "points", address] });
    },
  });

  const totalPoints = balanceQuery.data?.totalPoints
    ? parseFloat(balanceQuery.data.totalPoints).toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })
    : "0";

  const canClaim = faucetQuery.data?.canClaim ?? false;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <h2 className="text-primary-700 heading-6 mb-4">포인트</h2>
      <div className="h-px w-full bg-gray-30 mb-6" />

      {!address ? (
        <div className="text-center py-8">
          <p className="body-14 text-neutral-600">지갑을 연결해주세요</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Current Points */}
          <div className="bg-neutral-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="body-14 text-neutral-600">보유 포인트</span>
              {balanceQuery.isLoading ? (
                <div className="h-7 w-24 bg-neutral-200 rounded animate-pulse" />
              ) : (
                <span className="heading-5 text-neutral-1000">
                  {totalPoints}
                  <span className="body-14 text-neutral-500 ml-1">P</span>
                </span>
              )}
            </div>
          </div>

          {/* Faucet */}
          <div className="bg-primary-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
              <span className="body-14-medium text-primary-700">무료 포인트 받기</span>
            </div>
            <p className="body-12 text-neutral-600">
              매일 1회, 1,000 포인트를 무료로 받을 수 있습니다.
            </p>

            {claimedAmount && !claimMutation.isPending ? (
              <div className="flex items-center gap-2 py-2 px-3 bg-green-50 rounded-lg">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="body-14-medium text-green-700">
                  +{parseFloat(claimedAmount).toLocaleString()} 포인트 획득!
                </span>
              </div>
            ) : (
              <button
                onClick={() => {
                  setClaimedAmount(null);
                  claimMutation.mutate();
                }}
                disabled={!canClaim || claimMutation.isPending || faucetQuery.isLoading || faucetQuery.isError}
                className={`w-full py-3 rounded-xl body-14-medium transition-all ${
                  canClaim && !claimMutation.isPending
                    ? "bg-primary-100 hover:bg-primary-200 text-neutral-1000"
                    : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                }`}
              >
                {claimMutation.isPending
                  ? "받는 중..."
                  : faucetQuery.isLoading
                    ? "확인 중..."
                    : faucetQuery.isError
                      ? "잠시 후 다시 시도해주세요"
                      : canClaim
                        ? "1,000 포인트 받기"
                        : "오늘 이미 받았습니다"}
              </button>
            )}

            {claimMutation.isError && (
              <p className="body-12 text-red-500">
                {claimMutation.error.message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
