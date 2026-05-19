import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useTranslations } from "next-intl";
import { portfolioApi } from "@/lib/portfolioApi";
import {
  createMockSignature,
  getMockDemoAddress,
  isMockMode,
} from "@/lib/mockTransactions";
import toast from "react-hot-toast";

export type MergeLocksStep = "idle" | "signing" | "submitting";

export function buildMergeMessage(
  baseLockId: number,
  sourceLockIds: number[],
): string {
  const sorted = [...sourceLockIds].sort((a, b) => a - b);
  return `Merge tPOINT locks base:${baseLockId} sources:${sorted.join(",")}`;
}

export function useMergeTPointLocks() {
  const { address } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const { signMessageAsync } = useSignMessage();
  const t = useTranslations("toasts");
  const [step, setStep] = useState<MergeLocksStep>("idle");

  const signMerge = async (
    baseLockId: number,
    sourceLockIds: number[],
  ): Promise<{ signature: string; message: string }> => {
    if (!effectiveAddress) throw new Error("Wallet not connected");

    setStep("signing");
    try {
      const message = buildMergeMessage(baseLockId, sourceLockIds);
      const sig = isMockMode()
        ? createMockSignature({ address: effectiveAddress, message })
        : await signMessageAsync({ message });
      setStep("idle");
      return { signature: sig, message };
    } catch (error) {
      setStep("idle");
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        toast.error(t("signatureRejected"));
      } else {
        toast.error(t("signatureFailed"));
      }
      throw error;
    }
  };

  const submitMerge = async (
    baseLockId: number,
    sourceLockIds: number[],
    signature: string,
    message: string,
  ): Promise<void> => {
    if (!effectiveAddress) throw new Error("Wallet not connected");

    setStep("submitting");
    try {
      await portfolioApi.mergeTPointLocks(
        effectiveAddress,
        baseLockId,
        sourceLockIds,
        signature,
        message,
      );
      toast.success(t("mergeLocksSuccess"));
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (msg.includes("expired")) {
        toast.error(t("mergeExpired"));
      } else if (msg.includes("owner") || msg.includes("Owner")) {
        toast.error(t("mergeNotOwner"));
      } else if (msg.includes("not active")) {
        toast.error(t("mergeAlreadyInactive"));
      } else if (msg.includes("Signed message")) {
        toast.error(t("signatureMismatch"));
      } else {
        toast.error(t("mergeLocksFailed"));
      }
      throw error;
    } finally {
      setStep("idle");
    }
  };

  return {
    step,
    signMerge,
    submitMerge,
    isSigning: step === "signing",
    isSubmitting: step === "submitting",
  };
}
