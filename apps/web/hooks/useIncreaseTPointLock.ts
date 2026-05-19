import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { parseUnits } from "viem";
import { useTranslations } from "next-intl";
import { portfolioApi } from "@/lib/portfolioApi";
import {
  createMockSignature,
  getMockDemoAddress,
  isMockMode,
} from "@/lib/mockTransactions";
import toast from "react-hot-toast";

export type IncreaseLockStep = "idle" | "signing" | "submitting";

export function useIncreaseTPointLock() {
  const { address } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const { signMessageAsync } = useSignMessage();
  const t = useTranslations("toasts");
  const [step, setStep] = useState<IncreaseLockStep>("idle");
  const [signature, setSignature] = useState<string | null>(null);
  const [signedMessage, setSignedMessage] = useState<string | null>(null);

  const resetSignature = () => {
    setSignature(null);
    setSignedMessage(null);
    setStep("idle");
  };

  /**
   * Request wallet signature that binds lockId and amount. Keeping signature
   * state separate from submission lets us show an intermediate "ready to
   * confirm" screen after approval.
   */
  const signIncrease = async (
    lockId: number,
    amount: string,
  ): Promise<{ signature: string; message: string; amountWei: string }> => {
    if (!effectiveAddress) throw new Error("Wallet not connected");

    setStep("signing");
    try {
      const amountWei = parseUnits(amount, 18).toString();
      const message = `Increase tPOINT lock lockId:${lockId} amount:${amountWei}`;
      const sig = isMockMode()
        ? createMockSignature({ address: effectiveAddress, message })
        : await signMessageAsync({ message });
      setSignature(sig);
      setSignedMessage(message);
      setStep("idle");
      return { signature: sig, message, amountWei };
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

  const submitIncrease = async (
    lockId: number,
    amountWei: string,
    sig: string,
    message: string,
  ): Promise<void> => {
    if (!effectiveAddress) throw new Error("Wallet not connected");

    setStep("submitting");
    try {
      await portfolioApi.increaseTPointLock(
        lockId,
        effectiveAddress,
        amountWei,
        sig,
        message,
      );
      toast.success(t("increaseTPointLockSuccess"));
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (msg.includes("Insufficient")) {
        toast.error(t("insufficientTPointBalance"));
      } else if (msg.includes("expired")) {
        toast.error(t("increaseExpired"));
      } else {
        toast.error(t("increaseTPointLockFailed"));
      }
      throw error;
    } finally {
      setStep("idle");
    }
  };

  return {
    step,
    signature,
    signedMessage,
    signIncrease,
    submitIncrease,
    resetSignature,
    isSigning: step === "signing",
    isSubmitting: step === "submitting",
  };
}
