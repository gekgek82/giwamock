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

export type ExtendLockStep = "idle" | "signing" | "submitting";

export function buildExtendMessage(
  lockId: number,
  newDurationDays: number,
  autoMax: boolean,
): string {
  return `Extend tPOINT lock lockId:${lockId} newDurationDays:${newDurationDays} autoMax:${autoMax ? "true" : "false"}`;
}

export function useExtendTPointLock() {
  const { address } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const { signMessageAsync } = useSignMessage();
  const t = useTranslations("toasts");
  const [step, setStep] = useState<ExtendLockStep>("idle");

  const signExtend = async (
    lockId: number,
    newDurationDays: number,
    autoMax: boolean,
  ): Promise<{ signature: string; message: string }> => {
    if (!effectiveAddress) throw new Error("Wallet not connected");

    setStep("signing");
    try {
      const message = buildExtendMessage(lockId, newDurationDays, autoMax);
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

  const submitExtend = async (
    lockId: number,
    newDurationDays: number,
    autoMax: boolean,
    signature: string,
    message: string,
  ): Promise<void> => {
    if (!effectiveAddress) throw new Error("Wallet not connected");

    setStep("submitting");
    try {
      await portfolioApi.extendTPointLock(
        lockId,
        effectiveAddress,
        newDurationDays,
        autoMax,
        signature,
        message,
      );
      toast.success(t("extendTPointLockSuccess"));
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (msg.includes("expired")) {
        toast.error(t("extendExpired"));
      } else if (msg.includes("owner") || msg.includes("Owner")) {
        toast.error(t("extendNotOwner"));
      } else if (msg.includes("greater than the current remaining")) {
        toast.error(t("extendTooShort"));
      } else if (msg.includes("cannot exceed")) {
        toast.error(t("extendTooLong"));
      } else if (msg.includes("not active")) {
        toast.error(t("extendNotActive"));
      } else if (msg.includes("Signed message")) {
        toast.error(t("signatureMismatch"));
      } else {
        toast.error(t("extendTPointLockFailed"));
      }
      throw error;
    } finally {
      setStep("idle");
    }
  };

  return {
    step,
    signExtend,
    submitExtend,
    isSigning: step === "signing",
    isSubmitting: step === "submitting",
  };
}
