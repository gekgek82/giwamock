"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { portfolioApi } from "@/lib/portfolioApi";
import { GIWASCAN_URL } from "@/lib/config";
import { getMockDemoAddress, isMockMode } from "@/lib/mockTransactions";
import type { ClaimResponse } from "@/types/portfolio";

export type ClaimPointsStatus =
  | "idle"
  | "claiming"
  | "success"
  | "error";

function getErrorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslations>,
): string {
  if (!error) return t("unknownError");
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes("Daily cap")) {
    return t("claimPointsDailyCap");
  }
  if (msg.includes("rate limit")) {
    return t("claimPointsRateLimit");
  }

  return t("claimPointsFailedPrefix") + msg.slice(0, 100);
}

export function useClaimPoints() {
  const { address } = useAccount();
  const effectiveAddress = address ?? (isMockMode() ? getMockDemoAddress() : undefined);
  const t = useTranslations("toasts");
  const tCommon = useTranslations("common");

  const [status, setStatus] = useState<ClaimPointsStatus>("idle");
  const [claimData, setClaimData] = useState<ClaimResponse | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setClaimData(null);
    setTxHash(null);
  }, []);

  const claimPoints = useCallback(async () => {
    if (!effectiveAddress) {
      toast.error(t("walletNotConnected"));
      return;
    }

    setStatus("claiming");
    setTxHash(null);

    try {
      // Single API call — backend handles mint() via Minter wallet
      const response = await portfolioApi.claimRewards(effectiveAddress, {
        claimType: "points",
      });
      setClaimData(response);

      if (!response.rewards.points || parseFloat(response.rewards.points.amount) === 0) {
        toast.error(t("claimPointsNone"));
        setStatus("idle");
        return;
      }

      // Backend already minted — txHash is in the response
      const mintTxHash = response.rewards.points.txHash ?? null;
      setTxHash(mintTxHash);

      setStatus("success");

      if (mintTxHash) {
        toast.success(
          <div>
            {t("claimPointsSuccess")}{" "}
            <a
              href={`${GIWASCAN_URL}/tx/${mintTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {tCommon("viewOnGiwaScan")}
            </a>
          </div>
        );
      } else {
        toast.success(t("claimPointsRecorded"));
      }
    } catch (error) {
      console.error("Claim points error:", error);
      setStatus("error");
      toast.error(getErrorMessage(error, t));
    }
  }, [effectiveAddress, t, tCommon]);

  return {
    claimPoints,
    status,
    claimData,
    txHash,
    reset,
  };
}
