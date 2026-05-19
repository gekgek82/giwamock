"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { portfolioApi } from "@/lib/portfolioApi";
import { GIWASCAN_URL } from "@/lib/config";
import { getMockDemoAddress, isMockMode } from "@/lib/mockTransactions";

export type ClaimPointEarningStatus =
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
  const statusCode =
    error && typeof error === "object" && "statusCode" in error
      ? Number((error as { statusCode?: number }).statusCode)
      : undefined;

  if (statusCode === 400) {
    return t("claimPointsEpochNotClosed");
  }
  if (statusCode === 404) {
    return t("claimPointsNotFound");
  }
  if (statusCode === 409) {
    return t("claimPointsAlreadyClaimed");
  }
  if (statusCode === 503) {
    return t("claimPointsDisabled");
  }

  if (msg.includes("Daily cap")) {
    return t("claimPointsDailyCap");
  }
  if (msg.includes("rate limit")) {
    return t("claimPointsRateLimit");
  }

  return t("claimPointsFailedPrefix") + msg.slice(0, 120);
}

export function useClaimPointEarning(onSuccess?: () => void) {
  const { address } = useAccount();
  const effectiveAddress = address ?? (isMockMode() ? getMockDemoAddress() : undefined);
  const t = useTranslations("toasts");
  const tCommon = useTranslations("common");
  const [status, setStatus] =
    useState<ClaimPointEarningStatus>("idle");
  const [pendingEarningId, setPendingEarningId] = useState<
    string | null
  >(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setPendingEarningId(null);
  }, []);

  const claim = useCallback(
    async (earningId: string | number) => {
      if (!effectiveAddress) {
        toast.error(t("walletNotConnected"));
        return;
      }

      setStatus("claiming");
      setPendingEarningId(String(earningId));

      try {
        const { txHash } = await portfolioApi.claimPointEarning(
          effectiveAddress,
          earningId,
        );

        setStatus("success");
        setPendingEarningId(null);

        toast.success(
          <div>
            {t("claimPointsSuccess")}{" "}
            <a
              href={`${GIWASCAN_URL}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {tCommon("viewOnGiwaScan")}
            </a>
          </div>,
        );

        onSuccess?.();
      } catch (error) {
        console.error("Claim point earning error:", error);
        setStatus("error");
        setPendingEarningId(null);
        toast.error(getErrorMessage(error, t));
      }
    },
    [effectiveAddress, onSuccess, t, tCommon],
  );

  return {
    claim,
    status,
    pendingEarningId,
    reset,
  };
}
