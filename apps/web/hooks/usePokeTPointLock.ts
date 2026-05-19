import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useTranslations } from "next-intl";
import { portfolioApi } from "@/lib/portfolioApi";
import {
  createMockSignature,
  getMockDemoAddress,
  isMockMode,
} from "@/lib/mockTransactions";
import type { TPointLockPokeResponse } from "@/types/portfolio";
import toast from "react-hot-toast";

export type PokeLockStep = "idle" | "signing" | "submitting";

function buildPokeMessage(lockId: number): string {
  const ts = Math.floor(Date.now() / 1000);
  return `Poke tPOINT lock lockId:${lockId} action:poke at ${ts}`;
}

export function usePokeTPointLock(onSuccess?: () => void) {
  const { address } = useAccount();
  const effectiveAddress = address ?? getMockDemoAddress();
  const { signMessageAsync } = useSignMessage();
  const t = useTranslations("toasts");
  const [step, setStep] = useState<PokeLockStep>("idle");
  const [pendingLockId, setPendingLockId] = useState<number | null>(null);

  const poke = async (lockId: number): Promise<TPointLockPokeResponse | null> => {
    if (!effectiveAddress) {
      toast.error(t("walletNotConnected"));
      return null;
    }

    setPendingLockId(lockId);
    setStep("signing");
    let signature: string;
    let message: string;
    try {
      message = buildPokeMessage(lockId);
      signature = isMockMode()
        ? createMockSignature({ address: effectiveAddress, message })
        : await signMessageAsync({ message });
    } catch (error) {
      setStep("idle");
      setPendingLockId(null);
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        toast.error(t("signatureRejected"));
      } else {
        toast.error(t("signatureFailed"));
      }
      return null;
    }

    setStep("submitting");
    try {
      const result = await portfolioApi.pokeTPointLock(
        lockId,
        effectiveAddress,
        signature,
        message,
      );
      toast.success(
        result.affectedVotes > 0
          ? t("pokeSuccessWithVotes", { count: result.affectedVotes })
          : t("pokeSuccess"),
      );
      onSuccess?.();
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (msg.includes("expired")) {
        toast.error(t("pokeExpired"));
      } else if (msg.includes("owner") || msg.includes("Owner")) {
        toast.error(t("pokeNotOwner"));
      } else if (msg.includes("not active")) {
        toast.error(t("pokeNotActive"));
      } else {
        toast.error(t("pokeUpdateFailed"));
      }
      return null;
    } finally {
      setStep("idle");
      setPendingLockId(null);
    }
  };

  return {
    poke,
    step,
    pendingLockId,
    isSigning: step === "signing",
    isSubmitting: step === "submitting",
    isPending: step !== "idle",
  };
}
