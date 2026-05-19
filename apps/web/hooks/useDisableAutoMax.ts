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

export type DisableAutoMaxStep = "idle" | "signing" | "submitting";

export function buildDisableAutoMaxMessage(lockId: number): string {
  return `Disable Auto-Max tPOINT lock lockId:${lockId} action:disableAutoMax`;
}

export function useDisableAutoMax() {
  const { address } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const { signMessageAsync } = useSignMessage();
  const t = useTranslations("toasts");
  const [step, setStep] = useState<DisableAutoMaxStep>("idle");

  const disableAutoMax = async (lockId: number): Promise<boolean> => {
    if (!effectiveAddress) {
      toast.error(t("walletNotConnected"));
      return false;
    }

    setStep("signing");
    let signature: string;
    let message: string;
    try {
      message = buildDisableAutoMaxMessage(lockId);
      signature = isMockMode()
        ? createMockSignature({ address: effectiveAddress, message })
        : await signMessageAsync({ message });
    } catch (error) {
      setStep("idle");
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        toast.error(t("signatureRejected"));
      } else {
        toast.error(t("signatureFailed"));
      }
      return false;
    }

    setStep("submitting");
    try {
      await portfolioApi.disableAutoMaxTPointLock(
        lockId,
        effectiveAddress,
        signature,
        message,
      );
      toast.success(t("disableAutoMaxSuccess"));
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (msg.includes("already disabled")) {
        toast.error(t("disableAutoMaxAlreadyDisabled"));
      } else if (msg.includes("expired")) {
        toast.error(t("disableAutoMaxExpired"));
      } else if (msg.includes("owner") || msg.includes("Owner")) {
        toast.error(t("disableAutoMaxNotOwner"));
      } else if (msg.includes("Signed message")) {
        toast.error(t("signatureMismatch"));
      } else {
        toast.error(t("disableAutoMaxFailed"));
      }
      return false;
    } finally {
      setStep("idle");
    }
  };

  return {
    step,
    disableAutoMax,
    isSigning: step === "signing",
    isSubmitting: step === "submitting",
    isWorking: step !== "idle",
  };
}
